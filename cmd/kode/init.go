package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
)

type kodeConfig struct {
	Schema       string                `json:"$schema,omitempty"`
	Model        string                `json:"model,omitempty"`
	SmallModel   string                `json:"small_model,omitempty"`
	Instructions []string              `json:"instructions,omitempty"`
	Skills       *kodeConfigSkills     `json:"skills,omitempty"`
	MCP          map[string]kodeMCP    `json:"mcp,omitempty"`
	Permission   *kodeConfigPermission `json:"permission,omitempty"`
}

type kodeConfigSkills struct {
	Paths []string `json:"paths,omitempty"`
}

type kodeConfigPermission struct {
	Edit string `json:"edit,omitempty"`
	Bash string `json:"bash,omitempty"`
}

type kodeMCP struct {
	Type    string            `json:"type"`
	Command []string          `json:"command,omitempty"`
	URL     string            `json:"url,omitempty"`
	Env     map[string]string `json:"env,omitempty"`
}

func init() {
	initCmd := &cobra.Command{
		Use:   "init [directory]",
		Short: "Scaffold a .kode config directory",
		Long: `Create a .kode configuration directory with a default kode.json file.

If no directory is given, the current working directory is used.
The command creates:
  .kode/kode.json     — main project configuration`,
		Args: cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			dir := "."
			if len(args) > 0 {
				dir = args[0]
			}

			absDir, err := filepath.Abs(dir)
			if err != nil {
				return fmt.Errorf("cannot resolve path: %w", err)
			}

			kodeDir := filepath.Join(absDir, ".kode")
			if err := os.MkdirAll(kodeDir, 0755); err != nil {
				return fmt.Errorf("cannot create .kode directory: %w", err)
			}

			configFile := filepath.Join(kodeDir, "kode.json")
			if _, err := os.Stat(configFile); err == nil {
				fmt.Fprintf(os.Stderr, "kode.json already exists at %s\n", configFile)
				return nil
			}

			cfg := kodeConfig{
				Schema:       "https://trykode.xyz/config.json",
				Model:        "anthropic/claude-sonnet-4-6",
				SmallModel:   "anthropic/claude-haiku-4-5",
				Instructions: []string{"AGENTS.md"},
				Permission: &kodeConfigPermission{
					Edit: "ask",
					Bash: "ask",
				},
			}

			data, err := json.MarshalIndent(cfg, "", "  ")
			if err != nil {
				return fmt.Errorf("cannot marshal config: %w", err)
			}

			if err := os.WriteFile(configFile, data, 0644); err != nil {
				return fmt.Errorf("cannot write kode.json: %w", err)
			}

			fmt.Fprintf(os.Stderr, "Initialized Kode project in %s\n", kodeDir)
			fmt.Fprintf(os.Stderr, "  %s\n", configFile)
			return nil
		},
	}
	rootCmd.AddCommand(initCmd)
}
