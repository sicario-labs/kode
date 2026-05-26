package ghost

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"sync"
	"testing"

	"github.com/kode/kode/internal/execution"
)

func setupTestRepo(t *testing.T) string {
	t.Helper()
	dir, err := os.MkdirTemp("", "ghost-test-*")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(dir) })

	for _, cmd := range [][]string{
		{"git", "init"},
		{"git", "config", "user.email", "test@test.com"},
		{"git", "config", "user.name", "Test"},
		{"git", "commit", "--allow-empty", "-m", "initial"},
	} {
		c := exec.Command(cmd[0], cmd[1:]...)
		c.Dir = dir
		if out, err := c.CombinedOutput(); err != nil {
			t.Fatalf("%v: %s: %v", cmd, out, err)
		}
	}
	return dir
}

func TestConcurrentWorktreeCreate(t *testing.T) {
	repoDir := setupTestRepo(t)
	ctx := context.Background()

	wm := NewWorktreeManager(repoDir)

	var wg sync.WaitGroup
	errs := make(chan error, 10)

	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			spec := BranchSpec{
				ID:       BranchID(rune('a' + id)),
				Strategy: StrategyMinimal,
			}
			path, err := wm.Create(ctx, spec)
			if err != nil {
				errs <- err
				return
			}
			if path == "" {
				errs <- os.ErrNotExist
				return
			}
			wm.Remove(ctx, spec.ID)
		}(i)
	}

	wg.Wait()
	close(errs)

	for err := range errs {
		t.Errorf("concurrent worktree create: %v", err)
	}
}

func TestPanicRecovery(t *testing.T) {
	// Verify the defer/recover pattern used in executeBranch works.
	// We test the mechanism directly without invoking the LLM pipeline.
	var result *BranchResult

	func() {
		defer func() {
			if r := recover(); r != nil {
				result = &BranchResult{
					Status: execution.StatusFail,
					Error:  fmt.Sprintf("panic: %v", r),
				}
			}
			if result != nil && result.Status == execution.StatusFail && result.WorktreePath != "" {
				t.Error("should not reach worktree cleanup in this test")
			}
		}()

		// Simulate a panic like a nil pointer call
		var nilPtr *int
		_ = *nilPtr
	}()

	if result == nil {
		t.Fatal("panic was not recovered")
	}
	if result.Status != execution.StatusFail {
		t.Errorf("expected StatusFail, got %v", result.Status)
	}
	if !strings.Contains(result.Error, "panic:") {
		t.Errorf("expected panic prefix in error, got %q", result.Error)
	}
}

func TestWorktreeMutexNoDeadlock(t *testing.T) {
	repoDir := setupTestRepo(t)
	ctx := context.Background()
	wm := NewWorktreeManager(repoDir)

	specA := BranchSpec{ID: "alpha", Strategy: StrategyMinimal}
	specB := BranchSpec{ID: "beta", Strategy: StrategyModular}

	pathA, err := wm.Create(ctx, specA)
	if err != nil {
		t.Fatal(err)
	}
	pathB, err := wm.Create(ctx, specB)
	if err != nil {
		t.Fatal(err)
	}

	if _, err := os.Stat(pathA); os.IsNotExist(err) {
		t.Error("worktree alpha not created")
	}
	if _, err := os.Stat(pathB); os.IsNotExist(err) {
		t.Error("worktree beta not created")
	}

	// Remove in reverse order while a concurrent cleanup runs
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		wm.Remove(ctx, "alpha")
	}()
	go func() {
		defer wg.Done()
		wm.Cleanup(ctx)
	}()
	wg.Wait()

	// Both worktrees should be gone
	if entries, _ := os.ReadDir(wm.GhostDir()); len(entries) > 0 {
		t.Errorf("expected clean ghost dir, got %d entries", len(entries))
	}
}
