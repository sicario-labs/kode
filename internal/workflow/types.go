package workflow

import (
	"time"

	"github.com/kode/kode/internal/execution"
	"github.com/kode/kode/internal/llm"
	"github.com/kode/kode/internal/router"
)

type Stage string

const (
	StagePlan     Stage = "plan"
	StageCritique Stage = "critique"
	StageGenerate Stage = "generate"
	StageVerify   Stage = "verify"
	StageApply    Stage = "apply"
	StageTest     Stage = "test"
	StageBench    Stage = "bench"
)

type BenchResult struct {
	Name     string  `json:"name"`
	NSPerOp  float64 `json:"ns_per_op"`
	AllocBPO int     `json:"alloc_bpo"`
	AllocsPO int     `json:"allocs_po"`
}

type State struct {
	CurrentStage    Stage
	TaskID          string
	ProjectRoot     string
	Task            string
	Hunks           []execution.StructuredHunk
	Summary         *execution.ExecutionSummary
	Errors          []string
	StartTime       time.Time
	BenchResults    []BenchResult  `json:"bench_results,omitempty"`
	BaselineResults []BenchResult `json:"baseline_results,omitempty"`
}

type Config struct {
	LLMConfig          *llm.Config
	MaxRetries         int
	TestCommand        string
	ModelOverride      string
	ContextFile        string
	RepairFunc         execution.RepairFunc
	TokenBudget        *llm.TokenBudget
	EnableContextIndex bool
	RouterConfig       *router.RouteConfig
	EnableGolfGate     bool
	GolfThreshold      float64
	BaselineResults    []BenchResult
}

type Result struct {
	Status     execution.Status
	State      *State
	Duration   time.Duration
	TestOutput string
}

type Pipeline struct {
	config      Config
	beforeStage map[Stage]func(*State)
	afterStage  map[Stage]func(*State, error)
}

type StageHook func(state *State) error
