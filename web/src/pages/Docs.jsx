import { useState, useEffect } from 'react'

export default function Docs() {
  const [activeSection, setActiveSection] = useState('installation')

  const sections = [
    { id: 'installation', label: 'Installation' },
    { id: 'quickstart', label: 'Quick Start' },
    { id: 'gates', label: 'Verification Gates' },
    { id: 'tui', label: 'Using the TUI' },
    { id: 'config', label: 'Configuration' },
    { id: 'commands', label: 'Commands Reference' },
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
          <span className="hero-badge" style={{ marginBottom: 24 }}>[x] Documentation</span>
          <h1 className="display-xl" style={{ marginBottom: 24 }}>Getting started with Kode</h1>
          <p className="body-md hero-sub">
            Kode is a Go-powered AI coding agent that verifies every generated patch through 5 deterministic gates before touching your filesystem.
          </p>
        </div>

        <div className="docs-container">
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

          <div className="docs-content">
            <div id="installation" className="docs-section">
              <div className="heading-md" style={{ marginBottom: 16 }}>Installation</div>
              <p className="body-md" style={{ marginBottom: 16 }}>Install Kode with one command:</p>
              <div className="docs-code-block">
                <span className="prompt-sym">$</span>
                <code>curl -fsSL https://trykode.xyz/install.sh | bash</code>
              </div>
              <p className="body-md" style={{ marginBottom: 16 }}>Or install via Go:</p>
              <div className="docs-code-block">
                <span className="prompt-sym">$</span>
                <code>go install github.com/kode/kode/cmd/kode@latest</code>
              </div>
            </div>

            <div id="quickstart" className="docs-section">
              <div className="heading-md" style={{ marginBottom: 16 }}>Quick start</div>
              <p className="body-md" style={{ marginBottom: 16 }}>Initialize Kode in your project:</p>
              <div className="docs-code-block">
                <span className="prompt-sym">$</span>
                <code>cd my-project &amp;&amp; kode init</code>
              </div>
              <p className="body-md" style={{ marginBottom: 16 }}>Run a full loop:</p>
              <div className="docs-code-block">
                <span className="prompt-sym">$</span>
                <code>kode loop &quot;add user authentication to the API&quot;</code>
              </div>
            </div>

            <div id="gates" className="docs-section">
              <div className="heading-md" style={{ marginBottom: 16 }}>Verification gates</div>
              <p className="body-md" style={{ marginBottom: 24 }}>
                Every generated patch passes through 5 gates before it reaches disk:
              </p>
              {[
                ['Syntax', 'Validates that the generated code compiles without syntax errors.'],
                ['Imports', 'Checks all imports resolve correctly and no unused imports exist.'],
                ['Calls', 'Verifies function signatures match across call sites.'],
                ['Blast Radius', 'Limits how many files can be modified per cycle. Walks the reverse dependency graph.'],
                ['Architecture + TDD', 'Enforces test-first workflow. Blocks prod writes without corresponding test files.'],
              ].map(([gate, desc]) => (
                <div key={gate} style={{ display: 'flex', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--hairline)' }}>
                  <span style={{ color: 'var(--ink)', fontWeight: 700, minWidth: 140 }}>[{gate}]</span>
                  <span style={{ color: 'var(--body)' }}>{desc}</span>
                </div>
              ))}
            </div>

            <div id="tui" className="docs-section">
              <div className="heading-md" style={{ marginBottom: 16 }}>Using the TUI</div>
              <p className="body-md" style={{ marginBottom: 16 }}>Launch the interactive terminal UI:</p>
              <div className="docs-code-block">
                <span className="prompt-sym">$</span>
                <code>kode tui</code>
              </div>
              <p className="body-md">
                The TUI provides a split-panel interface with context graph, generation status, gatekeeper verdicts, and file diffs — all in your terminal.
              </p>
            </div>

            <div id="config" className="docs-section">
              <div className="heading-md" style={{ marginBottom: 16 }}>Configuration</div>
              <p className="body-md" style={{ marginBottom: 16 }}>
                Kode is configured through <code style={{ background: 'var(--surface-card)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--hairline)' }}>.kode/config.json</code>:
              </p>
              <div className="docs-code-block" style={{ lineHeight: 1.8 }}>
                <pre style={{ fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', margin: 0 }}>{`{
  "provider": "openai",
  "model": "gpt-4o",
  "tdd_mode": true,
  "max_blast_radius": 5,
  "token_budget_usd": 0.50,
  "blindfold_mode": false
}`}</pre>
              </div>
            </div>

            <div id="commands" className="docs-section">
              <div className="heading-md" style={{ marginBottom: 16 }}>Commands reference</div>
              {[
                ['kode init', 'Scaffold .kode/config.json with auto-detected test command'],
                ['kode plan <task>', 'Build a surgical 8K context graph for the given task'],
                ['kode generate <prompt>', 'Generate patches via LLM'],
                ['kode verify --input <file>', 'Run all 5 gate checks on a file'],
                ['kode run <prompt>', 'Full generate -> verify -> apply pipeline'],
                ['kode loop <task>', 'Full Plan -> Generate -> Verify -> Apply -> Test cycle'],
                ['kode revert', 'Undo the last applied hunk (surgical AST revert)'],
                ['kode stats', 'Analyze gatekeeper audit log'],
                ['kode tui', 'Launch interactive terminal UI'],
              ].map(([cmd, desc]) => (
                <div key={cmd} style={{ display: 'flex', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--hairline)', flexWrap: 'wrap' }}>
                  <code style={{ color: 'var(--ink)', fontWeight: 700, minWidth: 220, fontSize: 15 }}>{cmd}</code>
                  <span style={{ color: 'var(--body)', fontSize: 15 }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
