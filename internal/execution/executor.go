package execution

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/kode/kode/internal/graph"
	"github.com/kode/kode/internal/revert"
	"github.com/kode/kode/internal/verify"
)

type Executor struct {
	syntax         *verify.SyntaxChecker
	imports        *verify.ImportValidator
	calls          *verify.CallChecker
	architecture   *verify.ArchitectureChecker
	parser         *HunkParser
	correction     *SelfCorrectionEngine
	staticAnalysis *verify.StaticAnalysisChecker
}

func NewExecutor(projectRoot string) *Executor {
	moduleName := readModuleName(projectRoot)
	return &Executor{
		syntax:         verify.NewSyntaxChecker(),
		imports:        verify.NewImportValidator(projectRoot),
		calls:          verify.NewCallChecker(projectRoot),
		architecture:   verify.NewArchitectureCheckerWithModule(projectRoot, moduleName),
		parser:         NewHunkParser(),
		correction:     NewSelfCorrectionEngine(),
		staticAnalysis: verify.NewStaticAnalysisChecker(projectRoot),
	}
}

func readModuleName(projectRoot string) string {
	goModPath := filepath.Join(projectRoot, "go.mod")
	data, err := os.ReadFile(goModPath)
	if err != nil {
		return ""
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "module ") {
			return strings.TrimSpace(strings.TrimPrefix(line, "module "))
		}
	}
	return ""
}

