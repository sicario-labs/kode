package orchestrator

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/kode/kode/internal/execution"
	"github.com/kode/kode/internal/llm"
)

type AgentType string

const (
	AgentMain            AgentType = "main"
	AgentCodebaseResearcher AgentType = "researcher"
	AgentTestOracle      AgentType = "test-oracle"
)

type SubTask struct {
	ID        string
	Agent     AgentType
	Prompt    string
	Context   string
	Priority  int
	DependsOn []string
}

type SubTaskResult struct {
	SubTaskID string
	Agent     AgentType
	Output    string
	Hunks     []execution.StructuredHunk
	Error     error
	Duration  time.Duration
}

type Orchestrator struct {
	llmClient *llm.Client
	llmConfig llm.Config
	repo      *TaskRepo
	mu        sync.Mutex
}

func New(llmCfg llm.Config) *Orchestrator {
	return &Orchestrator{
		llmClient: llm.NewClient(llmCfg),
		llmConfig: llmCfg,
		repo:      NewTaskRepo(),
	}
}

func (o *Orchestrator) Decompose(ctx context.Context, task string, projectRoot string) ([]SubTask, error) {
	systemPrompt := `You are a Kode Orchestrator. Decompose the given task into subtasks for specialized agents.
Available agents:
- main: Primary coding agent — implements changes, writes code
- researcher: Codebase Researcher — explores code, finds relevant files, answers questions
- test-oracle: Test & Build Oracle — writes tests, runs builds, validates

For each subtask, specify:
1. Which agent should handle it
2. The exact prompt for that agent
3. Dependencies on other subtasks (by ID)

Output as a numbered list in the format:
## Subtask <id>
Agent: <agent>
Depends: <comma-separated IDs or "none">
Prompt: <instructions>`	

	userPrompt := fmt.Sprintf("Task: %s\nProject root: %s\n\nDecompose this task into subtasks.", task, projectRoot)

	resp, err := o.llmClient.ChatWithRetry(ctx, llm.ChatRequest{
		Model:       o.llmConfig.Model,
		Messages:    []llm.Message{{Role: llm.RoleSystem, Content: systemPrompt}, {Role: llm.RoleUser, Content: userPrompt}},
		Temperature: 0.3,
		MaxTokens:   2048,
	}, llm.DefaultRetryConfig())
	if err != nil {
		return nil, fmt.Errorf("decompose failed: %w", err)
	}

	content := resp.Choices[0].Message.Content
	return parseSubTasks(content), nil
}

func (o *Orchestrator) Execute(ctx context.Context, tasks []SubTask, projectRoot string) ([]SubTaskResult, error) {
	results := make([]SubTaskResult, 0, len(tasks))
	byID := make(map[string]*SubTaskResult)
	var mu sync.Mutex

	for _, task := range tasks {
		select {
		case <-ctx.Done():
			return results, ctx.Err()
		default:
		}

		o.mu.Lock()
		o.repo.Add(task)
		o.mu.Unlock()

		var depsReady bool
		for _, depID := range task.DependsOn {
			o.mu.Lock()
			dep, exists := o.repo.Get(depID)
			o.mu.Unlock()
			if !exists || dep.Error != nil {
				depsReady = false
				break
			}
			depsReady = true
		}
		if !depsReady && len(task.DependsOn) > 0 {
			continue
		}

		result := o.runSubTask(ctx, task, projectRoot)

		mu.Lock()
		results = append(results, result)
		byID[task.ID] = &result
		o.repo.Complete(task.ID, result)
		mu.Unlock()
	}

	return results, nil
}

func (o *Orchestrator) runSubTask(ctx context.Context, task SubTask, projectRoot string) SubTaskResult {
	start := time.Now()

	systemPrompt := o.buildAgentPrompt(task.Agent)
	userPrompt := task.Prompt
	if task.Context != "" {
		userPrompt = fmt.Sprintf("Context:\n%s\n\nTask:\n%s", task.Context, task.Prompt)
	}

	resp, err := o.llmClient.ChatWithRetry(ctx, llm.ChatRequest{
		Model:       o.llmConfig.Model,
		Messages:    []llm.Message{{Role: llm.RoleSystem, Content: systemPrompt}, {Role: llm.RoleUser, Content: userPrompt}},
		Temperature: 0.2,
		MaxTokens:   4096,
	}, llm.DefaultRetryConfig())

	result := SubTaskResult{
		SubTaskID: task.ID,
		Agent:     task.Agent,
		Duration:  time.Since(start),
	}

	if err != nil {
		result.Error = fmt.Errorf("%s agent failed: %w", task.Agent, err)
		return result
	}

	result.Output = resp.Choices[0].Message.Content

	parser := execution.NewHunkParser()
	hunks, parseErr := parser.ParseLLMResponse(result.Output)
	if parseErr != nil {
		result.Error = fmt.Errorf("parse error: %w", parseErr)
		return result
	}
	result.Hunks = hunks

	return result
}

