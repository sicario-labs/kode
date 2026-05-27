import { useState } from 'react'

const snippets = {
  curl: 'curl -fsSL https://trykode.xyz/install.sh | bash',
  go: 'go install github.com/kode/kode/cmd/kode@latest',
  npm: 'npm install -g kode',
}

export default function Hero() {
  const [tab, setTab] = useState('curl')
  const [copied, setCopied] = useState(null)

  const handleCopy = (key) => {
    navigator.clipboard?.writeText(snippets[key]).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  return (
    <section className="hero-section" id="install">
      <div className="wrapper">
        <div className="hero-grid">
          <div className="hero-left">
            <span className="hero-badge">[+] Desktop beta available on macOS, Windows, Linux</span>
            <h1 className="display-xl" style={{ marginBottom: 16 }}>
              The safe AI<br />coding agent
            </h1>
            <p className="body-md hero-sub">
              Connect any model from any provider, including Claude, GPT, Gemini, local models, and more.
            </p>

            <div className="install-container">
              <div className="install-tabs">
                {['curl', 'go', 'npm'].map(key => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`install-tab ${tab === key ? 'active' : ''}`}
                  >
                    {key}
                  </button>
                ))}
              </div>
              <div className="install-snippet">
                <code>{snippets[tab]}</code>
                <button
                  onClick={() => handleCopy(tab)}
                  className="copy-btn"
                >
                  {copied === tab ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          <div className="hero-right">
            <div className="tui-mockup">
              <div className="tui-titlebar">
                <div className="tui-dots">
                  <div className="tui-dot red"></div>
                  <div className="tui-dot yellow"></div>
                  <div className="tui-dot green"></div>
                </div>
                <div className="tui-title">kode tui - ~/projects/sicario</div>
              </div>
              <div className="tui-body">
                <div className="tui-sidebar">
                  <div className="section-title">[-] WORKSPACE</div>
                  <div>├─ [+] cmd/kode/</div>
                  <div>├─ [+] internal/</div>
                  <div>├─ [x] go.mod</div>
                  <div>└─ [x] README.md</div>
                  <br />
                  <div className="section-title">[+] SESSIONS</div>
                  <div>├─ [✓] add-auth (2m ago)</div>
                  <div>└─ [✓] init-git (1d ago)</div>
                </div>
                <div className="tui-main">
                  <div className="tui-output">
                    <div className="tui-output-line" style={{ color: 'var(--mute)' }}>$ kode loop &quot;add user authentication&quot;</div>
                    <br />
                    <div className="tui-output-line" style={{ fontWeight: 700, color: 'var(--ink)' }}>PLANNING</div>
                    <div className="tui-output-line success">[✓] Build surgical 8K context graph ..... [OK]</div>
                    <div className="tui-output-line success">[✓] Validate request parameters ......... [OK]</div>
                    <br />
                    <div className="tui-output-line" style={{ fontWeight: 700, color: 'var(--ink)' }}>GENERATING</div>
                    <div className="tui-output-line success">[✓] Generate patches via Claude 3.5 ..... [OK]</div>
                    <br />
                    <div className="tui-output-line" style={{ fontWeight: 700, color: 'var(--ink)' }}>VERIFYING (Go Gatekeeper)</div>
                    <div className="tui-output-line success">├── Gate 1: Syntax compilation .......... [PASS]</div>
                    <div className="tui-output-line success">├── Gate 2: Static linter check ......... [PASS]</div>
                    <div className="tui-output-line success">├── Gate 3: Test runner execution ....... [PASS]</div>
                    <div className="tui-output-line success">├── Gate 4: Blast radius control ........ [PASS]</div>
                    <div className="tui-output-line success">└── Gate 5: TDD validation .............. [PASS]</div>
                    <br />
                    <div className="tui-output-line" style={{ fontWeight: 700, color: 'var(--ink)' }}>APPLY & TEST</div>
                    <div className="tui-output-line success">[✓] Diffs successfully applied to disk</div>
                    <div className="tui-output-line success">[✓] Tests passed. 0 failures.</div>
                  </div>
                  <div className="tui-composer">
                    <div className="tui-composer-header">
                      <span>[composer] Claude 3.5 Sonnet</span>
                      <span>KODE_BIN active</span>
                    </div>
                    <div className="tui-composer-input">
                      <span className="pipe">|</span>
                      <span style={{ color: 'var(--on-dark)' }}>kode loop "add user authentication"</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
