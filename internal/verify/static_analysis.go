package verify

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type StaticAnalysisChecker struct {
	projectRoot string
}

func NewStaticAnalysisChecker(projectRoot string) *StaticAnalysisChecker {
	return &StaticAnalysisChecker{projectRoot: projectRoot}
}

func (s *StaticAnalysisChecker) Check(ctx context.Context, changedFiles []string) CheckResult {
	res := CheckResult{CheckName: "static_analysis", Status: StatusPass}

	cmdStr := s.detectCheckCommand(changedFiles)
	if cmdStr == "" {
		return res
	}

	parts := strings.Fields(cmdStr)
	if len(parts) == 0 {
		return res
	}

	c := exec.CommandContext(ctx, parts[0], parts[1:]...)
	c.Dir = s.projectRoot
	out, err := c.CombinedOutput()
	if err != nil {
		res.Status = StatusFail
		res.Message = fmt.Sprintf("Static analysis check failed (command: %s)", cmdStr)
		res.Details = string(out)
	}

	return res
}

func (s *StaticAnalysisChecker) detectCheckCommand(changedFiles []string) string {
	// Detect based on file patterns in changed files or project config
	hasGo := false
	hasTS := false
	hasPy := false
	hasRust := false

	for _, file := range changedFiles {
		lang := DetectLanguage(file)
		switch lang {
		case LangGo:
			hasGo = true
		case LangTypeScript:
			hasTS = true
		case LangPython:
			hasPy = true
		case LangRust:
			hasRust = true
		}
	}

	if hasGo && s.fileExists("go.mod") {
		return "go vet ./..."
	}
	if hasRust && s.fileExists("Cargo.toml") {
		return "cargo check"
	}
	if hasTS && s.fileExists("package.json") {
		// Try to see if typecheck script exists
		if s.hasPackageJsonScript("typecheck") {
			return "npm run typecheck"
		}
		return "npx tsc --noEmit"
	}
	if hasPy {
		// Use python py_compile as a fast incremental syntax/compilation check
		pythonCmd := "python"
		if _, err := exec.LookPath("python3"); err == nil {
			pythonCmd = "python3"
		}
		var filesToCompile []string
		for _, file := range changedFiles {
			if DetectLanguage(file) == LangPython {
				filesToCompile = append(filesToCompile, file)
			}
		}
		if len(filesToCompile) > 0 {
			return fmt.Sprintf("%s -m py_compile %s", pythonCmd, strings.Join(filesToCompile, " "))
		}
	}

	return ""
}

func (s *StaticAnalysisChecker) fileExists(name string) bool {
	_, err := os.Stat(filepath.Join(s.projectRoot, name))
	return err == nil
}

func (s *StaticAnalysisChecker) hasPackageJsonScript(scriptName string) bool {
	data, err := os.ReadFile(filepath.Join(s.projectRoot, "package.json"))
	if err != nil {
		return false
	}
	// Simple string check to avoid complex json unmarshal overhead
	return strings.Contains(string(data), fmt.Sprintf(`"%s":`, scriptName))
}
