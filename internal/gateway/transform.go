package gateway

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
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

	// Convert OpenAI request → Anthropic Messages format
	msg := buildAnthropicRequest(openAIReq)

	if isStream {
		// Real streaming: convert Anthropic SSE → OpenAI SSE on-the-fly
		s.streamConvertOpenModel(w, r, msg, key, model, openAIReq)
	} else {
		// Non-streaming: buffer full response, convert, return
		s.bufferConvertOpenModel(w, r, msg, key, model, openAIReq)
	}
}

// buildAnthropicRequest converts an OpenAI Chat Completions request to
// Anthropic Messages API format. Shared by both streaming and non-streaming paths.
func buildAnthropicRequest(openAIReq map[string]any) map[string]any {
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

	// Convert tools from OpenAI format to Anthropic format.
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

	// Clean up OpenAI-only fields that Anthropic doesn't support
	delete(msg, "stream_options")

	return msg
}

// ---------------------------------------------------------------------------
// Streaming path: real-time Anthropic SSE → OpenAI SSE conversion
// ---------------------------------------------------------------------------

func (s *Server) streamConvertOpenModel(w http.ResponseWriter, r *http.Request,
	msg map[string]any, key string, model Model, origReq map[string]any) {

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, `{"error":"streaming not supported"}`, http.StatusInternalServerError)
		return
	}

	// Enable streaming on the upstream request
	msg["stream"] = true
	delete(msg, "temperature")
	delete(msg, "top_p")

	upstreamBody, err := json.Marshal(msg)
	if err != nil {
		http.Error(w, `{"error":"marshal error"}`, http.StatusInternalServerError)
		return
	}

	proxyReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost,
		"https://api.openmodel.ai/v1/messages", bytes.NewReader(upstreamBody))
	if err != nil {
		http.Error(w, `{"error":"proxy error"}`, http.StatusInternalServerError)
		return
	}
	proxyReq.Header.Set("Content-Type", "application/json")
	proxyReq.Header.Set("Authorization", "Bearer "+key)
	proxyReq.Header.Set("Anthropic-Version", "2023-06-01")

	resp, err := streamClient.Do(proxyReq)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"upstream error: %v"}`, err), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	// Non-200: pass through error as-is
	if resp.StatusCode != http.StatusOK {
		errBody, _ := io.ReadAll(resp.Body)
		if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
			s.litePool.ReportFailure(key)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(resp.StatusCode)
		w.Write(errBody)
		return
	}
	s.litePool.ReportSuccess(key)

	// Set SSE headers for the client
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	modelID, _ := origReq["model"].(string)

	// Read Anthropic SSE events and convert to OpenAI SSE chunks on-the-fly
	scanner := bufio.NewScanner(resp.Body)
	// Increase scanner buffer for large SSE lines
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	var msgID string

	for scanner.Scan() {
		line := scanner.Text()

		// SSE lines: "event: <type>" or "data: <json>" or empty
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			break
		}

		var event map[string]any
		if err := json.Unmarshal([]byte(data), &event); err != nil {
			continue
		}

		eventType, _ := event["type"].(string)

		switch eventType {
		case "message_start":
			// Extract message ID for all subsequent chunks
			if m, ok := event["message"].(map[string]any); ok {
				msgID, _ = m["id"].(string)
			}
			// Send role-only chunk (OpenAI streaming convention)
			chunk := openAIChunk(msgID, modelID, map[string]any{"role": "assistant"}, nil, nil)
			writeSSEChunk(w, flusher, chunk)

		case "content_block_delta":
			// Real-time text token → flush immediately to client
			if delta, ok := event["delta"].(map[string]any); ok {
				if text, ok := delta["text"].(string); ok && text != "" {
					chunk := openAIChunk(msgID, modelID, map[string]any{"content": text}, nil, nil)
					writeSSEChunk(w, flusher, chunk)
				}
				// Handle tool use deltas (partial JSON for tool calls)
				if partialJSON, ok := delta["partial_json"].(string); ok && partialJSON != "" {
					// For tool calls, we pass through as function call arguments
					chunk := openAIChunk(msgID, modelID, map[string]any{"content": partialJSON}, nil, nil)
					writeSSEChunk(w, flusher, chunk)
				}
			}

		case "message_delta":
			// Final chunk with stop reason + usage
			stopReason := "stop"
			if delta, ok := event["delta"].(map[string]any); ok {
				if sr, ok := delta["stop_reason"].(string); ok {
					stopReason = convertStopReason(sr)
				}
			}
			var usage map[string]any
			if u, ok := event["usage"].(map[string]any); ok {
				usage = convertUsage(u)
			}
			chunk := openAIChunk(msgID, modelID, map[string]any{}, &stopReason, usage)
			writeSSEChunk(w, flusher, chunk)

		case "ping":
			// Keep-alive from upstream, ignore

		case "error":
			// Upstream error during streaming
			if errData, ok := event["error"].(map[string]any); ok {
				errMsg, _ := errData["message"].(string)
				errChunk := map[string]any{
					"error": map[string]any{
						"message": errMsg,
						"type":    "upstream_error",
					},
				}
				writeSSEChunk(w, flusher, errChunk)
			}
		}
	}

	// SSE terminator
	fmt.Fprintf(w, "data: [DONE]\n\n")
	flusher.Flush()
}

// ---------------------------------------------------------------------------
// Non-streaming path: buffer full response, convert, return (existing behavior)
// ---------------------------------------------------------------------------

func (s *Server) bufferConvertOpenModel(w http.ResponseWriter, r *http.Request,
	msg map[string]any, key string, model Model, openAIReq map[string]any) {

	delete(msg, "stream")
	delete(msg, "temperature")
	delete(msg, "top_p")

	upstreamBody, err := json.Marshal(msg)
	if err != nil {
		http.Error(w, `{"error":"marshal error"}`, http.StatusInternalServerError)
		return
	}

	proxyReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost,
		"https://api.openmodel.ai/v1/messages", bytes.NewReader(upstreamBody))
	if err != nil {
		http.Error(w, `{"error":"proxy error"}`, http.StatusInternalServerError)
		return
	}
	proxyReq.Header.Set("Content-Type", "application/json")
	proxyReq.Header.Set("Authorization", "Bearer "+key)
	proxyReq.Header.Set("Anthropic-Version", "2023-06-01")

	upstreamResp, err := proxyClient.Do(proxyReq)
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
		}
		return
	}
	s.litePool.ReportSuccess(key)

	// Convert Anthropic response back to OpenAI chat completion format
	var anthResp map[string]any
	if err := json.Unmarshal(respBody, &anthResp); err != nil {
		http.Error(w, `{"error":"parse upstream response"}`, http.StatusInternalServerError)
		return
	}
	openAIResp := convertAnthropicToOpenAI(anthResp, openAIReq)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(openAIResp)
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

func openAIChunk(id, model string, delta map[string]any, finishReason *string, usage map[string]any) map[string]any {
	chunk := map[string]any{
		"id":      "chatcmpl-" + id,
		"object":  "chat.completion.chunk",
		"created": time.Now().Unix(),
		"model":   model,
		"choices": []any{
			map[string]any{
				"index":         0,
				"delta":         delta,
				"finish_reason": finishReason,
			},
		},
	}
	if usage != nil {
		chunk["usage"] = usage
	}
	return chunk
}

func writeSSEChunk(w http.ResponseWriter, flusher http.Flusher, chunk map[string]any) {
	data, err := json.Marshal(chunk)
	if err != nil {
		return
	}
	fmt.Fprintf(w, "data: %s\n\n", data)
	flusher.Flush()
}

func convertStopReason(anthropic string) string {
	switch anthropic {
	case "end_turn":
		return "stop"
	case "max_tokens":
		return "length"
	case "tool_use":
		return "tool_calls"
	default:
		return "stop"
	}
}

func convertUsage(anthUsage map[string]any) map[string]any {
	input, _ := anthUsage["input_tokens"].(float64)
	output, _ := anthUsage["output_tokens"].(float64)
	return map[string]any{
		"prompt_tokens":     int(input),
		"completion_tokens": int(output),
		"total_tokens":      int(input + output),
	}
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
		stopReason = convertStopReason(sr)
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
		"created": time.Now().Unix(),
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
