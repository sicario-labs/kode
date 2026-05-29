package verify

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/kode/kode/internal/graph"
)

type Gate struct {
	diffApplier    *DiffApplier
	syntax         *SyntaxChecker
	imports        *ImportValidator
	calls          *CallChecker
	architecture   *ArchitectureChecker
	blastRadius    *BlastRadiusChecker
	security       *SecurityChecker
	staticAnalysis *StaticAnalysisChecker
}

func NewGate(projectRoot string) *Gate {
	return &Gate{
		diffApplier:    NewDiffApplier(),
		syntax:         NewSyntaxChecker(),
		imports:        NewImportValidator(projectRoot),
		calls:          NewCallChecker(projectRoot),
		architecture:   NewArchitectureChecker(),
		security:       NewSecurityChecker(),
		staticAnalysis: NewStaticAnalysisChecker(projectRoot),
	}
}

func (g *Gate) WithBlastRadius(maxRadius int, graph *graph.ContextGraph) *Gate {
	if maxRadius > 0 && graph != nil {
		g.blastRadius = NewBlastRadiusChecker(graph)
	}
	return g
}

func (g *Gate) SecurityEnabled() bool {
	return g.security != nil && g.security.Available()
}

func (g *Gate) SecurityBinaryPath() string {
	if g.security == nil {
		return ""
	}
	return g.security.BinaryPath()
}

func (g *Gate) Verify(ctx context.Context, req VerifyRequest) (*Verdict, error) {
	fmt.Fprintf(os.Stderr, "KODE_GATE: diff_applier\n")
	modifiedFiles, err := g.diffApplier.ApplyInMemory(req.Diff, req.OriginalFiles)
	if err != nil {
		return &Verdict{
			DiffID:  req.DiffID,
			Overall: StatusFail,
			Results: []CheckResult{{
				CheckName: "diff_applier",
				Status:    StatusFail,
				Message:   "Failed to apply diff to original files in memory",
				Details:   err.Error(),
			}},
		}, nil
	}

	verdict := &Verdict{DiffID: req.DiffID, Overall: StatusPass}

	// Build allowed package manifest from ContextGraph
	allowedPackages := make(map[string]bool)
	graphEntries := make(map[string]bool)
	if req.Graph != nil {
		for _, node := range req.Graph.Nodes {
			if node.Kind == "import" {
				allowedPackages[node.FilePath] = true
			}
		}

		// Build graph entries for call validation: "pkg.Method" -> true
		for _, edge := range req.Graph.Edges {
			if edge.Kind == "calls" || edge.Kind == "defines" {
				sourceFile := string(edge.Source)
				targetID := string(edge.Target)
				graphEntries[fmt.Sprintf("%s.%s", sourceFile, targetID)] = true
			}
		}
	}

	// Build allowed internal packages from modified files
	allowedInternal := make(map[string]bool)
	for path := range modifiedFiles {
		dir := path
		if idx := strings.LastIndex(dir, "/"); idx >= 0 {
			dir = dir[:idx]
		} else if idx := strings.LastIndex(dir, "\\"); idx >= 0 {
			dir = dir[:idx]
		}
		allowedInternal[dir] = true
		allowedInternal[path] = true

		// Add every node name as allowed internal
		if req.Graph != nil {
			for _, node := range req.Graph.Nodes {
				if node.Kind == "import" {
					allowedInternal[node.FilePath] = true
				}
				if node.Kind == "file" {
					allowedInternal[node.Name] = true
				}
			}
		}
	}

	// Check 1: Syntax — hard block on parse errors
	fmt.Fprintf(os.Stderr, "KODE_GATE: syntax\n")
	for path, content := range modifiedFiles {
		result := g.syntax.CheckFile(path, content)
		verdict.Results = append(verdict.Results, result)
		if result.Status == StatusFail {
			verdict.Overall = StatusFail
			return verdict, nil
		}
	}

	// Check 2: Imports — hard block on unresolvable imports
	fmt.Fprintf(os.Stderr, "KODE_GATE: imports\n")
	for path, content := range modifiedFiles {
		result := g.imports.Validate(path, content, allowedInternal)
		verdict.Results = append(verdict.Results, result)
		if result.Status == StatusFail {
			verdict.Overall = StatusFail
			return verdict, nil
		}
	}

	// Check 3: Calls — hard block on hallucinated package calls, warn on unresolvable local calls
	fmt.Fprintf(os.Stderr, "KODE_GATE: calls\n")
	for path, content := range modifiedFiles {
		result := g.calls.CheckFile(path, content, allowedPackages, graphEntries)
		verdict.Results = append(verdict.Results, result)
		if result.Status == StatusFail {
			verdict.Overall = StatusFail
			return verdict, nil
		}
	}

	// Check 4: Blast Radius — block if too many downstream files affected
	fmt.Fprintf(os.Stderr, "KODE_GATE: blast_radius\n")
	if g.blastRadius != nil && req.Graph != nil && req.MaxBlastRadius > 0 {
		for path := range modifiedFiles {
			results, ok := g.blastRadius.CheckFile(path, req.MaxBlastRadius)
			if !ok {
				verdict.Results = append(verdict.Results, CheckResult{
					CheckName: "blast_radius",
					Status:    StatusFail,
					Message:   fmt.Sprintf("Blast radius check failed for %s", path),
					Details:   g.blastRadius.Summary(results, req.MaxBlastRadius),
				})
				verdict.Overall = StatusFail
				return verdict, nil
			}
		}
	}

	// Check 5: Architecture — configurable: block or warn
	fmt.Fprintf(os.Stderr, "KODE_GATE: architecture\n")
	if len(req.ArchitectureRules) > 0 {
		for path, content := range modifiedFiles {
			result := g.architecture.CheckFile(path, content, req.ArchitectureRules)
			verdict.Results = append(verdict.Results, result)
			if result.Status == StatusFail {
				if req.BlockOnArchitecture {
					verdict.Overall = StatusFail
					return verdict, nil
				}
				// If not blocking, downgrade to WARN
				verdict.Overall = StatusPass
				for i, r := range verdict.Results {
					if r.CheckName == "architecture" && r.Status == StatusFail {
						verdict.Results[i].Status = StatusWarn
					}
				}
			}
		}
	}

	// Check 6: Security — high/critical findings block, low/medium warn, absent sicario warns
	fmt.Fprintf(os.Stderr, "KODE_GATE: security\n")
	if g.security != nil {
		for path, content := range modifiedFiles {
			result := g.security.CheckFile(path, content)
			verdict.Results = append(verdict.Results, result)
			if result.Status == StatusFail {
				verdict.Overall = StatusFail
				return verdict, nil
			}
		}
	}

	return verdict, nil
}
