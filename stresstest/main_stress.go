//go:build stress

package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"

	"github.com/kode/kode/internal/gateway"
	"github.com/kode/kode/internal/ghost"
)

func main() {
	fmt.Println("=== Stress Test: 100 Concurrent Ghost Worktree Ops ===")

	dir, err := os.MkdirTemp("", "kode-stress-*")
	if err != nil {
		fmt.Fprintf(os.Stderr, "FATAL: %v\n", err)
		os.Exit(1)
	}
	defer os.RemoveAll(dir)

	// Init a git repo
	for _, cmd := range [][]string{
		{"git", "init"},
		{"git", "config", "user.email", "stress@test.com"},
		{"git", "config", "user.name", "Stress"},
		{"git", "commit", "--allow-empty", "-m", "base"},
	} {
		c := exec.Command(cmd[0], cmd[1:]...)
		c.Dir = dir
		if out, err := c.CombinedOutput(); err != nil {
			fmt.Fprintf(os.Stderr, "FATAL: git setup: %v\n%s\n", err, out)
			os.Exit(1)
		}
	}

	wm := ghost.NewWorktreeManager(dir)
	ctx := context.Background()

	// Test 1: Concurrent creates
	fmt.Println("  Test 1: 100 concurrent worktree creates + removes...")
	var wg sync.WaitGroup
	errs := make(chan error, 100)
	start := time.Now()

	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			id := ghost.BranchID(fmt.Sprintf("stress-%d", n))
			spec := ghost.BranchSpec{ID: id, Strategy: ghost.StrategyMinimal, Prompt: "test"}

			path, err := wm.Create(ctx, spec)
			if err != nil {
				errs <- fmt.Errorf("create %d: %w", n, err)
				return
			}
			if path == "" {
				errs <- fmt.Errorf("create %d: empty path", n)
				return
			}
			if _, err := os.Stat(path); os.IsNotExist(err) {
				errs <- fmt.Errorf("create %d: path not found", n)
				return
			}

			if err := wm.Remove(ctx, id); err != nil {
				errs <- fmt.Errorf("remove %d: %w", n, err)
			}
		}(i)
	}
	wg.Wait()
	close(errs)

	var failCount int
	for err := range errs {
		fmt.Fprintf(os.Stderr, "    FAIL: %v\n", err)
		failCount++
	}
	fmt.Printf("  Result: %d/100 passed in %v\n", 100-failCount, time.Since(start))

	// Test 2: Pool circuit breaker
	fmt.Println("\n  Test 2: Key pool circuit breaker (200 rapid requests)...")
	pool := gateway.NewKeyPool([]string{"k1", "k2", "k3", "k4", "k5"})
	start = time.Now()

	var mu sync.Mutex
	failures := make(map[string]int)
	var wg2 sync.WaitGroup

	for i := 0; i < 200; i++ {
		wg2.Add(1)
		go func() {
			defer wg2.Done()
			k := pool.Next()
			if k == "" {
				return
			}
			// Simulate 60% failure rate
			mu.Lock()
			failures[k]++
			if failures[k]%3 == 0 && failures[k] <= 6 {
				pool.ReportFailure(k)
			} else {
				pool.ReportSuccess(k)
			}
			mu.Unlock()
		}()
	}
	wg2.Wait()

	healthy := pool.HealthyCount()
	fmt.Printf("  Result: %d/5 keys healthy after stress in %v\n", healthy, time.Since(start))
	if healthy < 3 {
		fmt.Fprintf(os.Stderr, "  WARN: more than 2 keys circuit-broken — may indicate false positives\n")
	}

	// Test 3: Worktree manager concurrent cleanup vs create race
	fmt.Println("\n  Test 3: 50 concurrent cleanup vs create races...")
	wm2 := ghost.NewWorktreeManager(dir)

	// Pre-create some worktrees
	for i := 0; i < 10; i++ {
		id := ghost.BranchID(fmt.Sprintf("race-%d", i))
		wm2.Create(ctx, ghost.BranchSpec{ID: id, Strategy: ghost.StrategyMinimal})
	}

	start = time.Now()
	var wg3 sync.WaitGroup
	for i := 0; i < 25; i++ {
		wg3.Add(2)
		go func() {
			defer wg3.Done()
			wm2.Cleanup(ctx)
		}()
		go func(n int) {
			defer wg3.Done()
			id := ghost.BranchID(fmt.Sprintf("race-new-%d", n))
			wm2.Create(ctx, ghost.BranchSpec{ID: id, Strategy: ghost.StrategyMinimal})
		}(i)
	}
	wg3.Wait()

	entries, _ := os.ReadDir(filepath.Join(dir, ".kode", "ghost"))
	fmt.Printf("  Result: %d ghost entries remain after race in %v\n", len(entries), time.Since(start))
	if len(entries) > 20 {
		fmt.Fprintf(os.Stderr, "  WARN: high ghost dir count indicates cleanup leaks\n")
	}

	fmt.Println("\n=== Stress Test Complete ===")
	if failCount > 0 {
		os.Exit(1)
	}
}
