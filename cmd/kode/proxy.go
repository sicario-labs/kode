package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
)

var goCommands = map[string]bool{
	"plan":         true,
	"init":         true,
	"generate":     true,
	"run":          true,
	"verify":       true,
	"verify-hunks": true,
	"loop":         true,
	"stats":        true,
	"tui":          true,
	"ts":           true,
	"help":         true,
	"completion":   true,
	"version":      true,
	"explain":      true,
	"install":      true,
	"daemon":       true,
	"golf":         true,
}

func isTSCommand(name string) bool {
	return !goCommands[name]
}

func init() {
	tsCmd := &cobra.Command{
		Use:   "ts [command] [args...]",
		Short: "Run a command from the Kode TS CLI",
		Long: `Forward a command to the TypeScript CLI.
Use this to access any Kode feature not exposed directly by the Go CLI.
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

func proxyCLI(args []string) error {
	return proxyEntry("./packages/kode/src/cli/cmd/index.ts", args)
}

func confirmInstall(label, command string) bool {
	if os.Getenv("KODE_NO_INSTALL") == "1" {
		return false
	}
	fmt.Fprintf(os.Stderr, "%s\n", label)
	fmt.Fprintf(os.Stderr, "  Command: %s\n", command)
	fmt.Fprintf(os.Stderr, "  Install now? [Y/n]: ")
	var response string
	fmt.Scanln(&response)
	response = strings.TrimSpace(strings.ToLower(response))
	return response == "" || response == "y" || response == "yes"
}

func proxyEntry(entry string, args []string) error {
	tuiDir, err := findTUIDir()
	if err != nil {
		// fallback: auto-download TUI
		tuiDir, err = ensureTUI()
		if err != nil {
			return fmt.Errorf("TUI not available: %w\nRun in CLI mode instead: kode <command>", err)
		}
	}

	bunPath, err := exec.LookPath("bun")
	if err != nil {
		fmt.Fprintf(os.Stderr, "TS runtime requires bun, but it's not in PATH.\n")
		if confirmInstall("Install bun?", "npm install -g bun") {
			installCmd := exec.Command("npm", "install", "-g", "bun")
			installCmd.Stdout = os.Stdout
			installCmd.Stderr = os.Stderr
			if err := installCmd.Run(); err != nil {
				return fmt.Errorf("failed to install bun: %w", err)
			}
			bunPath = "bun"
		} else {
			return fmt.Errorf("bun not found in PATH")
		}
	}

	nmDir := filepath.Join(tuiDir, "node_modules")
	if _, err := os.Stat(nmDir); os.IsNotExist(err) {
		fmt.Fprintf(os.Stderr, "node_modules not found in TUI directory.\n")
		if confirmInstall("Install TUI dependencies?", fmt.Sprintf("cd %s && bun install", tuiDir)) {
			installCmd := exec.Command(bunPath, "install")
			installCmd.Dir = tuiDir
			installCmd.Stdout = os.Stdout
			installCmd.Stderr = os.Stderr
			if err := installCmd.Run(); err != nil {
				return fmt.Errorf("failed to install TUI dependencies: %w", err)
			}
		} else {
			return fmt.Errorf("node_modules not installed")
		}
	}

	entryDir := tuiDir
	if strings.HasPrefix(entry, "./packages/kode/") {
		entryDir = filepath.Join(tuiDir, "packages", "kode")
		entry = strings.TrimPrefix(entry, "./packages/kode/")
	}

	selfPath, _ := os.Executable()
	bunArgs := append([]string{"run", "--conditions=browser", entry}, args...)

	tsCmd := exec.Command(bunPath, bunArgs...)
	tsCmd.Dir = entryDir
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
