package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/spf13/cobra"
)

func init() {
	tuiCmd := &cobra.Command{
		Use:   "tui [-- args...]",
		Short: "Launch the Kode terminal UI",
		Long: `Launch the interactive Kode terminal user interface.

This runs the TypeScript TUI from the vendored opencode monorepo.
Additional arguments after -- are passed through to the TUI.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			return launchTUI(args)
		},
	}
	rootCmd.AddCommand(tuiCmd)
}

func launchTUI(passthroughArgs []string) error {
	selfPath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("cannot determine binary path: %w", err)
	}

	tuiDir, err := findTUIDir()
	if err != nil {
		return err
	}

	bunPath, err := exec.LookPath("bun")
	if err != nil {
		fmt.Fprintf(os.Stderr, "TUI requires bun and node_modules. Setup:\n")
		fmt.Fprintf(os.Stderr, "  1. npm install -g bun\n")
		fmt.Fprintf(os.Stderr, "  2. cd third_party/opencode && bun install\n")
		fmt.Fprintf(os.Stderr, "  3. kode tui\n")
		return fmt.Errorf("bun not found in PATH")
	}

	// Check node_modules exist
	if _, err := os.Stat(filepath.Join(tuiDir, "node_modules")); os.IsNotExist(err) {
		fmt.Fprintf(os.Stderr, "node_modules not found. Run: cd third_party/opencode && bun install\n")
		return fmt.Errorf("node_modules not installed")
	}

	bunArgs := append([]string{"run", "--conditions=browser", "./src/index.ts"}, passthroughArgs...)

	tuiCmd := exec.Command(bunPath, bunArgs...)
	tuiCmd.Dir = tuiDir
	tuiCmd.Stdin = os.Stdin
	tuiCmd.Stdout = os.Stdout
	tuiCmd.Stderr = os.Stderr
	tuiCmd.Env = append(os.Environ(), fmt.Sprintf("KODE_BIN=%s", selfPath))

	if err := tuiCmd.Run(); err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			os.Exit(exitErr.ExitCode())
		}
		return fmt.Errorf("TUI exited: %w", err)
	}
	return nil
}

func findTUIDir() (string, error) {
	selfPath, err := os.Executable()
	searchDirs := []string{}

	if err == nil {
		selfDir := filepath.Dir(selfPath)
		searchDirs = append(searchDirs,
			filepath.Join(selfDir, "..", "third_party", "opencode", "packages", "opencode"),
			filepath.Join(selfDir, "..", "..", "third_party", "opencode", "packages", "opencode"),
		)
	}

	cwd, _ := os.Getwd()
	if cwd != "" {
		searchDirs = append(searchDirs, filepath.Join(cwd, "third_party", "opencode", "packages", "opencode"))
	}

	for _, dir := range searchDirs {
		abs, err := filepath.Abs(dir)
		if err != nil {
			continue
		}
		if info, statErr := os.Stat(abs); statErr == nil && info.IsDir() {
			return abs, nil
		}
	}

	return "", fmt.Errorf("TUI directory not found. Expected at: third_party/opencode/packages/opencode/")
}