func (o *Orchestrator) buildAgentPrompt(agent AgentType) string {
	switch agent {
	case AgentCodebaseResearcher:
		return `You are the Kode Codebase Researcher Agent. Your job is to explore the codebase, find relevant files, understand code structure, and answer questions about the code. You do NOT write code. You only explore, analyze, and report findings.

When given a task:
1. Identify the relevant files and directories
2. Read and analyze the code
3. Report your findings clearly with file paths
4. Suggest approaches for the main coding agent

Output format: Present your findings as a structured report with sections for each file analyzed.`
	case AgentTestOracle:
		return `You are the Kode Test & Build Oracle Agent. Your job is to write tests, validate builds, and ensure code quality. You are a testing specialist.

When given a task:
1. Write comprehensive tests (unit, integration as appropriate)
2. Validate that the code builds successfully
3. Check for edge cases and error conditions
4. Ensure test coverage for the changes

Output hunks using standard patch format with file paths.`
	default:
		return `You are the Kode Main Coding Agent. You implement changes, write code, and fix issues.

When given a task:
1. Understand the requirements
2. Write clean, idiomatic code
3. Follow existing code conventions
4. Output changes as structured hunks with file paths`
	}
}

func parseSubTasks(content string) []SubTask {
	var tasks []SubTask
	currentID := ""
	currentAgent := AgentMain
	currentPrompt := ""
	var currentDeps []string
	inPrompt := false
	lines := strings.Split(content, "\n")

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		if strings.HasPrefix(trimmed, "## Subtask") {
			if currentID != "" {
				tasks = append(tasks, SubTask{
					ID:        currentID,
					Agent:     currentAgent,
					Prompt:    strings.TrimSpace(currentPrompt),
					DependsOn: currentDeps,
				})
			}
			currentID = strings.TrimSpace(trimmed[10:])
			currentAgent = AgentMain
			currentPrompt = ""
			currentDeps = nil
			inPrompt = false
			continue
		}

		if currentID == "" {
			continue
		}

		if strings.HasPrefix(trimmed, "Agent:") {
			val := strings.TrimSpace(trimmed[6:])
			switch val {
			case "researcher":
				currentAgent = AgentCodebaseResearcher
			case "test-oracle":
				currentAgent = AgentTestOracle
			default:
				currentAgent = AgentMain
			}
		} else if strings.HasPrefix(trimmed, "Depends:") {
			val := strings.TrimSpace(trimmed[8:])
			if val != "none" && val != "" {
				for _, part := range strings.Split(val, ",") {
					part = strings.TrimSpace(part)
					if part != "" {
						currentDeps = append(currentDeps, part)
					}
				}
			}
		} else if strings.HasPrefix(trimmed, "Prompt:") {
			inPrompt = true
			currentPrompt = strings.TrimSpace(trimmed[7:]) + "\n"
		} else if inPrompt {
			currentPrompt += line + "\n"
		}
	}

	if currentID != "" {
		tasks = append(tasks, SubTask{
			ID:        currentID,
			Agent:     currentAgent,
			Prompt:    strings.TrimSpace(currentPrompt),
			DependsOn: currentDeps,
		})
	}

	return tasks
}

func (o *Orchestrator) Synthesize(ctx context.Context, task string, results []SubTaskResult, projectRoot string) (string, error) {
	systemPrompt := `You are the Kode Orchestrator. Synthesize the results from multiple specialized agents into a coherent implementation plan.

Given the original task and results from researcher, tester, and coder agents, produce a unified output that:
1. Combines findings from all agents
2. Resolves any conflicts between agent outputs
3. Presents a clear, ordered implementation plan
4. Includes all code hunks in the correct order for application`

	var builder string
	builder += fmt.Sprintf("Original Task: %s\n\n", task)
	builder += "Agent Results:\n\n"
	for _, r := range results {
		builder += fmt.Sprintf("--- %s Agent (%s) ---\n", r.Agent, r.SubTaskID)
		if r.Error != nil {
			builder += fmt.Sprintf("Error: %v\n", r.Error)
		} else {
			builder += r.Output + "\n\n"
		}
	}

	resp, err := o.llmClient.ChatWithRetry(ctx, llm.ChatRequest{
		Model:       o.llmConfig.Model,
		Messages:    []llm.Message{{Role: llm.RoleSystem, Content: systemPrompt}, {Role: llm.RoleUser, Content: builder}},
		Temperature: 0.2,
		MaxTokens:   4096,
	}, llm.DefaultRetryConfig())
	if err != nil {
		return "", fmt.Errorf("synthesize failed: %w", err)
	}

	return resp.Choices[0].Message.Content, nil
}
