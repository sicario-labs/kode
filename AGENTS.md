# Kode

Kode is a contrarian AI coding agent — a functional architecture hijack of
opencode that replaces generate-and-pray with a structured
**Plan → Critique → Generate → Verify → Apply → Test** workflow.

## Architecture

```
C:\kode
├── cmd/kode/          ← Go CLI entry point
├── internal/          ← Go engine (graph, verify, execution, llm)
├── third_party/
│   └── opencode/      ← vendored opencode monorepo (TS/Bun), rebranded as Kode TUI
├── go.mod             ← Go module: github.com/kode/kode
└── ROADMAP.md         ← full roadmap and fork strategy
```

The Go engine (`kode.exe`) is the unified CLI entry point. It communicates with
the TypeScript TUI (rebranded opencode) via subprocess — `kode tui` spawns the
TUI, and the TUI calls `kode.exe verify --input <json>` as a verification oracle
before writing patches to disk.

## Commands

- `kode plan <task>` — Build surgical 8K context graph
- `kode verify --input <file>` — Verify file content through 4-gate check
- `kode generate <prompt>` — Generate patches via LLM (OpenAI-compatible API)
- `kode run <prompt>` — Full generate→verify→apply pipeline (alias for generate --apply)
- `kode loop <task>` — Full Plan→Generate→Verify→Apply→Test cycle with rollback
- `kode stats` — Analyze gatekeeper audit log
- `kode tui` — Launch the interactive Kode TUI (requires bun + node_modules)

## Build

```bash
go build -o bin/kode.exe ./cmd/kode
```

Tests: `go test ./...` (121 tests across 6 packages)
Binary: ~10MB single executable, zero CGo

## TUI Setup

```bash
npm install -g bun
cd third_party/opencode
bun install
cd ../..
kode tui
```

## Upstream

Vendored from [github.com/anomalyco/opencode](https://github.com/anomalyco/opencode) v1.15.10.
Rebranded as Kode: ~158 TS files modified, plus new Go bridge code.
