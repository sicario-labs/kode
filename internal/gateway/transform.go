package gateway

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

func (s *Server) proxyToOpenModel(w http.ResponseWriter, r *http.Request, body []byte, model Model) {
	key := s.litePool.Next()
	if key == "" {
		s.maybeAlertLowPool()
		http.Error(w, `{"error":"no Lite pool keys available"}`, http.StatusBadGateway)
		return
	}

	// Parse incoming OpenAI chat request
	var openAIReq map[string]any
	if err := json.Unmarshal(body, &openAIReq); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	isStream, _ := openAIReq["stream"].(bool)

	var upstreamURL string
	var upstreamBody []byte

	switch model.Protocol {
	case ProtocolMessages:
		upstreamURL = "https://api.openmodel.ai/v1/messages"

		// Clone and adapt for Anthropic Messages format
		msg := make(map[string]any)
		for k, v := range openAIReq {
			msg[k] = v
		}
		// Anthropic requires max_tokens
		if _, ok := msg["max_tokens"]; !ok {
			msg["max_tokens"] = 4096
		}
		// Convert tool_choice from OpenAI string/object to Anthropic object form.
		// OpenAI: "auto" | "none" | "required" | { type: "function", function: { name } }
		// Anthropic: { type: "auto" } | { type: "any" } | { type: "tool", name } | omit
		if tc, ok := msg["tool_choice"]; ok {
			switch v := tc.(type) {
			case string:
				switch v {
				case "auto":
					msg["tool_choice"] = map[string]any{"type": "auto"}
				case "required":
					msg["tool_choice"] = map[string]any{"type": "any"}
				case "none":
					delete(msg, "tool_choice")
				}
			case map[string]any:
				if t, _ := v["type"].(string); t == "function" {
					if fn, ok := v["function"].(map[string]any); ok {
						if name, _ := fn["name"].(string); name != "" {
							msg["tool_choice"] = map[string]any{"type": "tool", "name": name}
						}
					}
				}
			}
		}
		// Anthropic uses a separate 'system' field instead of system role in messages
		if msgs, ok := msg["messages"].([]any); ok {
			var filtered []any
			for _, m := range msgs {
				if mm, ok := m.(map[string]any); ok {
					if role, _ := mm["role"].(string); role == "system" {
						if content, _ := mm["content"].(string); content != "" {
							msg["system"] = content
						}
						continue
					}
				}
				filtered = append(filtered, m)
			}
			msg["messages"] = filtered
		}
		// Convert tools from OpenAI format { type: "function", function: { name, description, parameters } }
		// to Anthropic format { name, description, input_schema }.
		if tools, ok := msg["tools"].([]any); ok {
			anthTools := make([]any, 0, len(tools))
			for _, t := range tools {
				if tmap, ok := t.(map[string]any); ok {
					if fn, ok := tmap["function"].(map[string]any); ok {
						conv := make(map[string]any)
						if name, _ := fn["name"].(string); name != "" {
							conv["name"] = name
						}
						if desc, _ := fn["description"].(string); desc != "" {
							conv["description"] = desc
						}
						if params, ok := fn["parameters"]; ok {
							conv["input_schema"] = params
						}
						anthTools = append(anthTools, conv)
					}
				}
			}
			if len(anthTools) > 0 {
				msg["tools"] = anthTools
			} else {
				delete(msg, "tools")
			}
		}
		delete(msg, "temperature")
		delete(msg, "top_p")
		delete(msg, "stream_options")
		var err error
		upstreamBody, err = json.Marshal(msg)
		if err != nil {
			http.Error(w, `{"error":"marshal error"}`, http.StatusInternalServerError)
			return
		}

	default:
		http.Error(w, `{"error":"unsupported protocol"}`, http.StatusBadGateway)
		return
	}

	// Proxy the converted request
	proxyReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost, upstreamURL, bytes.NewReader(upstreamBody))
	if err != nil {
		http.Error(w, `{"error":"proxy error"}`, http.StatusInternalServerError)
		return
	}
	proxyReq.Header.Set("Content-Type", "application/json")
	proxyReq.Header.Set("Authorization", "Bearer "+key)
	proxyReq.Header.Set("Anthropic-Version", "2023-06-01")

	client := &http.Client{Timeout: 120 * time.Second}
	upstreamResp, err := client.Do(proxyReq)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"upstream error: %v"}`, err), http.StatusBadGateway)
		return
	}
	defer upstreamResp.Body.Close()

	respBody, err := io.ReadAll(upstreamResp.Body)
	if err != nil {
		http.Error(w, `{"error":"read error"}`, http.StatusInternalServerError)
		return
	}

	// If upstream returned non-200, pass through as-is
	if upstreamResp.StatusCode != http.StatusOK {
		for k, vs := range upstreamResp.Header {
			for _, v := range vs {
				w.Header().Add(k, v)
			}
		}
		w.WriteHeader(upstreamResp.StatusCode)
		w.Write(respBody)

		if upstreamResp.StatusCode == http.StatusUnauthorized || upstreamResp.StatusCode == http.StatusForbidden {
			s.litePool.ReportFailure(key)
		} else if upstreamResp.StatusCode == http.StatusOK {
			s.litePool.ReportSuccess(key)
		}
		return
	}
	s.litePool.ReportSuccess(key)

	// Convert Anthropic response back to OpenAI chat completion format
	switch model.Protocol {
	case ProtocolMessages:
		var anthResp map[string]any
		if err := json.Unmarshal(respBody, &anthResp); err != nil {
			http.Error(w, `{"error":"parse upstream response"}`, http.StatusInternalServerError)
			return
		}
		openAIResp := convertAnthropicToOpenAI(anthResp, openAIReq)

		if isStream {
			// Stream as OpenAI Chat Completions SSE chunks
			flusher, _ := w.(http.Flusher)
			w.Header().Set("Content-Type", "text/event-stream")
			w.Header().Set("Cache-Control", "no-cache")
			w.Header().Set("Connection", "keep-alive")

			// Chunk 1: role-only to signal streaming start
			roleChunk := buildChunk(anthResp, openAIReq, map[string]any{"role": "assistant"}, nil, nil)
			if d, _ := json.Marshal(roleChunk); d != nil {
				fmt.Fprintf(w, "data: %s\n\n", d)
				if flusher != nil {
					flusher.Flush()
				}
			}

			// Chunk 2: full content + finish reason + usage
			choices := openAIResp["choices"].([]any)
			fr := "stop"
			if len(choices) > 0 {
				if c, ok := choices[0].(map[string]any); ok {
					if r, ok := c["finish_reason"].(string); ok {
						fr = r
					}
				}
			}
			usage := openAIResp["usage"]
			contentChunk := buildChunk(anthResp, openAIReq, map[string]any{"content": contentFrom(openAIResp)}, &fr, usage)
			if d, _ := json.Marshal(contentChunk); d != nil {
				fmt.Fprintf(w, "data: %s\n\n", d)
				if flusher != nil {
					flusher.Flush()
				}
			}

			// Terminator
			fmt.Fprintf(w, "data: [DONE]\n\n")
			if flusher != nil {
				flusher.Flush()
			}
		} else {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(openAIResp)
		}
	}
}

func buildChunk(anthResp, origReq map[string]any, delta map[string]any, finishReason *string, usage any) map[string]any {
	id, _ := anthResp["id"].(string)
	model, _ := origReq["model"].(string)
	choices := []any{
		map[string]any{
			"index":          0,
			"delta":          delta,
			"finish_reason":  finishReason,
		},
	}
	chunk := map[string]any{
		"id":      id,
		"object":  "chat.completion.chunk",
		"created": time.Now().Unix(),
		"model":   model,
		"choices": choices,
	}
	if usage != nil {
		chunk["usage"] = usage
	}
	return chunk
}

func contentFrom(openAIResp map[string]any) string {
	choices, _ := openAIResp["choices"].([]any)
	if len(choices) == 0 {
		return ""
	}
	c, _ := choices[0].(map[string]any)
	msg, _ := c["message"].(map[string]any)
	content, _ := msg["content"].(string)
	return content
}

func convertAnthropicToOpenAI(anthResp map[string]any, origReq map[string]any) map[string]any {
	// Extract text content from Anthropic response (skip thinking blocks)
	content := ""
	if contentArr, ok := anthResp["content"].([]any); ok {
		for _, block := range contentArr {
			if b, ok := block.(map[string]any); ok {
				if t, ok := b["type"].(string); ok && t == "text" {
					if txt, ok := b["text"].(string); ok {
						content = txt
						break
					}
				}
			}
		}
	}

	// Extract stop reason
	stopReason := "stop"
	if sr, ok := anthResp["stop_reason"].(string); ok {
		switch sr {
		case "end_turn":
			stopReason = "stop"
		case "max_tokens":
			stopReason = "length"
		case "tool_use":
			stopReason = "tool_calls"
		}
	}

	// Extract usage with safe type assertions
	promptTokens := 0
	completionTokens := 0
	totalTokens := 0
	if usage, ok := anthResp["usage"].(map[string]any); ok {
		if v, ok := usage["input_tokens"].(float64); ok {
			promptTokens = int(v)
		}
		if v, ok := usage["output_tokens"].(float64); ok {
			completionTokens = int(v)
		}
		totalTokens = promptTokens + completionTokens
	}

	// Build OpenAI-compatible response
	return map[string]any{
		"id":      anthResp["id"],
		"object":  "chat.completion",
		"created": 1700000000,
		"model":   origReq["model"],
		"choices": []any{
			map[string]any{
				"index": 0,
				"message": map[string]any{
					"role":    "assistant",
					"content": content,
				},
				"finish_reason": stopReason,
			},
		},
		"usage": map[string]any{
			"prompt_tokens":     promptTokens,
			"completion_tokens": completionTokens,
			"total_tokens":      totalTokens,
		},
	}
}
