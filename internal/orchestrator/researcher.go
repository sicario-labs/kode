package orchestrator

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/kode/kode/internal/llm"
)

type Researcher struct {
	llmClient *llm.Client
	llmConfig llm.Config
}

func NewResearcher(cfg llm.Config) *Researcher {
	return &Researcher{
		llmClient: llm.NewClient(cfg),
		llmConfig: cfg,
	}
}

type ResearchResult struct {
	Summary      string
	RelevantFiles []string
	Findings     string
}

func (r *Researcher) Research(ctx context.Context, task string, projectRoot string) (*ResearchResult, error) {
	fileTree, err := buildFileTree(projectRoot, 3)
	if err != nil {
		fileTree = fmt.Sprintf("error reading project: %v", err)
	}

	systemPrompt := `You are a Codebase Researcher. Your job is to quickly understand a codebase and find relevant files for a task.
You are given a project file tree and a task. Identify:
1. Which files are most relevant to the task
2. How the codebase is structured
3. Key entry points and dependencies`

	userPrompt := fmt.Sprintf("Project structure:\n%s\n\nTask: %s\n\nIdentify the most relevant files and explain the codebase structure relevant to this task.", fileTree, task)

	resp, err := r.llmClient.ChatWithRetry(ctx, llm.ChatRequest{
		Model:       r.llmConfig.Model,
		Messages:    []llm.Message{{Role: llm.RoleSystem, Content: systemPrompt}, {Role: llm.RoleUser, Content: userPrompt}},
		Temperature: 0.2,
		MaxTokens:   2048,
	}, llm.DefaultRetryConfig())
	if err != nil {
		return nil, fmt.Errorf("research failed: %w", err)
	}

	return &ResearchResult{
		Summary:  resp.Choices[0].Message.Content,
		Findings: resp.Choices[0].Message.Content,
	}, nil
}

func buildFileTree(root string, maxDepth int) (string, error) {
	var builder strings.Builder
	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return nil
		}
		if rel == "." {
			return nil
		}

		depth := len(strings.Split(rel, string(filepath.Separator)))
		if depth > maxDepth {
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		if strings.HasPrefix(info.Name(), ".") {
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		dirs := []string{"node_modules", "vendor", ".git", "dist", "build", "target", "__pycache__"}
		for _, d := range dirs {
			if info.IsDir() && info.Name() == d {
				return filepath.SkipDir
			}
		}

		indent := strings.Repeat("  ", depth-1)
		if info.IsDir() {
			builder.WriteString(fmt.Sprintf("%s%s/\n", indent, info.Name()))
		} else {
			ext := filepath.Ext(info.Name())
			switch ext {
			case ".go", ".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".json", ".yaml", ".yml", ".toml", ".md", ".css", ".html":
				builder.WriteString(fmt.Sprintf("%s%s\n", indent, info.Name()))
			}
		}
		return nil
	})
	return builder.String(), err
}
