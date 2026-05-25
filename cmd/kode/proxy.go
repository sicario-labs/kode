package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/spf13/cobra"
)

var goCommands = map[string]bool{
	"plan":       true,
	"init":       true,
	"generate":   true,
	"run":        true,
	"verify":     true,
	"verify-hunks": true,
	"loop":       true,
	"stats":      true,
	"tui":        true,
	"ts":         true,
	"help":       true,
	"completion": true,
}

func isTSCommand(name string) bool {
	return !goCommands[name]
}

func init() {
	tsCmd := &cobra.Command{
		Use:   "ts [command] [args...]",
		Short: "Run an opencode-compatible command from the TS CLI",
		Long: `Forward a command to the TypeScript CLI (vendored opencode).
Use this to access any opencode feature not exposed directly by Kode's Go CLI.
Examples:
  kode ts models
  kode ts providers list
  kode ts session list`,
		RunE: func(cmd *cobra.Command, args []string) error {
			return proxyCLI(args)
		},
	}
	rootCmd.AddCommand(tsCmd)
}

func proxyTUI(passthroughArgs []string) error {
	return proxyEntry("./packages/opencode/src/index.ts", passthroughArgs)
}

func proxyCLI(args []string) error {
	return proxyEntry("./packages/opencode/src/cli/cmd/index.ts", args)
}

func proxyEntry(entry string, args []string) error {
	tuiDir, err := findTUIDir()
	if err != nil {
		return err
	}

	bunPath, err := exec.LookPath("bun")
	if err != nil {
		fmt.Fprintf(os.Stderr, "TS runtime requires bun. Install with: npm install -g bun\n")
		fmt.Fprintf(os.Stderr, "Then: cd vendored/opencode && bun install\n")
		return fmt.Errorf("bun not found in PATH")
	}

	nmDir := filepath.Join(tuiDir, "node_modules")
	if _, err := os.Stat(nmDir); os.IsNotExist(err) {
		fmt.Fprintf(os.Stderr, "node_modules not found. Run: cd vendored/opencode && bun install\n")
		return fmt.Errorf("node_modules not installed")
	}

	selfPath, _ := os.Executable()
	bunArgs := append([]string{"run", "--conditions=browser", entry}, args...)

	tsCmd := exec.Command(bunPath, bunArgs...)
	tsCmd.Dir = tuiDir
	tsCmd.Stdin = os.Stdin
	tsCmd.Stdout = os.Stdout
	tsCmd.Stderr = os.Stderr
	tsCmd.Env = append(os.Environ(), fmt.Sprintf("KODE_BIN=%s", selfPath))

	if err := tsCmd.Run(); err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			os.Exit(exitErr.ExitCode())
		}
		return fmt.Errorf("TS CLI exited: %w", err)
	}
	return nil
}
