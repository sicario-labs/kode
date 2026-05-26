package golf

import (
	"testing"
)

func TestParseBenchOutput(t *testing.T) {
	t.Parallel()
	output := "goos: linux\ngoarch: amd64\npkg: github.com/kode/kode/internal/graph\nBenchmarkResolve-8   	   10000	  123456 ns/op	   54321 B/op	     321 allocs/op\nBenchmarkTraverse-8  	   20000	   65432 ns/op	   12345 B/op	      99 allocs/op\nPASS\nok  	github.com/kode/kode/internal/graph	2.345s"

	results := parseBenchOutput(output)
	if len(results) != 2 {
		t.Fatalf("expected 2 benchmark results, got %d", len(results))
	}
	if results[0].Name != "Resolve-8" {
		t.Errorf("expected name Resolve-8, got %s", results[0].Name)
	}
	if results[0].NSPerOp != 123456 {
		t.Errorf("expected 123456 ns/op, got %f", results[0].NSPerOp)
	}
	if results[0].AllocBPO != 54321 {
		t.Errorf("expected 54321 B/op, got %d", results[0].AllocBPO)
	}
	if results[0].AllocsPO != 321 {
		t.Errorf("expected 321 allocs/op, got %d", results[0].AllocsPO)
	}
	if results[1].Name != "Traverse-8" {
		t.Errorf("expected name Traverse-8, got %s", results[1].Name)
	}
	if results[1].NSPerOp != 65432 {
		t.Errorf("expected 65432 ns/op, got %f", results[1].NSPerOp)
	}
}

func TestParseBenchOutputDedup(t *testing.T) {
	t.Parallel()
	output := "BenchmarkFoo-8   10000   100 ns/op\nBenchmarkFoo-8   20000    90 ns/op\nBenchmarkFoo-8   30000    80 ns/op"

	results := parseBenchOutput(output)
	if len(results) != 1 {
		t.Fatalf("expected 1 unique benchmark, got %d", len(results))
	}
	if results[0].NSPerOp != 100 {
		t.Errorf("expected 100 ns/op (first), got %f", results[0].NSPerOp)
	}
}

func TestParseBenchOutputNoAllocs(t *testing.T) {
	t.Parallel()
	output := "BenchmarkSimple-8   50000    250 ns/op"

	results := parseBenchOutput(output)
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	if results[0].NSPerOp != 250 {
		t.Errorf("expected 250 ns/op, got %f", results[0].NSPerOp)
	}
	if results[0].AllocBPO != 0 {
		t.Errorf("expected 0 B/op, got %d", results[0].AllocBPO)
	}
}

func TestFindDelta(t *testing.T) {
	t.Parallel()
	baseline := []BenchResult{{Name: "Foo", NSPerOp: 200}}
	optimized := []BenchResult{{Name: "Foo", NSPerOp: 150}}

	delta := FindDelta(baseline, optimized, "Foo")
	expected := 25.0
	if delta != expected {
		t.Errorf("expected %.0f%% delta, got %.0f%%", expected, delta)
	}
}

func TestFindDeltaRegression(t *testing.T) {
	t.Parallel()
	baseline := []BenchResult{{Name: "Foo", NSPerOp: 100}}
	optimized := []BenchResult{{Name: "Foo", NSPerOp: 150}}

	delta := FindDelta(baseline, optimized, "Foo")
	expected := -50.0
	if delta != expected {
		t.Errorf("expected %.0f%% delta, got %.0f%%", expected, delta)
	}
}

func TestFindDeltaMissing(t *testing.T) {
	t.Parallel()
	baseline := []BenchResult{{Name: "Foo", NSPerOp: 100}}
	optimized := []BenchResult{{Name: "Bar", NSPerOp: 50}}

	delta := FindDelta(baseline, optimized, "Foo")
	if delta != 0 {
		t.Errorf("expected 0 for missing match, got %f", delta)
	}
}

func TestCompareBenchs(t *testing.T) {
	t.Parallel()
	baseline := []BenchResult{
		{Name: "A", NSPerOp: 200},
		{Name: "B", NSPerOp: 100},
	}
	optimized := []BenchResult{
		{Name: "A", NSPerOp: 150},
		{Name: "B", NSPerOp: 90},
	}

	improvement, improved, total := CompareBenchs(baseline, optimized)
	if total != 2 {
		t.Errorf("expected 2 total, got %d", total)
	}
	if improved != 2 {
		t.Errorf("expected 2 improved, got %d", improved)
	}
	if improvement <= 0 {
		t.Errorf("expected positive improvement, got %f", improvement)
	}
}

func TestCompareBenchsPartial(t *testing.T) {
	t.Parallel()
	baseline := []BenchResult{
		{Name: "A", NSPerOp: 200},
		{Name: "B", NSPerOp: 100},
	}
	optimized := []BenchResult{
		{Name: "A", NSPerOp: 150},
	}

	_, improved, total := CompareBenchs(baseline, optimized)
	if total != 1 {
		t.Errorf("expected 1 total (B skipped), got %d", total)
	}
	if improved != 1 {
		t.Errorf("expected 1 improved, got %d", improved)
	}
}
