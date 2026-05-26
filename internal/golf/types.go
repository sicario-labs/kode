package golf

import "time"

type OptimizeTarget string

const (
	OptimizeSpeed      OptimizeTarget = "speed"
	OptimizeMemory     OptimizeTarget = "memory"
	OptimizeComplexity OptimizeTarget = "complexity"
)

type GolfConfig struct {
	File        string
	Target      OptimizeTarget
	ProjectRoot string
	TestCommand string
}

type BenchResult struct {
	Name     string  `json:"name"`
	NSPerOp  float64 `json:"ns_per_op"`
	AllocBPO int     `json:"alloc_bpo"`
	AllocsPO int     `json:"allocs_po"`
}

type BranchBench struct {
	Label  string        `json:"label"`
	Branch string        `json:"branch"`
	Benchs []BenchResult `json:"benchs"`
	Error  string        `json:"error,omitempty"`
	Pass   bool          `json:"pass"`
}

type GolfSummary struct {
	File        string         `json:"file"`
	Target      OptimizeTarget `json:"target"`
	Baseline    []BenchResult  `json:"baseline"`
	Branches    []BranchBench  `json:"branches"`
	Winner      string         `json:"winner"`
	Improvement float64        `json:"improvement_pct"`
	TotalTime   time.Duration  `json:"total_time"`
}
