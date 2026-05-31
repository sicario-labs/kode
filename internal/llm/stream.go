package llm

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

type StreamEvent struct {
	Token string
	Done  bool
	Error error
}

func (c *Client) ChatStream(ctx context.Context, req ChatRequest) (<-chan StreamEvent, error) {
	if err := c.config.Valid(); err != nil {
		return nil, err
	}

	if req.Model == "" {
		req.Model = c.config.Model
	}

	streamReq := req
	streamReq.Stream = true
	streamReq.Messages = sanitizeMessages(streamReq.Messages)

	body, err := json.Marshal(streamReq)
	if err != nil {
		return nil, fmt.Errorf("%w: marshal request: %v", ErrAPIRequest, err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.config.ChatURL(), bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("%w: create request: %v", ErrAPIRequest, err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.config.APIKey)
	httpReq.Header.Set("Accept", "text/event-stream")
	httpReq.Header.Set("Cache-Control", "no-cache")

	resp, err := c.http.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrAPIRequest, err)
	}

	if resp.StatusCode == http.StatusTooManyRequests {
		resp.Body.Close()
		return nil, ErrRateLimit
	}
	if resp.StatusCode == http.StatusUnauthorized {
		resp.Body.Close()
		return nil, ErrAuthFailed
	}
	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("%w: status %d: %s", ErrAPIRequest, resp.StatusCode, strings.TrimSpace(string(respBody)))
	}

	ch := make(chan StreamEvent, 64)
	go func() {
		defer close(ch)
		defer resp.Body.Close()

		scanner := bufio.NewScanner(resp.Body)
		scanner.Buffer(make([]byte, 0, 65536), 65536)

		for scanner.Scan() {
			line := scanner.Text()

			if line == "" {
				continue
			}

			if !strings.HasPrefix(line, "data: ") {
				continue
			}

			data := strings.TrimPrefix(line, "data: ")
			data = strings.TrimSpace(data)

			if data == "[DONE]" {
				ch <- StreamEvent{Done: true}
				return
			}

			var delta struct {
				Choices []struct {
					Delta struct {
						Content string `json:"content"`
					} `json:"delta"`
					FinishReason string `json:"finish_reason"`
				} `json:"choices"`
			}

			if err := json.Unmarshal([]byte(data), &delta); err != nil {
				ch <- StreamEvent{Error: fmt.Errorf("SSE parse error: %w", err)}
				return
			}

			if len(delta.Choices) > 0 {
				if delta.Choices[0].Delta.Content != "" {
					ch <- StreamEvent{Token: delta.Choices[0].Delta.Content}
				}
				if delta.Choices[0].FinishReason == "stop" || delta.Choices[0].FinishReason == "length" {
					ch <- StreamEvent{Done: true}
					return
				}
			}
		}

		if err := scanner.Err(); err != nil {
			ch <- StreamEvent{Error: fmt.Errorf("SSE read error: %w", err)}
			return
		}

		ch <- StreamEvent{Done: true}
	}()

	return ch, nil
}

func (c *Client) GenerateStream(ctx context.Context, systemPrompt, userPrompt string) (<-chan StreamEvent, error) {
	req := ChatRequest{
		Model: c.config.Model,
		Messages: []Message{
			{Role: RoleSystem, Content: systemPrompt},
			{Role: RoleUser, Content: userPrompt},
		},
		Temperature: 0.2,
		MaxTokens:   4096,
	}

	return c.ChatStream(ctx, req)
}
