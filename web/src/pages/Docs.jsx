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
  const [activeSection, setActiveSection] = useState('installation')

  const sections = [
    { id: 'intro', label: 'Intro' },
    { id: 'installation', label: 'Installation' },
    { id: 'quickstart', label: 'Quick Start' },
    { id: 'gates', label: 'Verification Gates' },
    { id: 'tui', label: 'Interactive TUI' },
    { id: 'ghost', label: 'Ghost Branches' },
    { id: 'daemon', label: 'Daemon Mode' },
    { id: 'mcp', label: 'MCP Server' },
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
            <div id="intro" className="docs-section">
              <div className="heading-md" style={{ marginBottom: 16 }}>Intro</div>
              <p className="body-md" style={{ marginBottom: 24 }}>Get started with Kode.</p>
              <p className="body-md" style={{ marginBottom: 32 }}>Kode is an open source AI coding agent. It is available as a terminal-based interface, desktop app, or IDE extension.</p>
              
              <div style={{ background: '#09080d', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--hairline-strong)', marginBottom: 24, boxShadow: '0 12px 32px rgba(0,0,0,0.1)' }}>
                <div style={{ background: '#1c1b22', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#8e8c9f', fontFamily: 'system-ui, sans-serif' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56' }} />
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f' }} />
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
                     <span style={{ color: '#8b5cf6' }}>📁</span> Kode | Optimize database query in repo ...
                  </div>
                </div>
                <div style={{ padding: '24px', color: '#e5e7eb', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 16, marginBottom: 16 }}>
                     <span style={{ fontWeight: 700 }}># Optimize database query in repo workflow</span>
                     <span style={{ color: '#8e8c9f' }}>42,150 &nbsp; 15% &nbsp; ($0.12)</span>
                  </div>
                  
                  <div style={{ background: '#13111c', padding: '12px 16px', borderRadius: 4, marginBottom: 16, border: '1px solid rgba(255,255,255,0.03)' }}>
                    Find the slow query in the user model and optimize it
                  </div>
                  
                  <div style={{ marginBottom: 16 }}>I'll search for the slow query in the database models.</div>
                  <div style={{ color: '#8e8c9f', marginBottom: 16 }}>
                    * Grep "SELECT.*FROM users"
                    <br/>* Grep "User.query"
                  </div>
                  
                  <div style={{ marginBottom: 16 }}>Let me check the schema and indices for the users table:</div>
                  <div style={{ color: '#8e8c9f', marginBottom: 16 }}>
                    * Read internal/db/schema.sql
                    <br/>* Run psql -c "\d users"
                  </div>
                  
                  <div style={{ marginBottom: 16 }}>I found the missing index on the <code>last_login</code> column. Let me apply the fix and verify it through the gates:</div>
                  
                  <div style={{ color: '#8e8c9f', marginBottom: 16 }}>
                    → Read internal/db/models.go
                    <br/>→ Read internal/db/migrations/005_add_index.sql
                  </div>
                  
                  <div style={{ marginBottom: 16 }}>I found the query. Let me ask if you want to proceed with the index creation:</div>
                  
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
                    <span style={{ color: '#8b5cf6' }}>~</span> Asking questions...
                  </div>
                  
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 24, fontWeight: 700 }}>
                    <span style={{ color: '#60a5fa' }}>▣</span> Build &middot; deepseek-4-flash
                  </div>
                  
                  <div style={{ background: '#181622', padding: '16px', borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                     <div>
                       <span style={{ color: '#60a5fa', marginRight: 12 }}>Build</span>
                       <span>Deepseek 4 Flash</span>
                       <span style={{ color: '#8e8c9f', marginLeft: 8 }}>Kode Pro</span>
                     </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#626070', marginTop: 12, fontSize: 12 }}>
                    <div>........ &nbsp; <span style={{ color: '#c4c3d4' }}>esc</span> interrupt</div>
                    <div><span style={{ color: '#c4c3d4' }}>ctrl+t</span> variants &nbsp; <span style={{ color: '#c4c3d4' }}>tab</span> agents &nbsp; <span style={{ color: '#c4c3d4' }}>ctrl+p</span> commands</div>
                  </div>
                </div>
              </div>
            </div>

            <div id="installation" className="docs-section">
              <div className="heading-md" style={{ marginBottom: 16 }}>Installation</div>
              <p className="body-md" style={{ marginBottom: 16 }}>Install Kode with one command:</p>
              <CodeBlock>
                <span className="prompt-sym">$</span>
                <code>curl -fsSL https://trykode.xyz/install | bash</code>
              </CodeBlock>
              <p className="body-md" style={{ marginBottom: 16 }}>Or install via Go:</p>
              <CodeBlock>
                <span className="prompt-sym">$</span>
                <code>go install github.com/sicario-labs/kode/cmd/kode@latest</code>
              </CodeBlock>
            </div>

            <div id="quickstart" className="docs-section">
              <div className="heading-md" style={{ marginBottom: 16 }}>Quick start</div>
              <p className="body-md" style={{ marginBottom: 16 }}>Initialize Kode in your project:</p>
              <CodeBlock>
                <span className="prompt-sym">$</span>
                <code>cd my-project &amp;&amp; kode init</code>
              </CodeBlock>
              <p className="body-md" style={{ marginBottom: 16 }}>Run a full loop:</p>
              <CodeBlock>
                <span className="prompt-sym">$</span>
                <code>kode loop &quot;add user authentication to the API&quot;</code>
              </CodeBlock>
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
              <div className="heading-md" style={{ marginBottom: 16 }}>Interactive TUI</div>
              <p className="body-md" style={{ marginBottom: 16 }}>Launch the interactive terminal UI:</p>
              <CodeBlock>
                <span className="prompt-sym">$</span>
                <code>kode tui</code>
              </CodeBlock>
              <p className="body-md" style={{ marginBottom: 16 }}>
                The TUI provides a chat interface, context graph, generation status, gatekeeper verdicts, and file diffs.
              </p>
              <div style={{ marginBottom: 16 }}>
                <span style={{ color: 'var(--ink)', fontWeight: 700 }}>[+] Tab Mode:</span> <span style={{ color: 'var(--body)' }}>Press <code>Tab</code> to switch between Build mode and Plan mode.</span>
              </div>
              <div style={{ marginBottom: 16 }}>
                <span style={{ color: 'var(--ink)', fontWeight: 700 }}>[+] File Search:</span> <span style={{ color: 'var(--body)' }}>Type <code>@</code> to fuzzy-search and attach files to your prompt.</span>
              </div>
              <div style={{ marginBottom: 16 }}>
                <span style={{ color: 'var(--ink)', fontWeight: 700 }}>[+] Time Travel:</span> <span style={{ color: 'var(--body)' }}>Type <code>/undo</code> and <code>/redo</code> to safely revert ast-level patches without touching git.</span>
              </div>
            </div>

            <div id="ghost" className="docs-section">
              <div className="heading-md" style={{ marginBottom: 16 }}>Ghost branches</div>
              <p className="body-md" style={{ marginBottom: 16 }}>Kode can explore multiple implementation paths in parallel via Ghost Branches:</p>
              <CodeBlock>
                <span className="prompt-sym">$</span>
                <code>kode loop --branches=3 "optimize the database query"</code>
              </CodeBlock>
              <p className="body-md">
                Kode will create 3 hidden git worktrees, attempt 3 distinct strategies, score them against the Verification Gates, and only present the winning patch to you.
              </p>
            </div>

            <div id="daemon" className="docs-section">
              <div className="heading-md" style={{ marginBottom: 16 }}>Daemon mode</div>
              <p className="body-md" style={{ marginBottom: 16 }}>Run Kode as a silent background watcher:</p>
              <CodeBlock>
                <span className="prompt-sym">$</span>
                <code>kode daemon --poll 30 --threshold 40</code>
              </CodeBlock>
              <p className="body-md">
                The daemon polls your git history every 30 seconds. If blast radius metrics decay, it speculatively fixes technical debt on a ghost branch and prompts you via TUI IPC to merge the fix.
              </p>
            </div>

            <div id="mcp" className="docs-section">
              <div className="heading-md" style={{ marginBottom: 16 }}>MCP server</div>
              <p className="body-md" style={{ marginBottom: 16 }}>Expose Kode's Context Engine and Verification loop to external IDEs (like Claude Desktop or Antigravity):</p>
              <CodeBlock>
                <span className="prompt-sym">$</span>
                <code>kode mcp serve</code>
              </CodeBlock>
              <p className="body-md">
                Uses the standard Model Context Protocol (stdio JSON-RPC) to expose <code>kode_plan</code> and <code>kode_apply_verified</code> as tools.
              </p>
            </div>

            <div id="config" className="docs-section">
              <div className="heading-md" style={{ marginBottom: 16 }}>Configuration</div>
              <p className="body-md" style={{ marginBottom: 16 }}>
                Kode is configured through <code style={{ background: 'var(--surface-card)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--hairline)' }}>.kode/config.json</code>:
              </p>
              <CodeBlock>
                <pre style={{ fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', margin: 0, color: '#8b5cf6' }}>{`{
  "provider": "openai",
  "model": "gpt-4o",
  "tdd_mode": true,
  "max_blast_radius": 5,
  "token_budget_usd": 0.50,
  "blindfold_mode": false
}`}</pre>
              </CodeBlock>
            </div>

            <div id="commands" className="docs-section">
              <div className="heading-md" style={{ marginBottom: 16 }}>Commands reference</div>
              {[
                ['kode init', 'Scaffold .kode/config.json with auto-detected test command'],
                ['kode plan <task>', 'Build a surgical 8K context graph for the given task'],
                ['kode generate <prompt>', 'Generate patches via LLM'],
                ['kode verify --input <file>', 'Run all 5 gate checks on a file'],
                ['kode run <prompt>', 'Full generate -> verify -> apply pipeline'],
                ['kode loop <task>', 'Full Plan -> Generate -> Verify -> Apply cycle'],
                ['kode loop --branches=N', 'Speculatively fix using parallel ghost branches'],
                ['kode daemon', 'Run background tech debt watcher'],
                ['kode mcp serve', 'Start the Model Context Protocol server'],
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