func (e *Executor) ExecuteTransaction(ctx context.Context, taskID string, projectRoot string, initialHunks []StructuredHunk, reqCtx ExecutionContext) (*ExecutionSummary, error) {
	summary := &ExecutionSummary{
		TaskID:      taskID,
		Status:      StatusFail,
		FailedHunks: make(map[string]string),
	}

	// Initialize cumulative state from on-disk files
	cumulativeState := make(map[string]string)
	if err := e.loadFileState(cumulativeState, initialHunks, projectRoot, reqCtx.OriginalFiles); err != nil {
		return summary, fmt.Errorf("failed to load initial file state: %w", err)
	}

	// TDD mode: ensure test files exist before prod code is written
	fmt.Fprintf(os.Stderr, "KODE_GATE: tdd\n")
	if reqCtx.TDDMode {
		hasTest := false
		hasProd := false
		for _, h := range initialHunks {
			if verify.IsTestFile(h.FilePath) {
				hasTest = true
			} else {
				hasProd = true
			}
		}
		if hasProd && !hasTest {
			return summary, fmt.Errorf("TDD mode: write or modify a test file before modifying production code")
		}
		if hasTest {
			testCmd := reqCtx.TestCommand
			if testCmd == "" {
				testCmd = DetectTestCommand(projectRoot)
			}
			enforcer := verify.NewTDDEnforcer(projectRoot).WithTestCommand(testCmd)
			affectedFiles := make([]string, len(initialHunks))
			for i, h := range initialHunks {
				affectedFiles[i] = h.FilePath
			}
			result := enforcer.Check(affectedFiles, testCmd)
			if hasProd && result.TestRan && !result.TestPassed {
				summary.FailedHunks["tdd"] = verify.TDDSummary(result)
				return summary, fmt.Errorf("TDD mode: tests failed after applying changes: %s", verify.TDDSummary(result))
			}
		}
	}

	// Group hunks by file path, preserving order within each file
	hunksByFile := groupHunksByFile(initialHunks)

	activeHunks := flattenHunks(hunksByFile)
	var passingHunks []StructuredHunk
	var allPassingHunks []StructuredHunk

	for round := 1; round <= 3; round++ {
		summary.RoundsUsed = round
		var currentRoundFailed []StructuredHunk

		for _, hunk := range activeHunks {
			// Apply hunk to cumulative state
			modified, err := applyHunkToContent(cumulativeState[hunk.FilePath], hunk)
			if err != nil {
				summary.FailedHunks[hunk.ID] = fmt.Sprintf("anchor text not found after cumulative changes: %v", err)
				currentRoundFailed = append(currentRoundFailed, hunk)
				continue
			}
			cumulativeState[hunk.FilePath] = modified

			// Run verification checks on the modified file
			if fail := e.verifyHunk(hunk, modified, reqCtx); fail != nil {
				msg := fail.CheckName + ": " + fail.Message
				if fail.Details != "" {
					msg += " (" + fail.Details + ")"
				}
				summary.FailedHunks[hunk.ID] = msg

				// Roll back this hunk from cumulative state for retry
				cumulativeState[hunk.FilePath], _ = applyHunkToContent(modified, reverseHunk(hunk))

				currentRoundFailed = append(currentRoundFailed, hunk)
				continue
			}

			passingHunks = append(passingHunks, hunk)
			allPassingHunks = append(allPassingHunks, hunk)
			summary.AppliedHunks = append(summary.AppliedHunks, hunk.ID)
		}

		if len(currentRoundFailed) == 0 {
			summary.Status = StatusPass
			break
		}

		if round == 3 {
			return summary, fmt.Errorf("transaction aborted after %d rounds: %d hunks still failing", round, len(currentRoundFailed))
		}

		var repairedHunks []StructuredHunk
		for _, fh := range currentRoundFailed {
			if reqCtx.RepairFunc != nil {
				prompt := e.correction.BuildRepairPrompt(fh, summary.FailedHunks[fh.ID], allPassingHunks)
				repaired, err := reqCtx.RepairFunc(ctx, prompt, fh)
				if err == nil && len(repaired) > 0 {
					repairedHunks = append(repairedHunks, repaired...)
				}
			}
		}

		if len(repairedHunks) == 0 {
			summary.Status = StatusFail
			return summary, fmt.Errorf("self-correction produced no valid replacements for %d failed hunks", len(currentRoundFailed))
		}

		activeHunks = repairedHunks
		passingHunks = nil
	}

	if summary.Status == StatusPass {
		if err := e.commitToDisk(projectRoot, allPassingHunks, reqCtx.OriginalFiles, cumulativeState); err != nil {
			return summary, fmt.Errorf("disk commit failed: %w", err)
		}

		// Run Tier 2: Static Analysis (Type check / compilation check) on the committed files
		fmt.Fprintf(os.Stderr, "KODE_GATE: static_analysis\n")
		var changedFiles []string
		seen := make(map[string]bool)
		for _, hunk := range allPassingHunks {
			if !seen[hunk.FilePath] {
				seen[hunk.FilePath] = true
				changedFiles = append(changedFiles, hunk.FilePath)
			}
		}

		analysisRes := e.staticAnalysis.Check(ctx, changedFiles)
		if analysisRes.Status == verify.StatusFail {
			// Roll back the disk writes to restore the original files
			rollbackState := make(map[string]string)
			for filePath, originalContent := range reqCtx.OriginalFiles {
				rollbackState[filePath] = originalContent
			}
			// Write original contents back
			_ = e.commitToDisk(projectRoot, allPassingHunks, nil, rollbackState)

			summary.Status = StatusFail
			summary.FailedHunks["static_analysis"] = analysisRes.Message + ": " + analysisRes.Details
			return summary, fmt.Errorf("static analysis check failed (rolled back): %s (%s)", analysisRes.Message, analysisRes.Details)
		}
	}

	return summary, nil
}

type RepairFunc func(ctx context.Context, prompt string, hunk StructuredHunk) ([]StructuredHunk, error)

type ExecutionContext struct {
	OriginalFiles       map[string]string
	Graph               *graph.ContextGraph
	BlockOnArchitecture bool
	ArchitectureRules   []verify.ArchRule
	MaxBlastRadius      int
	TDDMode             bool
	TestCommand         string
	RepairFunc          RepairFunc
}

