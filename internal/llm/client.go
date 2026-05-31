package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Client struct {
	config Config
	http   *http.Client
}

func NewClient(cfg Config) *Client {
	return &Client{
		config: cfg,
		http: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

// sanitizeMessages converts tool-role messages to user-role messages.
// Many upstream APIs (Anthropic, openmodel.ai, etc.) do not accept a
// "tool" role — they use tool_result content blocks inside user messages
// instead. This function normalizes the request so it works with any
// OpenAI-compatible endpoint.
func sanitizeMessages(messages []Message) []Message {
	out := make([]Message, 0, len(messages))
	for _, m := range messages {
		if m.Role == RoleTool {
			out = append(out, Message{Role: RoleUser, Content: m.Content})
		} else {
			out = append(out, m)
		}
	}
	return out
}

func (c *Client) Chat(ctx context.Context, req ChatRequest) (*ChatResponse, error) {
	if err := c.config.Valid(); err != nil {
		return nil, err
	}

	if req.Model == "" {
		req.Model = c.config.Model
	}

	req.Messages = sanitizeMessages(req.Messages)

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("%w: marshal request: %v", ErrAPIRequest, err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.config.ChatURL(), bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("%w: create request: %v", ErrAPIRequest, err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.config.APIKey)

	resp, err := c.http.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrAPIRequest, err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("%w: read response: %v", ErrAPIRequest, err)
	}

	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, fmt.Errorf("%w: %s", ErrRateLimit, strings.TrimSpace(string(respBody)))
	}
	if resp.StatusCode == http.StatusUnauthorized {
		return nil, fmt.Errorf("%w: %s", ErrAuthFailed, strings.TrimSpace(string(respBody)))
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%w: status %d: %s", ErrAPIRequest, resp.StatusCode, strings.TrimSpace(string(respBody)))
	}

	var chatResp ChatResponse
	if err := json.Unmarshal(respBody, &chatResp); err != nil {
		return nil, fmt.Errorf("%w: decode response: %v", ErrAPIRequest, err)
	}

	if chatResp.Usage == nil {
		var usageResp struct {
			Usage *Usage `json:"usage"`
		}
		if err := json.Unmarshal(respBody, &usageResp); err == nil && usageResp.Usage != nil {
			chatResp.Usage = usageResp.Usage
		}
	}

	if chatResp.Error != nil && chatResp.Error.Message != "" {
		return nil, fmt.Errorf("%w: %s (%s)", ErrAPIRequest, chatResp.Error.Message, chatResp.Error.Type)
	}

	if len(chatResp.Choices) == 0 {
		return nil, ErrEmptyResponse
	}

	return &chatResp, nil
}

func (c *Client) Generate(ctx context.Context, systemPrompt, userPrompt string) (string, error) {
	req := ChatRequest{
		Model: c.config.Model,
		Messages: []Message{
			{Role: RoleSystem, Content: systemPrompt},
			{Role: RoleUser, Content: userPrompt},
		},
		Temperature: 0.2,
		MaxTokens:   4096,
	}

	resp, err := c.Chat(ctx, req)
	if err != nil {
		return "", err
	}

	return resp.Choices[0].Message.Content, nil
}
