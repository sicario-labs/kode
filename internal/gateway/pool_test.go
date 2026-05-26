package gateway

import (
	"testing"
)

func TestKeyPoolCircuitBreaker(t *testing.T) {
	pool := NewKeyPool([]string{"key1", "key2", "key3"})

	if n := pool.HealthyCount(); n != 3 {
		t.Fatalf("expected 3 healthy keys, got %d", n)
	}

	// Fail key1 3 times → circuit broken
	for i := 0; i < 3; i++ {
		pool.ReportFailure("key1")
	}

	if n := pool.HealthyCount(); n != 2 {
		t.Errorf("expected 2 healthy keys after circuit break, got %d", n)
	}

	// Next should skip key1
	seen := make(map[string]bool)
	for i := 0; i < 20; i++ {
		k := pool.Next()
		if k == "" {
			t.Fatal("pool returned empty key")
		}
		seen[k] = true
	}

	if seen["key1"] {
		t.Error("circuit-broken key1 was returned by Next()")
	}
	if !seen["key2"] || !seen["key3"] {
		t.Error("healthy keys key2/key3 were not returned")
	}
}

func TestKeyPoolSuccessResetsFailureCount(t *testing.T) {
	pool := NewKeyPool([]string{"key1"})

	// 2 failures → not yet broken
	pool.ReportFailure("key1")
	pool.ReportFailure("key1")

	if n := pool.HealthyCount(); n != 1 {
		t.Fatalf("expected 1 healthy key after 2 failures, got %d", n)
	}

	// Success resets counter
	pool.ReportSuccess("key1")

	// 3 more failures should NOT break because counter was reset
	for i := 0; i < 3; i++ {
		pool.ReportFailure("key1")
	}

	if n := pool.HealthyCount(); n != 0 {
		t.Errorf("expected 0 healthy keys after 3 failures post-reset, got %d", n)
	}
}

func TestKeyPoolEmpty(t *testing.T) {
	pool := NewKeyPool(nil)
	if k := pool.Next(); k != "" {
		t.Errorf("expected empty key from nil pool, got %q", k)
	}
	if n := pool.HealthyCount(); n != 0 {
		t.Errorf("expected 0 healthy from nil pool, got %d", n)
	}
}

func TestKeyPoolRoundRobin(t *testing.T) {
	pool := NewKeyPool([]string{"a", "b"})

	first := pool.Next()
	second := pool.Next()
	if first == second {
		t.Errorf("expected round-robin to alternate, got %q twice", first)
	}

	// After 10 iterations, should see both keys
	seen := make(map[string]int)
	for i := 0; i < 10; i++ {
		seen[pool.Next()]++
	}
	if len(seen) != 2 {
		t.Errorf("expected 2 distinct keys, got %v", seen)
	}
}
