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
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
                <img src="/kode-logo.svg" alt="Kode" width="160" height="35" style={{ display: 'block' }} />
              </div>
              <div className="tui-prompt-row">
                <span className="pipe">|</span>
                <span className="cmd">kode loop &quot;add user authentication&quot;</span>
                <span className="model">Claude 3.5 Sonnet</span>
              </div>
              <div className="tui-hints">
                <span>tab  switch agent</span>
                <span>ctrl-p  commands</span>
                <span>KODE_BIN  gatekeeper active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
