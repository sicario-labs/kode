package golf

import (
	"fmt"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

var benchLine = regexp.MustCompile(`^Benchmark(\S+)\s+(\d+)\s+([\d.]+)\s+ns/op(?:\s+(\d+)\s+[A-Za-z]+/op)?(?:\s+(\d+)\s+[A-Za-z]+/op)?`)

func RunBenchmarks(dir, testCmd string) ([]BenchResult, error) {
	parts := strings.Fields(testCmd)
	if len(parts) == 0 {
		parts = []string{"go", "test", "-bench=.", "-benchmem", "-benchtime=100ms"}
	} else {
		// Inject benchmark flags into the test command
		clean := make([]string, 0, len(parts)+3)
		for _, p := range parts {
			if !strings.HasPrefix(p, "-bench") && !strings.HasPrefix(p, "-benchmem") {
				clean = append(clean, p)
			}
		}
		clean = append(clean, "-bench=.", "-benchmem", "-benchtime=100ms", "./...")
		parts = clean
	}

	out, err := exec.Command(parts[0], parts[1:]...).CombinedOutput()
	output := string(out)

	if err != nil {
		// Try without ./...
		shortParts := parts[:len(parts)-1]
		out2, err2 := exec.Command(shortParts[0], shortParts[1:]...).CombinedOutput()
		if err2 != nil {
			return nil, fmt.Errorf("benchmark failed: %w\nOutput: %s", err, output)
		}
		output = string(out2)
	}

	return parseBenchOutput(output), nil
}

func RunBenchmarksForFile(dir, testCmd, file string) ([]BenchResult, error) {
	rel, err := filepath.Rel(dir, file)
	if err != nil {
		rel = file
	}
	pkgDir := filepath.Dir(rel)

	parts := strings.Fields(testCmd)
	if len(parts) == 0 {
		parts = []string{"go", "test", "-bench=.", "-benchmem", "-benchtime=100ms", pkgDir}
	} else {
		clean := make([]string, 0, len(parts)+3)
		for _, p := range parts {
			if !strings.HasPrefix(p, "-bench") && !strings.HasPrefix(p, "-benchmem") {
				clean = append(clean, p)
			}
		}
		clean = append(clean, "-bench=.", "-benchmem", "-benchtime=100ms", pkgDir)
		parts = clean
	}

	out, err := exec.Command(parts[0], parts[1:]...).CombinedOutput()
	output := string(out)
	if err != nil {
		return nil, fmt.Errorf("benchmark failed: %w\nOutput: %s", err, output)
	}

	return parseBenchOutput(output), nil
}

func parseBenchOutput(output string) []BenchResult {
	var results []BenchResult
	seen := make(map[string]bool)

	for _, line := range strings.Split(output, "\n") {
		matches := benchLine.FindStringSubmatch(line)
		if matches == nil {
			continue
		}

		name := matches[1]
		// Take the last (slowest) result per benchmark name
		nsPerOp, _ := strconv.ParseFloat(matches[3], 64)
		var allocBPO, allocsPO int
		if len(matches) >= 6 {
			allocBPO, _ = strconv.Atoi(matches[4])
			allocsStr := strings.TrimSpace(matches[5])
			if f, err := strconv.ParseFloat(allocsStr, 64); err == nil {
				allocsPO = int(f)
			}
		}

		key := name
		if !seen[key] {
			seen[key] = true
			results = append(results, BenchResult{
				Name:     name,
				NSPerOp:  nsPerOp,
				AllocBPO: allocBPO,
				AllocsPO: allocsPO,
			})
		}
	}

	return results
}

// FindDelta looks up the % delta (ns/op) between baseline and optimized for
// a single named benchmark. Positive means faster. Returns 0 if not found.
func FindDelta(baseline, optimized []BenchResult, name string) float64 {
	optMap := make(map[string]BenchResult)
	for _, o := range optimized {
		optMap[o.Name] = o
	}
	baseMap := make(map[string]BenchResult)
	for _, b := range baseline {
		baseMap[b.Name] = b
	}
	base, baseOk := baseMap[name]
	opt, optOk := optMap[name]
	if !baseOk || !optOk || base.NSPerOp == 0 {
		return 0
	}
	return (base.NSPerOp - opt.NSPerOp) / base.NSPerOp * 100.0
}

func CompareBenchs(baseline, optimized []BenchResult) (improvementPct float64, countImproved int, countTotal int) {
	baseMap := make(map[string]BenchResult)
	for _, b := range baseline {
		baseMap[b.Name] = b
	}

	var totalImprovement float64
	for _, opt := range optimized {
		base, ok := baseMap[opt.Name]
		if !ok || base.NSPerOp == 0 {
			continue
		}
		countTotal++
		diff := (base.NSPerOp - opt.NSPerOp) / base.NSPerOp * 100.0
		if diff > 0 {
			countImproved++
		}
		totalImprovement += diff
	}

	if countTotal > 0 {
		improvementPct = totalImprovement / float64(countTotal)
	}
	return
}
