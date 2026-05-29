package mcp

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"

	"github.com/kode/kode/internal/execution"
	"github.com/kode/kode/internal/llm"
	"github.com/kode/kode/internal/planner"
	"github.com/kode/kode/internal/workflow"
)

type Request struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      interface{}     `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params"`
}

type Response struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      interface{} `json:"id"`
	Result  interface{} `json:"result,omitempty"`
	Error   *Error      `json:"error,omitempty"`
}

type Error struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type Server struct {
	repoDir   string
	llmConfig *llm.Config
	in        io.Reader
	out       io.Writer
}

func NewServer(repoDir string, cfg *llm.Config, in io.Reader, out io.Writer) *Server {
	return &Server{
		repoDir:   repoDir,
		llmConfig: cfg,
		in:        in,
		out:       out,
	}
}

func (s *Server) Run(ctx context.Context) error {
	scanner := bufio.NewScanner(s.in)
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}

		var req Request
		if err := json.Unmarshal([]byte(line), &req); err != nil {
			s.sendError(nil, -32700, "Parse error")
			continue
		}

		go s.handleRequest(ctx, req)
	}
	return scanner.Err()
}

func (s *Server) handleRequest(ctx context.Context, req Request) {
	var result interface{}
	var err *Error

	switch req.Method {
	case "initialize":
		result = map[string]interface{}{
			"protocolVersion": "2024-11-05",
			"serverInfo": map[string]interface{}{
				"name":    "kode-mcp",
				"version": "1.0.0",
			},
			"capabilities": map[string]interface{}{
				"tools": map[string]interface{}{},
			},
		}

	case "tools/list":
		result = map[string]interface{}{
			"tools": []map[string]interface{}{
				{
					"name":        "kode_plan",
					"description": "Use the Context Engine to build a context graph for a given task prompt.",
					"inputSchema": map[string]interface{}{
						"type": "object",
						"properties": map[string]interface{}{
							"task": map[string]interface{}{
								"type": "string",
							},
						},
						"required": []string{"task"},
					},
				},
				{
					"name":        "kode_apply_verified",
					"description": "Run the autonomous generate-verify-apply loop for a specific task using the Kode engine.",
					"inputSchema": map[string]interface{}{
						"type": "object",
						"properties": map[string]interface{}{
							"task": map[string]interface{}{
								"type": "string",
							},
						},
						"required": []string{"task"},
					},
				},
			},
		}

	case "tools/call":
		var params struct {
			Name      string `json:"name"`
			Arguments struct {
				Task string `json:"task"`
			} `json:"arguments"`
		}
		if e := json.Unmarshal(req.Params, &params); e != nil {
			err = &Error{Code: -32602, Message: "Invalid params"}
			break
		}

		switch params.Name {
		case "kode_plan":
			res, e := s.handlePlan(ctx, params.Arguments.Task)
			if e != nil {
				err = &Error{Code: -32000, Message: e.Error()}
			} else {
				result = map[string]interface{}{
					"content": []map[string]interface{}{
						{
							"type": "text",
							"text": res,
						},
					},
				}
			}
		case "kode_apply_verified":
			res, e := s.handleApplyVerified(ctx, params.Arguments.Task)
			if e != nil {
				err = &Error{Code: -32000, Message: e.Error()}
			} else {
				result = map[string]interface{}{
					"content": []map[string]interface{}{
						{
							"type": "text",
							"text": res,
						},
					},
				}
			}
		default:
			err = &Error{Code: -32601, Message: "Method not found"}
		}

	case "notifications/initialized":
		// Ignore
		return

	default:
		err = &Error{Code: -32601, Message: "Method not found"}
	}

	if req.ID != nil {
		s.sendResponse(req.ID, result, err)
	}
}

func (s *Server) sendResponse(id interface{}, result interface{}, err *Error) {
	resp := Response{
		JSONRPC: "2.0",
		ID:      id,
		Result:  result,
		Error:   err,
	}
	b, _ := json.Marshal(resp)
	fmt.Fprintf(s.out, "%s\n", string(b))
}

func (s *Server) sendError(id interface{}, code int, message string) {
	s.sendResponse(id, nil, &Error{Code: code, Message: message})
}

func (s *Server) handlePlan(ctx context.Context, task string) (string, error) {
	p := planner.NewPlanner(s.repoDir)
	plan, err := p.Plan(ctx, task, 8000)
	packet, err := plan.Graph.ContextPacket(8000)
	if err != nil {
		return "", err
	}
	b, _ := json.MarshalIndent(packet, "", "  ")
	return string(b), nil
}

func (s *Server) handleApplyVerified(ctx context.Context, task string) (string, error) {
	pipe := workflow.NewPipeline(workflow.Config{
		LLMConfig:          s.llmConfig,
		MaxRetries:         3,
		EnableContextIndex: true,
		AsyncTest:          true,
	})

	pipe.BeforeStage(workflow.StageGenerate, func(st *workflow.State) {
		st.ProjectRoot = s.repoDir
	})

	res, err := pipe.Run(ctx, task)
	if err != nil {
		return fmt.Sprintf("Pipeline failed: %v", err), nil
	}

	if res.Status == execution.StatusPass {
		return fmt.Sprintf("Success! Applied %d hunks.", len(res.State.Summary.AppliedHunks)), nil
	}
	
	if len(res.State.Errors) > 0 {
		return fmt.Sprintf("Failed. Last error: %s", res.State.Errors[len(res.State.Errors)-1]), nil
	}

	return "Failed to apply verified patch.", nil
}
