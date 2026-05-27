import { useState, useEffect } from 'react'

const snippets = {
  curl: 'curl -fsSL https://trykode.xyz/install | bash',
  go: 'go install github.com/sicario-labs/kode/cmd/kode@latest',
  npm: 'npm install -g kode',
}

const AnimatedTuiMockup = () => {
  const [phase, setPhase] = useState('initial');
  const [typedText, setTypedText] = useState('');
  const [outputStep, setOutputStep] = useState(0);
  const fullText = "optimize the database query";

  useEffect(() => {
    let timer;
    if (phase === 'initial') {
      setOutputStep(0);
      timer = setTimeout(() => setPhase('moving'), 800);
    } else if (phase === 'moving') {
      timer = setTimeout(() => setPhase('typing'), 1000);
    } else if (phase === 'typing') {
      let i = 0;
      const interval = setInterval(() => {
        setTypedText(fullText.slice(0, i + 1));
        i++;
        if (i === fullText.length) {
          clearInterval(interval);
          setTimeout(() => setPhase('processing'), 800);
        }
      }, 50);
      return () => clearInterval(interval);
    } else if (phase === 'processing') {
      let step = 0;
      const interval = setInterval(() => {
        step++;
        setOutputStep(step);
        if (step >= 4) {
          clearInterval(interval);
          setTimeout(() => setPhase('done'), 4000);
        }
      }, 800);
      return () => clearInterval(interval);
    } else if (phase === 'done') {
      setPhase('initial');
      setTypedText('');
    }
    return () => clearTimeout(timer);
  }, [phase]);

  const mouseStyle = {
    position: 'absolute',
    top: 0, left: 0,
    transform: phase === 'initial' ? 'translate(280px, 320px) scale(1)' : 
               phase === 'moving' ? 'translate(60px, 105px) scale(1)' : 
               'translate(60px, 105px) scale(0.8)',
    transition: 'transform 1s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.3s',
    opacity: (phase === 'initial' || phase === 'moving') ? 1 : 0,
    zIndex: 50,
    pointerEvents: 'none'
  };

  const zoomStyle = {
    transition: 'transform 1.2s cubic-bezier(0.25, 1, 0.5, 1)',
    transform: (phase === 'moving' || phase === 'typing') ? 'scale(1.04)' : 'scale(1)',
    transformOrigin: '20% 20%', // Zooms in slightly towards the top-left input box
    position: 'relative',
    height: '100%',
    width: '100%'
  };

  return (
    <div className="tui-mockup" style={{ position: 'relative', minHeight: 480, overflow: 'hidden' }}>
      <div style={zoomStyle}>
        {/* Mouse Cursor */}
        <div style={mouseStyle}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.3))' }}>
            <path d="M5.5 3.5L18.5 11.5L11.5 13L9 20L5.5 3.5Z" fill="white" stroke="#111" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </div>

        {(phase === 'initial' || phase === 'moving' || phase === 'typing') ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', animation: 'fadeIn 0.3s' }}>
            <div className="tui-logo-row">
              <img src="/kode-logo.svg" alt="Kode" width="160" height="35" />
            </div>
            <div className="tui-input-box" style={{ borderColor: phase === 'typing' ? '#8b5cf6' : 'rgba(255, 255, 255, 0.03)', transition: 'border-color 0.2s' }}>
              <div className="tui-prompt-text" style={{ color: (phase === 'typing' && typedText) ? '#fff' : '#8e8c9f' }}>
                {(phase === 'typing' || typedText) ? (
                  <>
                    {typedText}<span style={{ animation: 'blink 1s step-end infinite', backgroundColor: '#fff', display: 'inline-block', width: 8, height: 15, verticalAlign: 'middle', marginLeft: 4 }} />
                  </>
                ) : 'Ask anything... "Draft a RFC for the proposal"'}
              </div>
              <div className="tui-meta-row">
                <span className="tui-action-tag">Build</span>
                <span className="tui-dot-separator">&middot;</span>
                <span className="tui-model-tag">Deepseek 4 Flash</span>
              </div>
            </div>
            <div className="tui-hints-row">
              <span className="tui-hint-key">tab</span>
              <span className="tui-hint-val">agents</span>
              <span className="tui-hint-key" style={{ marginLeft: 12 }}>ctrl+p</span>
              <span className="tui-hint-val">commands</span>
            </div>
            <div className="tui-tip-row">
              <span className="tui-tip-tag">&bull; Tip</span>
              <span className="tui-tip-text">
                Run <strong>/init</strong> to auto-generate project rules based on your codebase
              </span>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', animation: 'fadeIn 0.2s', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 13, color: '#e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 16, marginBottom: 16 }}>
               <span style={{ fontWeight: 700, color: '#fff' }}># Optimize database query in repo workflow</span>
               <span style={{ color: '#8e8c9f' }}>12,400 15% ($0.04)</span>
            </div>
            
            <div style={{ marginBottom: 16, color: '#e5e7eb' }}>I'll search for the slow query in the database models.</div>
            
            {outputStep >= 1 && (
              <div style={{ color: '#8e8c9f', marginBottom: 16, animation: 'fadeInUp 0.3s forwards' }}>
                * Grep "SELECT.*FROM users"<br/>
                * Grep "User.query"
              </div>
            )}
            
            {outputStep >= 2 && (
              <div style={{ marginBottom: 16, color: '#e5e7eb', animation: 'fadeInUp 0.3s forwards' }}>Let me check the schema and indices for the users table:</div>
            )}
            
            {outputStep >= 3 && (
              <div style={{ color: '#8e8c9f', marginBottom: 16, animation: 'fadeInUp 0.3s forwards' }}>
                * Read internal/db/schema.sql<br/>
                * Run psql -c "\d users"
              </div>
            )}
            
            {outputStep >= 4 && (
              <>
                <div style={{ marginBottom: 16, color: '#e5e7eb', animation: 'fadeInUp 0.3s forwards' }}>I found the missing index. Let me apply the fix and verify:</div>
                <div style={{ color: '#60a5fa', marginBottom: 16, animation: 'fadeInUp 0.3s forwards' }}>
                  → [Syntax] Passed<br/>
                  → [Blast Radius] Passed (1 file modified)<br/>
                  → [Architecture] Passed
                </div>
              </>
            )}

            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#13111c', padding: '12px 16px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.03)' }}>
               <div>
                 <span style={{ color: '#60a5fa', marginRight: 12, fontWeight: 700 }}>Build</span>
                 <span style={{ color: '#fff' }}>Deepseek 4 Flash</span>
                 <span style={{ color: '#8e8c9f', marginLeft: 8 }}>Kode Pro</span>
               </div>
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes blink { 50% { opacity: 0; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
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
            <AnimatedTuiMockup />
          </div>
        </div>
      </div>
    </section>
  )
}
