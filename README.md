<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/sicario-labs/kode/master/web/public/kode-logo.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/sicario-labs/kode/master/web/public/kode-logo-light.svg">
    <img alt="Kode Logo" src="https://raw.githubusercontent.com/sicario-labs/kode/master/web/public/kode-logo-light.svg" width="200">
  </picture>
  <p><strong>The contrarian, verification-first AI coding agent. No generation without validation.</strong></p>
  <p>
    <a href="https://github.com/sicario-labs/kode/actions/workflows/ci.yml"><img src="https://github.com/sicario-labs/kode/actions/workflows/ci.yml/badge.svg?branch=master&v=1" alt="CI Status" /></a>
    <a href="https://github.com/sicario-labs/kode/releases"><img src="https://img.shields.io/github/v/release/sicario-labs/kode?color=blue&label=Release&cache=1" alt="Release" /></a>
    <a href="https://github.com/sicario-labs/kode/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
  </p>
</div>

---

> [!IMPORTANT]
> **Kode replaces the industry-standard "generate-and-pray" paradigm with a mathematically rigorous, deterministic verification pipeline.**

## The Incumbent Problem
The entire AI coding market—Cursor, Copilot, Cline—relies on **blind generation**. An LLM generates code, and the tool writes it directly to your filesystem. You, the human, are forced to be the verification layer. You review diffs, run compilers, catch hallucinated imports, and painstakingly roll back broken patches.

## The Kode Thesis
**Kode is the world's first verification-first AI coding agent.** 

Every generated patch passes through a deterministic, compiled Go binary that runs stringent verification gates in under 50ms before it ever touches your filesystem. If any gate fails, the patch is rejected, and the LLM self-corrects based on compiler-grade feedback.

The LLM is the generative engine. **Kode is the security layer.**

---

## The Workflow

Instead of chaotic prompting, Kode enforces a structured, professional software engineering lifecycle:
**`Plan → Critique → Generate → Verify → Apply → Test`**

---

## The Verification Gates

Kode protects your repository with multiple levels of deterministic validation before writing to disk:

1. **Syntax Gate**: Dual-engine architecture. Full Tree-sitter AST validation when available, gracefully falling back to fast regex heuristics. Parses Go, TypeScript, JavaScript, Python, and Rust. Parse error = hard block.
2. **Imports Gate**: Validates every import path against the project dependency graph. Catches hallucinated packages before they compile.
3. **Calls Gate**: Checks that every function and method call references a symbol that actually exists. Eliminates the #1 source of LLM hallucinations.
4. **Blast Radius Gate**: Walks the dependency graph backward from every modified file. If downstream impact exceeds your configured threshold, the patch is blocked.
5. **Architecture Gate**: Enforces declared module boundaries. Prevents the LLM from crossing microservice lines or importing banned packages.
6. **Security Gate**: Automated vulnerability scanning on generated code. SQL injection, XSS, and hardcoded secrets are caught before they're committed.
7. **Sandbox Replay Gate**: CPU-bounded dynamic execution simulation. Traps and terminates infinite loops, memory leaks, and unauthorized system/network sockets.
8. **QR Code Tunnel Gate**: Boots secure public tunneling for dev servers, mapping the connection URL into a high-contrast terminal-scannable QR code for instant mobile layout verification.
9. **Browser Verification Gate**: Synthesizes dynamic E2E Playwright scripts, boots dev servers, executes visual UI verification flows headlessly, records walkthrough videos, and auto-corrects or rolls back on layout/console failures.

---

## Unmatched Architecture & Performance

Kode isn't just a wrapper script. It's a high-performance system engineered for speed, safety, and concurrency.