func (e *Executor) verifyHunk(hunk StructuredHunk, content string, ctx ExecutionContext) *verify.CheckResult {
	if !strings.HasSuffix(hunk.FilePath, ".go") {
		return nil
	}

	result := e.syntax.CheckFile(hunk.FilePath, content)
	if result.Status == verify.StatusFail {
		return &result
	}

	allowedInternal := make(map[string]bool)
	if ctx.Graph != nil {
		for _, node := range ctx.Graph.Nodes {
			if node.Kind == "import" || node.Kind == "file" {
				allowedInternal[node.FilePath] = true
			}
		}
	}
	allowedInternal[filepath.Dir(hunk.FilePath)] = true

	result = e.imports.Validate(hunk.FilePath, content, allowedInternal)
	if result.Status == verify.StatusFail {
		return &result
	}

	allowedPackages := make(map[string]bool)
	graphEntries := make(map[string]bool)
	if ctx.Graph != nil {
		for _, node := range ctx.Graph.Nodes {
			if node.Kind == "import" {
				allowedPackages[node.FilePath] = true
			}
		}
	}

	result = e.calls.CheckFile(hunk.FilePath, content, allowedPackages, graphEntries)
	if result.Status == verify.StatusFail {
		return &result
	}

	if len(ctx.ArchitectureRules) > 0 {
		result = e.architecture.CheckFile(hunk.FilePath, content, ctx.ArchitectureRules)
		if result.Status == verify.StatusFail && ctx.BlockOnArchitecture {
			return &result
		}
	}

	if ctx.MaxBlastRadius > 0 && ctx.Graph != nil {
		checker := verify.NewBlastRadiusChecker(ctx.Graph)
		results, ok := checker.CheckFile(hunk.FilePath, ctx.MaxBlastRadius)
		if !ok {
			return &verify.CheckResult{
				CheckName: "blast_radius",
				Status:    verify.StatusFail,
				Message:   checker.Summary(results, ctx.MaxBlastRadius),
			}
		}
	}

	return nil
}

func (e *Executor) VerifyFileContent(filePath string, content string, ctx ExecutionContext) *verify.CheckResult {
	if !strings.HasSuffix(filePath, ".go") {
		return nil
	}

	fmt.Fprintf(os.Stderr, "KODE_GATE: syntax\n")
	result := e.syntax.CheckFile(filePath, content)
	if result.Status == verify.StatusFail {
		return &result
	}

	allowedInternal := make(map[string]bool)
	if ctx.Graph != nil {
		for _, node := range ctx.Graph.Nodes {
			if node.Kind == "import" || node.Kind == "file" {
				allowedInternal[node.FilePath] = true
			}
		}
	}
	allowedInternal[filepath.Dir(filePath)] = true

	fmt.Fprintf(os.Stderr, "KODE_GATE: imports\n")
	result = e.imports.Validate(filePath, content, allowedInternal)
	if result.Status == verify.StatusFail {
		return &result
	}

	allowedPackages := make(map[string]bool)
	graphEntries := make(map[string]bool)
	if ctx.Graph != nil {
		for _, node := range ctx.Graph.Nodes {
			if node.Kind == "import" {
				allowedPackages[node.FilePath] = true
			}
		}
	}

	fmt.Fprintf(os.Stderr, "KODE_GATE: calls\n")
	result = e.calls.CheckFile(filePath, content, allowedPackages, graphEntries)
	if result.Status == verify.StatusFail {
		return &result
	}

	if len(ctx.ArchitectureRules) > 0 {
		fmt.Fprintf(os.Stderr, "KODE_GATE: architecture\n")
		result = e.architecture.CheckFile(filePath, content, ctx.ArchitectureRules)
		if result.Status == verify.StatusFail && ctx.BlockOnArchitecture {
			return &result
		}
	}

	return nil
}

