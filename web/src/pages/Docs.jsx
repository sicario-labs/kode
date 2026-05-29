import { useState, useEffect } from 'react'

const CodeBlock = ({ children }) => (
  <div className="docs-code-block">
    <div className="docs-code-header">
      <div className="mac-dot"></div>
      <div className="mac-dot"></div>
      <div className="mac-dot"></div>
    </div>
    <div className="docs-code-body">
      {children}
    </div>
  </div>
)

export default function Docs() {
  const [activeSection, setActiveSection] = useState('intro')

  const sections = [
    { id: 'intro', label: 'Intro & Architecture' },
    { id: 'installation', label: 'Installation & Setup' },
    { id: 'gates', label: 'Verification Gates' },
    { id: 'commands', label: 'Commands Reference' },
    { id: 'config', label: 'Configuration Specification' },
    { id: 'tui', label: 'Interactive TUI' },
    { id: 'advanced', label: 'Advanced Features' },
  ]

  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY + 120
      for (const section of sections) {
        const el = document.getElementById(section.id)
        if (el) {
          const top = el.offsetTop
          const height = el.offsetHeight
          if (scrollPos >= top && scrollPos < top + height) {
            setActiveSection(section.id)
            break
          }
        }
      }
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToSection = (id) => {
    setActiveSection(id)
    const el = document.getElementById(id)
    if (el) {
      const top = el.offsetTop - 90
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  return (
    <section className="hero-section">
      <div className="wrapper">
        <div className="features-list">
          <span className="hero-badge" style={{ marginBottom: 24 }}>[x] System Documentation</span>
          <h1 className="display-xl" style={{ marginBottom: 24 }}>Getting started with Kode</h1>
          <p className="body-md hero-sub">
            Kode is a Go-powered AI coding agent that enforces deterministic verification gates on every generated patch before writing to disk.
          </p>
        </div>

        <div className="docs-container">
          {/* LEFT SIDEBAR: Navigation */}
          <aside className="docs-sidebar">
            {sections.map(s => (
              <span
                key={s.id}
                onClick={() => scrollToSection(s.id)}
                className={`docs-sidebar-link ${activeSection === s.id ? 'active' : ''}`}
              >
                {s.label}
              </span>
            ))}
          </aside>

          {/* CENTER: Content */}
          <div className="docs-content">
            {/* Section 1: Intro & Architecture */}
            <div id="intro" className="docs-section">
              <div className="heading-md" style={{ marginBottom: 16 }}>Intro & Architecture</div>
              <p className="body-md" style={{ marginBottom: 20 }}>
                Kode is a contrarian AI coding agent designed to replace the fragile "generate-and-pray" loop with a structured, verification-first pipeline:
              </p>
              <div style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 16 }}>
                Plan → Critique → Generate → Verify → Apply → Test
              </div>
              <p className="body-md" style={{ marginBottom: 20 }}>
                Unlike mainstream tools that write LLM outputs directly to your filesystem, Kode delegates patch generation to models but processes all modifications through a compiled Go orchestrator engine. The orchestrator acts as a strict verification oracle.
              </p>
              
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 12, marginTop: 24 }}>The Hybrid Architecture</h3>
              <p className="body-md" style={{ marginBottom: 24 }}>
                Kode splits responsibilities between Go and TypeScript for optimal performance and integration:
              </p>
              <ul style={{ paddingLeft: 20, color: 'var(--body)', lineHeight: 1.7, marginBottom: 32 }}>
                <li style={{ marginBottom: 12 }}>
                  <strong>Go Engine (Orchestrator):</strong> The `kode` binary, built in Go, manages fast AST parsing, syntax validation, blast radius computation, and security checks in under 50ms.
                </li>
                <li style={{ marginBottom: 12 }}>
                  <strong>TypeScript TUI Bridge:</strong> Rebranded from upstream `opencode`, the TUI is compiled with Bun/Vite. It spawns the Go engine as a subprocess to verify file content before committing patches.
                </li>
              </ul>
            </div>

            {/* Section 2: Installation & Setup */}
            <div id="installation" className="docs-section">
              <div className="heading-md" style={{ marginBottom: 16 }}>Installation & Setup</div>
              
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>1. Building the Go Binary</h3>
              <p className="body-md" style={{ marginBottom: 16 }}>Compile the Go CLI orchestrator from the project root:</p>
              <CodeBlock>
                <span className="prompt-sym">$</span>
                <code>go build -o bin/kode ./cmd/kode</code>
              </CodeBlock>
              <p className="body-md" style={{ marginBottom: 24 }}>
                This creates a single executable file in `bin/kode` (or `bin/kode.exe` on Windows).
              </p>

              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 12, marginTop: 24 }}>2. TUI Setup (Requires Node.js & Bun)</h3>
              <p className="body-md" style={{ marginBottom: 16 }}>Install the globally required package manager and build the frontend assets:</p>
              <CodeBlock>
                <span className="prompt-sym">$</span>
                <code>npm install -g bun</code>
              </CodeBlock>
              <CodeBlock>
                <span className="prompt-sym">$</span>
                <code>cd third_party/opencode && bun install && cd ../..</code>
              </CodeBlock>

              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 12, marginTop: 24 }}>3. Run the TUI</h3>
              <p className="body-md" style={{ marginBottom: 16 }}>Initialize TUI with interactive terminal controls:</p>
              <CodeBlock>
                <span className="prompt-sym">$</span>
                <code>./bin/kode tui</code>
              </CodeBlock>
            </div>

            {/* Section 3: Verification Gates */}
            <div id="gates" className="docs-section">
              <div className="heading-md" style={{ marginBottom: 16 }}>The 6 Verification Gates</div>
              <p className="body-md" style={{ marginBottom: 24 }}>
                Before any patch is written to disk, it must satisfy all configured gatekeepers:
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {[
                  ['1. Syntax Gate', 'Validates compile-ready code. Leverages Tree-sitter AST validation where possible, falling back to fast regex heuristics. Parses Go, TypeScript, JavaScript, Python, and Rust.'],
                  ['2. Imports Gate', 'Cross-references generated import paths against the local dependency graph. Rejects imports referencing hallucinated packages.'],
                  ['3. Calls Gate', 'Validates function and method call sites to ensure targeted symbols exist with compatible signatures, resolving the primary source of LLM hallucinations.'],
                  ['4. Blast Radius Gate', 'Analyzes code churn metrics. Walks the reverse dependency graph and blocks patches if the modified files downstream impact exceeds configured limits.'],
                  ['5. Architecture Gate', 'Enforces strict modular boundaries. Checks imports against modular layers in the configuration (e.g. preventing database layers from importing route handlers).'],
                  ['6. Security Gate', 'Scans files using Sicario SAST engine. Parses generated AST structure and flags potential vulnerabilities (e.g. SQL injection, hardcoded secrets, XSS) before writes occur.'],
                ].map(([gate, desc]) => (
                  <div key={gate} style={{ padding: '16px', background: '#09080d', borderRadius: 8, border: '1px solid var(--hairline-strong)' }}>
                    <div style={{ color: 'var(--ink)', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{gate}</div>
                    <p style={{ color: 'var(--body)', fontSize: 14, margin: 0, lineHeight: 1.6 }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 4: Commands Reference */}
            <div id="commands" className="docs-section">
              <div className="heading-md" style={{ marginBottom: 16 }}>Commands Reference</div>
              <p className="body-md" style={{ marginBottom: 20 }}>
                List of registered subcommands on the Go CLI orchestrator:
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  ['kode init', 'Scaffolds configuration files inside the `.kode/` folder.'],
                  ['kode plan [task]', 'Constructs a surgical 8K context graph identifying modified and reference files.'],
                  ['kode generate [prompt]', 'Queries the LLM interface to generate patch alternatives.'],
                  ['kode verify --input [file]', 'Manually runs all 6 verification checks on the target file.'],
                  ['kode run [prompt]', 'Generates, validates, and applies patches in a single pipeline.'],
                  ['kode loop [task]', 'Initiates the full workflow loop: plan, critique, generate, verify, and test.'],
                  ['kode explain [check]', 'Displays markdown detail outlining errors and fixes for syntax, imports, calls, etc.'],
                  ['kode daemon --poll [sec]', 'Runs background agent watching repository status and alerting on technical debt decay.'],
                  ['kode mcp serve', 'Exposes Kode verification tools to external editors using Model Context Protocol.'],
                  ['kode golf [file]', 'Spins Ghost worktrees to run competitive optimization benchmarks against code.'],
                  ['kode stats', 'Displays and summarizes the gatekeeper execution audit logs.'],
                  ['kode tui', 'Launches the React-based interactive terminal workspace.'],
                ].map(([cmd, desc]) => (
                  <div key={cmd} style={{ display: 'flex', gap: 16, padding: '16px 0', borderBottom: '1px solid var(--hairline)', flexWrap: 'wrap' }}>
                    <code style={{ color: 'var(--ink)', fontWeight: 700, minWidth: 200, fontSize: 15 }}>{cmd}</code>
                    <span style={{ color: 'var(--body)', fontSize: 15, flex: 1 }}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 5: Config Spec */}
            <div id="config" className="docs-section">
              <div className="heading-md" style={{ marginBottom: 16 }}>Configuration Specification</div>
              <p className="body-md" style={{ marginBottom: 16 }}>
                Manage project thresholds inside <code style={{ background: 'var(--surface-card)', padding: '2px 6px', borderRadius: 4 }}>.kode/config.json</code>:
              </p>
              <CodeBlock>
                <pre style={{ fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', margin: 0, color: '#a78bfa', fontSize: 13 }}>{`{
  "provider": "openai",
  "model": "gpt-4o",
  "tdd_mode": true,
  "max_blast_radius": 5,
  "token_budget_usd": 0.50,
  "blindfold_mode": false,
  "architecture_rules": {
    "disallowed_imports": {
      "internal/db": ["internal/gateway", "internal/daemon"]
    }
  }
}`}</pre>
              </CodeBlock>
            </div>

            {/* Section 6: Interactive TUI */}
            <div id="tui" className="docs-section">
              <div className="heading-md" style={{ marginBottom: 16 }}>Interactive TUI Workspace</div>
              <p className="body-md" style={{ marginBottom: 20 }}>
                The interactive React-based TUI (`kode tui`) runs in the terminal, bringing the visual power of browser interfaces directly into standard shells.
              </p>
              
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>Core Keyboard Controls</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                {[
                  ['Tab', 'Toggles between generative Chat modes and structural planning Graphs.'],
                  ['Ctrl + P', 'Brings up the Command Palette to trigger actions.'],
                  ['Ctrl + T', 'Switches between speculative code variations.'],
                  ['Esc', 'Interrupts active generation or verification loops.'],
                  ['@ [filename]', 'Triggers local file search to attach context to the prompt.'],
                  ['Ctrl + C', 'Safely exits the terminal workspace.'],
                ].map(([key, action]) => (
                  <div key={key} style={{ display: 'flex', gap: 16 }}>
                    <kbd style={{ background: '#1c1b22', border: '1px solid var(--hairline-strong)', padding: '2px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)', minWidth: 100, textAlign: 'center', color: 'var(--ink)' }}>{key}</kbd>
                    <span style={{ color: 'var(--body)' }}>{action}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 7: Advanced Features */}
            <div id="advanced" className="docs-section">
              <div className="heading-md" style={{ marginBottom: 16 }}>Advanced Features</div>
              
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Ghost Branches</h3>
              <p className="body-md" style={{ marginBottom: 20 }}>
                Spins up hidden git worktrees in parallel to explore multiple implementation paths. Each path runs through the Verification pipeline. The orchestrator merges only the best-performing result.
              </p>

              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 8, marginTop: 24 }}>Blindfold Mode</h3>
              <p className="body-md" style={{ marginBottom: 20 }}>
                Obfuscates code identifiers (e.g. package, class, function names) using SHA-256 hashes before sending context payloads to remote LLM providers, protecting proprietary software geometry.
              </p>

              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 8, marginTop: 24 }}>Code Golfing</h3>
              <p className="body-md" style={{ marginBottom: 20 }}>
                Runs competitive benchmark swarms via `kode golf [file]`. Pits multiple optimization paths (concurrency, memory consumption, algorithmic Big-O) against baseline test benchmarks and merges the winner.
              </p>
            </div>
          </div>

          {/* RIGHT SIDEBAR: Table of Contents */}
          <aside className="docs-toc">
            <div className="docs-toc-title">On this page</div>
            {sections.map(s => (
              <span
                key={`toc-${s.id}`}
                onClick={() => scrollToSection(s.id)}
                className={`docs-toc-link ${activeSection === s.id ? 'active' : ''}`}
              >
                {s.label}
              </span>
            ))}
          </aside>
        </div>
      </div>
    </section>
  )
}
