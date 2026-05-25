package gateway

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type UpstreamConfig struct {
	OpenAIKey    string
	AnthropicKey string
	DeepSeekKey  string
	GoogleKey    string
}

type Server struct {
	catalog     Catalog
	keyStore    *APIKeyStore
	upstream    UpstreamConfig
	litePool    *KeyPool
	rateLimiter *RateLimiter
	mux         *http.ServeMux
}

func NewServer(catalog Catalog, upstream UpstreamConfig) *Server {
	s := &Server{
		catalog:      catalog,
		keyStore:     NewAPIKeyStore(),
		upstream:     upstream,
		litePool:     NewKeyPool(KeysFromEnv("KODE_LITE_KEYS")),
		rateLimiter:  NewRateLimiter(20, 24*time.Hour),
		mux:          http.NewServeMux(),
	}

	s.mux.HandleFunc("GET /api/models", s.handleModels)
	s.mux.HandleFunc("POST /v1/chat/completions", s.handleChat)
	s.mux.HandleFunc("GET /health", s.handleHealth)
	s.mux.HandleFunc("POST /api/keys", s.handleAddKey)

	s.keyStore.SeedFromEnv()

	return s
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ip := FormatIP(r.RemoteAddr)
	ctx := context.WithValue(r.Context(), "remote_ip", ip)
	r = r.WithContext(ctx)
	s.mux.ServeHTTP(w, r)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "ok", "version": "3.0.0"})
}

func (s *Server) handleModels(w http.ResponseWriter, r *http.Request) {
	apiKey := r.Header.Get("Authorization")
	if len(apiKey) > 7 && apiKey[:7] == "Bearer " {
		apiKey = apiKey[7:]
	}
	tier, _ := ResolveTier(apiKey, s.keyStore)
	models := ModelsForTier(s.catalog, tier)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Catalog{Models: models})
}

type chatRequest struct {
	Model       string          `json:"model"`
	Messages    json.RawMessage `json:"messages"`
	Stream      bool            `json:"stream,omitempty"`
	MaxTokens   int             `json:"max_tokens,omitempty"`
	Temperature float64         `json:"temperature,omitempty"`
}

func (s *Server) handleAddKey(w http.ResponseWriter, r *http.Request) {
	var info APIKeyInfo
	if err := json.NewDecoder(r.Body).Decode(&info); err != nil {
		http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
		return
	}
	if info.Key == "" || info.Tier == "" {
		http.Error(w, `{"error":"key and tier required"}`, http.StatusBadRequest)
		return
	}
	s.keyStore.Add(info)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (s *Server) handleChat(w http.ResponseWriter, r *http.Request) {
	apiKey := r.Header.Get("Authorization")
	if len(apiKey) > 7 && apiKey[:7] == "Bearer " {
		apiKey = apiKey[7:]
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, `{"error":"cannot read body"}`, http.StatusBadRequest)
		return
	}

	var req chatRequest
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
		return
	}

	// Free tier: rate limit by IP
	ip := FormatIP(r.RemoteAddr)
	if apiKey == "" || apiKey == "public" {
		if s.rateLimiter.Blocked(ip) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			json.NewEncoder(w).Encode(map[string]any{
				"error": "LiteUsageLimitError",
				"message": "Lite tier rate limit reached (20 requests/day). Set KODE_PRO_API_KEY in your environment or upgrade to Kode Pro at https://trykode.xyz/pricing",
			})
			return
		}
		count, limit, resetAt := s.rateLimiter.Allow(ip)
		w.Header().Set("X-RateLimit-Limit", fmt.Sprintf("%d", limit))
		w.Header().Set("X-RateLimit-Remaining", fmt.Sprintf("%d", limit-count))
		w.Header().Set("X-RateLimit-Reset", fmt.Sprintf("%.0f", resetAt.Seconds()))
	}

	// Verify model access
	if err := VerifyUsage(apiKey, req.Model, s.catalog, s.keyStore); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	// Route to upstream provider
	upstreamURL, upstreamKey, err := s.resolveUpstream(req.Model)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	// Find model to check if Lite tier (needs protocol transform)
	var model Model
	for _, m := range s.catalog.Models {
		if m.ID == req.Model {
			model = m
			break
		}
	}

	if model.Tier == TierLite {
		s.proxyToOpenModel(w, r, body, model)
		return
	}

	if req.Stream {
		s.proxyStream(w, r, upstreamURL, upstreamKey, body)
	} else {
		s.proxyChat(w, r, upstreamURL, upstreamKey, body)
	}
}

func (s *Server) resolveUpstream(modelID string) (string, string, error) {
	var model Model
	found := false
	for _, m := range s.catalog.Models {
		if m.ID == modelID {
			model = m
			found = true
			break
		}
	}
	if !found {
		return "", "", fmt.Errorf("unknown model: %s", modelID)
	}

	if model.Tier == TierLite {
		key := s.litePool.Next()
		if key == "" {
			return "", "", fmt.Errorf("no Lite pool keys available")
		}
		return "https://api.openmodel.ai/v1/messages", key, nil
	}

	switch model.Provider {
	case "openai":
		return "https://api.openai.com/v1/chat/completions", s.upstream.OpenAIKey, nil
	case "anthropic":
		return "https://api.anthropic.com/v1/messages", s.upstream.AnthropicKey, nil
	case "deepseek":
		return "https://api.deepseek.com/v1/chat/completions", s.upstream.DeepSeekKey, nil
	default:
		return "", "", fmt.Errorf("no upstream for provider: %s", model.Provider)
	}
}

func (s *Server) proxyChat(w http.ResponseWriter, r *http.Request, upstreamURL, upstreamKey string, body []byte) {
	proxyReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost, upstreamURL, bytes.NewReader(body))
	if err != nil {
		http.Error(w, `{"error":"proxy error"}`, http.StatusInternalServerError)
		return
	}
	proxyReq.Header.Set("Content-Type", "application/json")
	proxyReq.Header.Set("Authorization", "Bearer "+upstreamKey)

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(proxyReq)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"upstream error: %v"}`, err), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	for k, vs := range resp.Header {
		for _, v := range vs {
			w.Header().Add(k, v)
		}
	}
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

func (s *Server) proxyStream(w http.ResponseWriter, r *http.Request, upstreamURL, upstreamKey string, body []byte) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, `{"error":"streaming not supported"}`, http.StatusInternalServerError)
		return
	}

	proxyReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost, upstreamURL, bytes.NewReader(body))
	if err != nil {
		http.Error(w, `{"error":"proxy error"}`, http.StatusInternalServerError)
		return
	}
	proxyReq.Header.Set("Content-Type", "application/json")
	proxyReq.Header.Set("Authorization", "Bearer "+upstreamKey)

	client := &http.Client{Timeout: 300 * time.Second}
	resp, err := client.Do(proxyReq)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"upstream error: %v"}`, err), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(resp.StatusCode)
	flusher.Flush()

	buf := make([]byte, 4096)
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			w.Write(buf[:n])
			flusher.Flush()
		}
		if err != nil {
			break
		}
	}
}
