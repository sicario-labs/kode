package orchestrator

import (
	"context"
	"fmt"
	"os/exec"
	"strings"

	"github.com/kode/kode/internal/execution"
	"github.com/kode/kode/internal/llm"
)

type TestOracle struct {
	llmClient *llm.Client
	llmConfig llm.Config
}

func NewTestOracle(cfg llm.Config) *TestOracle {
	return &TestOracle{
		llmClient: llm.NewClient(cfg),
		llmConfig: cfg,
	}
}

type OracleResult struct {
	TestsAdded  []string
	BuildPassed bool
	TestOutput  string
	Hunks       []execution.StructuredHunk
}

func (o *TestOracle) ValidateAndTest(ctx context.Context, hunks []execution.StructuredHunk, projectRoot string, task string) (*OracleResult, error) {
	result := &OracleResult{}

	changedFiles := make(map[string]string)
	for _, h := range hunks {
		changedFiles[h.FilePath] = h.NewText
	}

	buildOK := o.runBuild(projectRoot)
	result.BuildPassed = buildOK

	var fileList []string
	for fp := range changedFiles {
		fileList = append(fileList, fp)
	}

	systemPrompt := `You are the Test & Build Oracle Agent. Given code changes and build results, your job is to:
1. Write tests for the changed code
2. Identify missing test coverage
3. Suggest test improvements
4. Output test files as structured hunks`

	userPrompt := fmt.Sprintf("Task: %s\n\nChanged files: %s\n\nBuild passed: %v\n\nWrite tests for these changes. Output each test file as a hunk.", task, strings.Join(fileList, ", "), buildOK)

	resp, err := o.llmClient.ChatWithRetry(ctx, llm.ChatRequest{
		Model:       o.llmConfig.Model,
		Messages:    []llm.Message{{Role: llm.RoleSystem, Content: systemPrompt}, {Role: llm.RoleUser, Content: userPrompt}},
		Temperature: 0.2,
		MaxTokens:   4096,
	}, llm.DefaultRetryConfig())
	if err != nil {
		return result, fmt.Errorf("test oracle failed: %w", err)
	}

	parser := execution.NewHunkParser()
	testHunks, parseErr := parser.ParseLLMResponse(resp.Choices[0].Message.Content)
	if parseErr == nil {
		result.Hunks = testHunks
		for _, h := range testHunks {
			if strings.Contains(h.FilePath, "_test") || strings.Contains(h.FilePath, "test_") {
				result.TestsAdded = append(result.TestsAdded, h.FilePath)
			}
		}
	}

	result.TestOutput = resp.Choices[0].Message.Content
	return result, nil
}

func (o *TestOracle) runBuild(projectRoot string) bool {
	cmds := []*exec.Cmd{
		exec.Command("go", "build", "./..."),
		exec.Command("npm", "run", "build"),
		exec.Command("cargo", "check"),
	}

	for _, cmd := range cmds {
		cmd.Dir = projectRoot
		out, err := cmd.CombinedOutput()
		if err == nil {
			return true
		}
		_ = out
	}

	return false
}

func (o *TestOracle) RunTests(ctx context.Context, projectRoot string) (string, error) {
	cmd := exec.CommandContext(ctx, "go", "test", "./...")
	cmd.Dir = projectRoot
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), fmt.Errorf("tests failed: %w", err)
	}
	return string(out), nil
}
