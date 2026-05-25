package gateway

import (
	"context"
	"fmt"
	"net"
	"os"
	"sync"
	"time"
)

type RateLimiter struct {
	mu    sync.Mutex
	ips   map[string]*ipState
	limit int
	win   time.Duration
}

type ipState struct {
	count    int
	windowAt time.Time
}

func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		ips:   make(map[string]*ipState),
		limit: limit,
		win:   window,
	}
}

func (rl *RateLimiter) Allow(ip string) (int, int, time.Duration) {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	st, ok := rl.ips[ip]
	if !ok || now.After(st.windowAt.Add(rl.win)) {
		rl.ips[ip] = &ipState{count: 1, windowAt: now}
		return 1, rl.limit, rl.win
	}

	st.count++
	remaining := rl.limit - st.count
	resetAt := st.windowAt.Add(rl.win).Sub(now)
	return st.count, remaining, resetAt
}

func (rl *RateLimiter) Blocked(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	st, ok := rl.ips[ip]
	if !ok {
		return false
	}
	if time.Now().After(st.windowAt.Add(rl.win)) {
		delete(rl.ips, ip)
		return false
	}
	return st.count >= rl.limit
}

func extractIP(ctx context.Context) string {
	// Best-effort IP extraction from context value set by HTTP server
	if ip, ok := ctx.Value("remote_ip").(string); ok && ip != "" {
		return ip
	}
	return "127.0.0.1"
}

type APIKeyStore struct {
	mu   sync.RWMutex
	keys map[string]APIKeyInfo
}

type APIKeyInfo struct {
	Key       string    `json:"key"`
	Tier      Tier      `json:"tier"`
	UserID    string    `json:"user_id"`
	Email     string    `json:"email,omitempty"`
	ProExpiry time.Time `json:"pro_expiry,omitempty"`
	Balance   int       `json:"balance,omitempty"` // in cents (for tracked usage)
}

func NewAPIKeyStore() *APIKeyStore {
	return &APIKeyStore{
		keys: make(map[string]APIKeyInfo),
	}
}

func (s *APIKeyStore) Lookup(key string) (APIKeyInfo, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	info, ok := s.keys[key]
	return info, ok
}

func (s *APIKeyStore) Add(info APIKeyInfo) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.keys[info.Key] = info
}

func ResolveTier(apiKey string, store *APIKeyStore) (Tier, string) {
	if apiKey == "" || apiKey == "public" {
		return TierLite, ""
	}
	info, ok := store.Lookup(apiKey)
	if !ok {
		return TierLite, "unknown-key"
	}
	if info.Tier == TierPro && time.Now().After(info.ProExpiry) {
		return TierLite, "pro-expired"
	}
	return info.Tier, ""
}

func ModelsForTier(catalog Catalog, tier Tier) []Model {
	var out []Model
	for _, m := range catalog.Models {
		switch tier {
		case TierLite:
			if m.Tier == TierLite {
				out = append(out, m)
			}
		case TierPro:
			if m.Tier == TierLite || m.Tier == TierPro {
				out = append(out, m)
			}
		}
	}
	return out
}

func VerifyUsage(apiKey string, modelID string, catalog Catalog, store *APIKeyStore) error {
	tier, rejectReason := ResolveTier(apiKey, store)
	if rejectReason != "" {
		return fmt.Errorf("access denied: %s", rejectReason)
	}

	allowed := ModelsForTier(catalog, tier)
	for _, m := range allowed {
		if m.ID == modelID {
			return nil
		}
	}
	return fmt.Errorf("model %s not available on %s tier", modelID, tier)
}

func FormatIP(addr string) string {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return addr
	}
	return host
}

func (s *APIKeyStore) SeedFromEnv() {
	if key := os.Getenv("KODE_PRO_API_KEY"); key != "" {
		s.Add(APIKeyInfo{Key: key, Tier: TierPro, UserID: "seed-pro", ProExpiry: time.Now().Add(365 * 24 * time.Hour)})
	}
}