- **The Go Engine**: The core orchestrator is a lightning-fast, ~10MB compiled Go binary (`kode.exe`). Zero CGo overhead. It acts as the ultimate gatekeeper and verification oracle.
- **Asynchronous Subagents**: Delegate non-blocking background tasks to specialized subagents. Subagents conduct asynchronous research, parse documentation, and execute complex sub-routines without stalling your primary coding session.
- **The Kode Gateway**: A custom-built, ultra-low-latency LLM gateway proxy. Featuring **real-time SSE streaming, connection pooling, and $O(1)$ model routing**, it cuts Time-To-First-Token (TTFT) from 15 seconds down to under 500ms.
- **First-Class OpenModel Integration**: We don't just wrap standard APIs. Kode has native integrations spanning 25+ providers—including comprehensive support for OpenAI, Anthropic, Gemini, Groq, and full OpenModel API compatibility out-of-the-box.

---

## Beyond Verification

Verification is just the beginning. Kode introduces features no incumbent offers:

- **Ghost Branches**: Why run one prompt when you can run three? Kode spawns parallel git worktrees, testing multiple speculative strategies simultaneously. It evaluates the patches, tests them, and merges the highest-scoring survivor back into your working tree.
- **Blindfold Mode**: Enterprise-grade privacy. Kode SHA-256 obfuscates your identifiers (package names, functions, types) *before* LLM submission, featuring **bidirectional symbol translation** (re-mapping names seamlessly on reply) and **comment/docstring de-identification**.
- **Critique Lenses**: A pre-generation review layer that rejects structurally flawed ideas before the LLM wastes tokens generating them.
- **Kode Command Voice**: Hands-free vocal pair-programming. Trigger recording directly inside your CLI shell, transcribe prompts using cloud/local speech APIs, and watch changes stream in real-time.
- **Kode CIV PR Gateway**: Automate continuous integration and verification. A zero-human PR auto-merge pipeline configuration (`kode-civ.yml`) that approves and squash-merges pull requests only after passing all 9 safety gates and test suites.

---

## Installation & Quick Start

Kode is a **Bring Your Own Key (BYOK)** platform. You provide the API key, we provide the engine.

### 1. Unified Install Command (Recommended)
Get the prebuilt Go binaries and automated setup scripts using one command:

- **macOS / Linux**:
  ```bash
  curl -fsSL https://raw.githubusercontent.com/sicario-labs/kode/master/script/install.sh | bash
  ```

- **Windows (PowerShell)**:
  ```powershell
  irm https://raw.githubusercontent.com/sicario-labs/kode/master/script/install.ps1 | iex
  ```

### 2. NPM Package
Install globally via NPM:
```bash
npm install -g @sicario-labs/kode
```

### 3. Build from Source (Alternative)
To manually compile and build the workspace:
1. Build the Go engine:
   ```bash
   go build -o bin/kode ./cmd/kode
   ```
2. Set up the TUI dependencies:
   ```bash
   npm install -g bun
   cd third_party/opencode
   bun install
   cd ../..
   ./bin/kode tui
   ```

### 4. Termux (Android)
To run Kode inside the Termux app on Android:
1. Install compiler and Node runtimes:
   ```bash
   pkg install golang nodejs git clang make
   ```
2. Build the ARM64 Go engine locally:
   ```bash
   go build -o bin/kode ./cmd/kode
   ```
3. Set up TUI dependencies (falling back from Bun to NPM):
   ```bash
   cd third_party/opencode && npm install && cd ../..
   ```

- Core Commands
- `kode plan <task>` — Build a surgical context graph
- `kode verify --input <file>` — Verify file content through the gate pipeline
- `kode generate <prompt>` — Generate patches via LLM
- `kode loop <task>` — Full Plan→Generate→Verify→Apply→Test cycle with automatic rollback
- `kode voice` — Record your vocal programming prompt, transcribe, and execute
- `kode tui` — Launch the interactive Kode Terminal User Interface

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on setting up your local environment and submitting PRs. Kode is built on the shoulders of giants, vendoring and fundamentally extending the [opencode](https://github.com/anomalyco/opencode) TUI.

## License

The core Kode engine (CLI, TUI, internal modules, and web app) is released under the [MIT License](LICENSE). The LLM gateway and routing proxy (`cmd/gateway/` and `internal/gateway/`) are licensed under the [AGPL-3.0 License](LICENSE-GATEWAY).
