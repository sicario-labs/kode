package main

import (
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
)

var (
	version = "dev"
	commit  = "none"
	date    = "unknown"
)

var rootCmd = &cobra.Command{
	Use:   "kode",
	Short: "Kode — the contrarian AI coding agent",
	Long: `Kode is an AI coding agent that prioritizes verification over generation,
architectural integrity over raw output, and deterministic gates over probabilistic guesses.

Built as a functional architecture hijack of opencode, Kode replaces the
"generate-and-pray" paradigm with a structured Plan -> Critique -> Generate -> Verify -> Apply -> Test workflow.

Unknown commands are forwarded to the vendored opencode TypeScript CLI, giving you
access to all opencode features (models, providers, sessions, agents, etc.).`,
	Run: func(cmd *cobra.Command, args []string) {
		if err := runTUI(args); err != nil {
			cmd.Help()
		}
	},
	Version: version,
}

func init() {
	versionCmd := &cobra.Command{
		Use:   "version",
		Short: "Print the version number of Kode",
		Run: func(cmd *cobra.Command, args []string) {
			fmt.Printf("kode %s (commit: %s, date: %s)\n", version, commit, date)
		},
	}
	rootCmd.AddCommand(versionCmd)
}

func main() {
	args := os.Args[1:]
	if len(args) > 0 && !strings.HasPrefix(args[0], "-") {
		if isTSCommand(args[0]) {
			if err := proxyCLI(args); err != nil {
				fmt.Fprintf(os.Stderr, "error: %v\n", err)
				os.Exit(1)
			}
			return
		}
	}

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}
