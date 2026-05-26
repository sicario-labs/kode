package ghost

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

var worktreeMu sync.Mutex

func gitExec(ctx context.Context, repoDir string, name string, args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Dir = repoDir
	out, err := cmd.CombinedOutput()
	if ctx.Err() != nil {
		return out, fmt.Errorf("git operation timed out after 30s: %s %v", name, args)
	}
	return out, err
}

type WorktreeManager struct {
	repoDir  string
	ghostDir string
}

func NewWorktreeManager(repoDir string) *WorktreeManager {
	return &WorktreeManager{
		repoDir:  repoDir,
		ghostDir: filepath.Join(repoDir, ".kode", "ghost"),
	}
}

func (w *WorktreeManager) Create(ctx context.Context, spec BranchSpec) (string, error) {
	worktreeMu.Lock()
	defer worktreeMu.Unlock()

	branchName := fmt.Sprintf("ghost/%s", spec.ID)
	worktreePath := filepath.Join(w.ghostDir, string(spec.ID))

	if err := os.MkdirAll(w.ghostDir, 0755); err != nil {
		return "", fmt.Errorf("create ghost dir: %w", err)
	}

	// Inline cleanup of stale worktree (must NOT call w.Remove to avoid deadlock)
	if _, err := os.Stat(worktreePath); err == nil {
		gitExec(ctx, w.repoDir, "git", "worktree", "remove", worktreePath)
		gitExec(ctx, w.repoDir, "git", "branch", "-D", branchName)
		os.RemoveAll(worktreePath)
	}

	// Create branch from HEAD and add worktree
	gitExec(ctx, w.repoDir, "git", "branch", branchName)

	_, err := gitExec(ctx, w.repoDir, "git", "worktree", "add", worktreePath, branchName)
	if err != nil {
		gitExec(ctx, w.repoDir, "git", "branch", "-D", branchName)
		gitExec(ctx, w.repoDir, "git", "branch", branchName)
		if out2, err2 := gitExec(ctx, w.repoDir, "git", "worktree", "add", worktreePath, branchName); err2 != nil {
			return "", fmt.Errorf("create worktree: %s: %w", string(out2), err2)
		}
	}

	return worktreePath, nil
}

func (w *WorktreeManager) Remove(ctx context.Context, id BranchID) error {
	worktreeMu.Lock()
	defer worktreeMu.Unlock()

	worktreePath := filepath.Join(w.ghostDir, string(id))
	gitExec(ctx, w.repoDir, "git", "worktree", "remove", worktreePath)

	branchName := fmt.Sprintf("ghost/%s", id)
	gitExec(ctx, w.repoDir, "git", "branch", "-D", branchName)

	os.RemoveAll(worktreePath)
	return nil
}

func (w *WorktreeManager) MergeWinner(ctx context.Context, id BranchID) error {
	worktreeMu.Lock()
	defer worktreeMu.Unlock()

	branchName := fmt.Sprintf("ghost/%s", id)
	if out, err := gitExec(ctx, w.repoDir, "git", "merge", "--squash", branchName); err != nil {
		if out2, err2 := gitExec(ctx, w.repoDir, "git", "merge", "--squash", "--allow-unrelated-histories", branchName); err2 != nil {
			return fmt.Errorf("merge failed: %s: %w", string(out2), err2)
		}
		_ = string(out)
	}
	return nil
}

func (w *WorktreeManager) SwitchBack(ctx context.Context) error {
	_, err := gitExec(ctx, w.repoDir, "git", "checkout", "-")
	return err
}

func (w *WorktreeManager) GhostDir() string {
	return w.ghostDir
}

func (w *WorktreeManager) CurrentBranch() string {
	out, err := gitExec(context.Background(), w.repoDir, "git", "rev-parse", "--abbrev-ref", "HEAD")
	if err != nil {
		return "main"
	}
	return strings.TrimSpace(string(out))
}

func (w *WorktreeManager) Cleanup(ctx context.Context) {
	entries, err := os.ReadDir(w.ghostDir)
	if err != nil {
		return
	}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		w.Remove(ctx, BranchID(e.Name()))
	}
}
