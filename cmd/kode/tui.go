package main

import (
	"archive/tar"
	"compress/gzip"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/spf13/cobra"
)

const tuiDirName = "tui"
const tuiBundleFile = "tui-bundle.tar.gz"

func init() {
	tuiCmd := &cobra.Command{
		Use:   "tui [-- args...]",
		Short: "Launch the Kode terminal UI",
		Long: `Launch the interactive Kode terminal user interface.

This runs the TypeScript TUI from the vendored monorepo.
Additional arguments after -- are passed through to the TUI.

On first run, the TUI bundle is automatically downloaded from GitHub Releases.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			return runTUI(args)
		},
	}
	rootCmd.AddCommand(tuiCmd)
}

func runTUI(args []string) error {
	tuiDir, err := resolveTUIDir()
	if err != nil {
		return err
	}
	return proxyTUI(tuiDir, args)
}

func resolveTUIDir() (string, error) {
	// Try to find an existing TUI directory
	dir, err := findTUIDir()
	if err == nil {
		return dir, nil
	}

	// Auto-download on first launch
	dir, err = ensureTUI()
	if err != nil {
		return "", fmt.Errorf("TUI not available: %w\nRun in CLI mode instead: kode <command>", err)
	}
	return dir, nil
}

func findTUIDir() (string, error) {
	// Allow override via env var
	if env := os.Getenv("KODE_TUI_DIR"); env != "" {
		if info, err := os.Stat(env); err == nil && info.IsDir() {
			return env, nil
		}
	}

	selfPath, err := os.Executable()
	searchDirs := []string{}

	if err == nil {
		selfDir := filepath.Dir(selfPath)
		searchDirs = append(searchDirs,
			filepath.Join(selfDir, "..", "vendor", "opencode"),
			filepath.Join(selfDir, "..", "..", "vendor", "opencode"),
		)
	}

	cwd, _ := os.Getwd()
	if cwd != "" {
		searchDirs = append(searchDirs, filepath.Join(cwd, "vendored", "opencode"))
	}

	// Check ~/.kode/tui/ (downloaded bundle)
	homeDir, _ := os.UserHomeDir()
	if homeDir != "" {
		searchDirs = append(searchDirs, filepath.Join(homeDir, ".kode", tuiDirName))
	}

	bundleDir := ""
	if homeDir != "" {
		bundleDir = filepath.Join(homeDir, ".kode", tuiDirName)
	}

	for _, dir := range searchDirs {
		abs, err := filepath.Abs(dir)
		if err != nil {
			continue
		}
		if info, statErr := os.Stat(abs); statErr == nil && info.IsDir() {
			// For downloaded bundles (~/.kode/tui/), verify version matches
			if bundleDir != "" && abs == bundleDir {
				match, _ := versionMatches(abs)
				if !match {
					continue
				}
			}
			return abs, nil
		}
	}

	return "", fmt.Errorf("TUI directory not found")
}

func ensureTUI() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("cannot determine home directory: %w", err)
	}

	kodeDir := filepath.Join(homeDir, ".kode")
	tuiDir := filepath.Join(kodeDir, tuiDirName)

	// Already exists? Verify version matches
	if info, err := os.Stat(tuiDir); err == nil && info.IsDir() {
		match, _ := versionMatches(tuiDir)
		if match {
			return tuiDir, nil
		}
		// Stale download — remove and re-download
		os.RemoveAll(tuiDir)
	}

	tag := version
	if tag == "" || tag == "dev" || tag == "none" {
		tag = "latest"
	}

	var url string
	if tag == "latest" {
		url = fmt.Sprintf("https://github.com/sicario-labs/kode/releases/latest/download/%s", tuiBundleFile)
	} else {
		v := strings.TrimPrefix(tag, "v")
		url = fmt.Sprintf("https://github.com/sicario-labs/kode/releases/download/v%s/%s", v, tuiBundleFile)
	}

	// Allow override via env var
	if env := os.Getenv("KODE_TUI_BUNDLE_URL"); env != "" {
		url = env
	}

	fmt.Fprintf(os.Stderr, "Downloading TUI bundle (~52 MB) from GitHub Releases...\n")

	if err := os.MkdirAll(kodeDir, 0755); err != nil {
		return "", fmt.Errorf("create kode dir: %w", err)
	}

	if err := downloadAndExtract(url, kodeDir); err != nil {
		os.RemoveAll(tuiDir)
		return "", fmt.Errorf("download TUI: %w", err)
	}

	fmt.Fprintf(os.Stderr, "TUI bundle extracted to %s\n", tuiDir)
	return tuiDir, nil
}

func downloadAndExtract(url, destDir string) error {
	resp, err := http.Get(url)
	if err != nil {
		return fmt.Errorf("HTTP GET: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	gzr, err := gzip.NewReader(resp.Body)
	if err != nil {
		return fmt.Errorf("gzip: %w", err)
	}
	defer gzr.Close()

	tr := tar.NewReader(gzr)

	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("tar: %w", err)
		}

		// Strip the top-level directory (e.g. "tui/")
		parts := strings.SplitN(header.Name, "/", 2)
		if len(parts) < 2 || parts[0] != tuiDirName {
			continue
		}
		rel := parts[1]
		if rel == "" {
			continue
		}

		target := filepath.Join(destDir, tuiDirName, rel)

		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, os.FileMode(header.Mode)); err != nil {
				return fmt.Errorf("mkdir %s: %w", target, err)
			}
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
				return fmt.Errorf("mkdir %s: %w", target, err)
			}
			f, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY, os.FileMode(header.Mode))
			if err != nil {
				return fmt.Errorf("create %s: %w", target, err)
			}
			if _, err := io.Copy(f, tr); err != nil {
				f.Close()
				return fmt.Errorf("write %s: %w", target, err)
			}
			f.Close()
		}
	}

	return nil
}

func proxyTUI(tuiDir string, passthroughArgs []string) error {
	selfPath, _ := os.Executable()

	// Try compiled TUI binary first (instant, no bun needed)
	if binary := findTUIBinary(tuiDir); binary != "" {
		return runTUIBinary(binary, passthroughArgs, selfPath)
	}

	// Fall back to bun run with source files
	bunPath, err := exec.LookPath("bun")
	if err != nil {
		fmt.Fprintf(os.Stderr, "TUI requires bun (JavaScript runtime).\n")
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
		fmt.Fprintf(os.Stderr, "Installing TUI dependencies (bun install)...\n")
		installCmd := exec.Command(bunPath, "install")
		installCmd.Dir = tuiDir
		installCmd.Stdout = os.Stdout
		installCmd.Stderr = os.Stderr
		if err := installCmd.Run(); err != nil {
			fmt.Fprintf(os.Stderr, "Warning: bun install failed. Run 'cd %s && bun install' to retry.\n", tuiDir)
		}
	}

	entry := "./packages/opencode/src/index.ts"
	bunArgs := append([]string{"run", "--conditions=browser", entry}, passthroughArgs...)

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
		return fmt.Errorf("TUI exited: %w", err)
	}
	return nil
}

func versionMatches(tuiDir string) (bool, error) {
	if version == "" || version == "dev" || version == "none" {
		return true, nil
	}
	data, err := os.ReadFile(filepath.Join(tuiDir, ".kode-version"))
	if err != nil {
		return false, err
	}
	return strings.TrimSpace(string(data)) == version, nil
}

func findTUIBinary(tuiDir string) string {
	binName := "kode-tui"
	if runtime.GOOS == "windows" {
		binName = "kode-tui.exe"
	}
	candidate := filepath.Join(tuiDir, "bin", binName)
	if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
		return candidate
	}
	return ""
}

func runTUIBinary(binary string, args []string, selfPath string) error {
	cmd := exec.Command(binary, args...)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Env = append(os.Environ(), fmt.Sprintf("KODE_BIN=%s", selfPath))
	if err := cmd.Run(); err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			os.Exit(exitErr.ExitCode())
		}
		return fmt.Errorf("TUI exited: %w", err)
	}
	return nil
}
