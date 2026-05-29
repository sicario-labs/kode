package gateway

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strings"
	"time"
)

// Shared HTTP clients — reuse TCP connections and TLS sessions across requests.
// This avoids the ~100-300ms overhead of a fresh TCP+TLS handshake on every call.
var sharedTransport = &http.Transport{
	MaxIdleConns:        100,
	MaxIdleConnsPerHost: 20,
	IdleConnTimeout:     90 * time.Second,
	TLSHandshakeTimeout: 10 * time.Second,
	ForceAttemptHTTP2:   true,
	DialContext: (&net.Dialer{
		Timeout:   10 * time.Second,
		KeepAlive: 30 * time.Second,
	}).DialContext,
	TLSClientConfig: &tls.Config{
		MinVersion: tls.VersionTLS12,
	},
}

var proxyClient = &http.Client{
	Transport: sharedTransport,
	Timeout:   120 * time.Second,
}

var streamClient = &http.Client{
	Transport: sharedTransport,
	Timeout:   300 * time.Second,
}

type UpstreamConfig struct {
	OpenAIKey      string
	AnthropicKey   string
	DeepSeekKey    string
	GoogleKey      string
	OpenRouterKey  string
	WebhookURL     string
}

type logEntry struct {
	Timestamp string `json:"timestamp"`
	Method    string `json:"method"`
	Path      string `json:"path"`
	Status    int    `json:"status"`
	Duration  string `json:"duration_ms"`
	IP        string `json:"ip"`
	Model     string `json:"model,omitempty"`
	Error     string `json:"error,omitempty"`
}

type Server struct {
	catalog     Catalog
	keyStore    *APIKeyStore
	upstream    UpstreamConfig
	litePool    *KeyPool
	rateLimiter *RateLimiter
	mux         *http.ServeMux
	monitor     *UsageMonitor
	modelIndex  map[string]Model // O(1) model lookups, built once at startup
}

func NewServer(catalog Catalog, upstream UpstreamConfig) *Server {
	s := &Server{
		catalog:      catalog,
		keyStore:     NewAPIKeyStore(),
		upstream:     upstream,
		litePool:     NewKeyPool(KeysFromEnv("KODE_LITE_KEYS")),
		rateLimiter:  NewRateLimiter(10000, 24*time.Hour),
		mux:          http.NewServeMux(),
		monitor:      NewUsageMonitor(1000),
		modelIndex:   make(map[string]Model, len(catalog.Models)),
	}

	// Build model index for O(1) lookups (replaces 3x linear scans per request)
	for _, m := range catalog.Models {
		s.modelIndex[m.ID] = m
	}

	s.mux.HandleFunc("GET /api/models", s.handleModels)
	s.mux.HandleFunc("POST /v1/chat/completions", s.handleChat)
	s.mux.HandleFunc("GET /health", s.handleHealth)
	s.mux.HandleFunc("POST /api/keys", s.handleAddKey)
	s.mux.HandleFunc("GET /api/monitor/usage", s.handleUsage)

	s.keyStore.SeedFromEnv()

	if len(s.litePool.Keys()) > 0 {
		startHealthCheck(s.litePool)
	}

	return s
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	ip := getClientIP(r)
	ctx := context.WithValue(r.Context(), "remote_ip", ip)
	r = r.WithContext(ctx)

	lrw := &loggingResponseWriter{ResponseWriter: w, statusCode: http.StatusOK}
	s.mux.ServeHTTP(lrw, r)

	// Async structured JSON logging — off the request critical path
	entry := logEntry{
		Timestamp: start.Format(time.RFC3339),
		Method:    r.Method,
		Path:      r.URL.Path,
		Status:    lrw.statusCode,
		Duration:  fmt.Sprintf("%.0f", float64(time.Since(start).Milliseconds())),
		IP:        ip,
	}
	go func() {
		out, _ := json.Marshal(entry)
		fmt.Fprintln(os.Stderr, string(out))
	}()
}

type loggingResponseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (lrw *loggingResponseWriter) WriteHeader(code int) {
	lrw.statusCode = code
	lrw.ResponseWriter.WriteHeader(code)
}

func (s *Server) maybeAlertLowPool() {
	healthy := s.litePool.HealthyCount()
	if healthy >= 2 || s.upstream.WebhookURL == "" {
		return
	}
	go func() {
		payload, _ := json.Marshal(map[string]any{
			"event":   "pool_low",
			"healthy": healthy,
			"total":   s.litePool.TotalKeys(),
			"time":    time.Now().Format(time.RFC3339),
		})
		http.Post(s.upstream.WebhookURL, "application/json", bytes.NewReader(payload))
	}()
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
	ip := getClientIP(r)
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

	// O(1) model lookup
	model, _ := s.modelIndex[req.Model]

	tier, _ := ResolveTier(apiKey, s.keyStore)
	s.monitor.Record(ip, req.Model, tier, 0, 0)

	// Route to upstream provider
	upstreamURL, upstreamKey, err := s.resolveUpstream(req.Model)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	if model.Tier == TierLite && model.Provider != "openrouter" {
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
	model, found := s.modelIndex[modelID]
	if !found {
		return "", "", fmt.Errorf("unknown model: %s", modelID)
	}

	if model.Tier == TierLite && model.Provider != "openrouter" {
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
	case "openrouter":
		return "https://openrouter.ai/api/v1/chat/completions", s.upstream.OpenRouterKey, nil
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

	resp, err := proxyClient.Do(proxyReq)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"upstream error: %v"}`, err), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	// Track pool key health for Lite-tier keys
	if upstreamURL == "https://api.openmodel.ai/v1/messages" {
		if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
			s.litePool.ReportFailure(upstreamKey)
		} else if resp.StatusCode == http.StatusOK {
			s.litePool.ReportSuccess(upstreamKey)
		}
	}

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

	resp, err := streamClient.Do(proxyReq)
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

func getClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		ips := strings.Split(xff, ",")
		if len(ips) > 0 {
			ip := strings.TrimSpace(ips[0])
			if ip != "" {
				return ip
			}
		}
	}
	if xrip := r.Header.Get("X-Real-IP"); xrip != "" {
		return strings.TrimSpace(xrip)
	}
	return FormatIP(r.RemoteAddr)
}