func (e *Executor) loadFileState(state map[string]string, hunks []StructuredHunk, projectRoot string, originals map[string]string) error {
	for k, v := range originals {
		state[k] = v
	}

	for _, hunk := range hunks {
		if _, exists := state[hunk.FilePath]; exists {
			continue
		}
		absPath := filepath.Join(projectRoot, hunk.FilePath)
		data, err := os.ReadFile(absPath)
		if err != nil {
			state[hunk.FilePath] = ""
			continue
		}
		state[hunk.FilePath] = string(data)
	}
	return nil
}

func applyHunkToContent(content string, hunk StructuredHunk) (string, error) {
	switch hunk.Action {
	case ActionInsert:
		if hunk.AnchorText == "" {
			return content + "\n" + hunk.NewText, nil
		}
		idx := strings.Index(content, hunk.AnchorText)
		if idx < 0 {
			return "", fmt.Errorf("anchor text not found: %q", hunk.AnchorText)
		}
		insertAt := idx + len(hunk.AnchorText)
		return content[:insertAt] + "\n" + hunk.NewText + content[insertAt:], nil

	case ActionDelete:
		idx := strings.Index(content, hunk.AnchorText)
		if idx < 0 {
			return "", fmt.Errorf("anchor text not found: %q", hunk.AnchorText)
		}
		return content[:idx] + content[idx+len(hunk.AnchorText):], nil

	case ActionModify:
		idx := strings.Index(content, hunk.AnchorText)
		if idx < 0 {
			return "", fmt.Errorf("anchor text not found: %q", hunk.AnchorText)
		}
		return content[:idx] + hunk.NewText + content[idx+len(hunk.AnchorText):], nil

	default:
		return "", fmt.Errorf("unknown action: %s", hunk.Action)
	}
}

func reverseHunk(hunk StructuredHunk) StructuredHunk {
	rev := StructuredHunk{
		ID:       hunk.ID + "_reverse",
		FilePath: hunk.FilePath,
	}
	switch hunk.Action {
	case ActionInsert:
		rev.Action = ActionDelete
		rev.AnchorText = hunk.NewText
	case ActionDelete:
		rev.Action = ActionInsert
		rev.NewText = hunk.AnchorText
		rev.AnchorText = ""
	case ActionModify:
		rev.Action = ActionModify
		rev.AnchorText = hunk.NewText
		rev.NewText = hunk.AnchorText
	}
	return rev
}

func groupHunksByFile(hunks []StructuredHunk) map[string][]StructuredHunk {
	groups := make(map[string][]StructuredHunk)
	for _, h := range hunks {
		groups[h.FilePath] = append(groups[h.FilePath], h)
	}
	return groups
}

func flattenHunks(groups map[string][]StructuredHunk) []StructuredHunk {
	var result []StructuredHunk
	for _, hunks := range groups {
		result = append(result, hunks...)
	}
	return result
}

func (e *Executor) commitToDisk(root string, hunks []StructuredHunk, originalFiles map[string]string, finalState map[string]string) error {
	for _, hunk := range hunks {
		absPath := filepath.Join(root, hunk.FilePath)
		dir := filepath.Dir(absPath)
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("failed to create directory %s: %w", dir, err)
		}
	}

	for filePath, content := range finalState {
		participates := false
		for _, hunk := range hunks {
			if hunk.FilePath == filePath {
				participates = true
				break
			}
		}
		if !participates {
			continue
		}

		absPath := filepath.Join(root, filePath)
		if content == "" {
			if err := os.Remove(absPath); err != nil && !os.IsNotExist(err) {
				return fmt.Errorf("failed to remove %s: %w", absPath, err)
			}
		} else {
			origContent := originalFiles[filePath]
			if origContent != "" && origContent != content {
				origLines := strings.Split(origContent, "\n")
				revert.Record("auto", filePath, 1, len(origLines), origLines)
			}
			if err := os.WriteFile(absPath, []byte(content), 0644); err != nil {
				return fmt.Errorf("failed to write %s: %w", absPath, err)
			}
		}
	}
	return nil
}
