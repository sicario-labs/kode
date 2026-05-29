import { useState, useEffect } from 'react'

const snippets = {
  curl: 'curl -fsSL https://trykode.xyz/install | bash',
  go: 'go install github.com/sicario-labs/kode/cmd/kode@latest',
  npm: 'npm install -g @sicario-labs/kode',
}

const AnimatedTuiMockup = () => {
  const [phase, setPhase] = useState('initial');
  const [typedText, setTypedText] = useState('');
  const [gateStep, setGateStep] = useState(0);
  const fullText = "refactor the auth middleware";

  useEffect(() => {
    let timer;
    if (phase === 'initial') {
      setGateStep(0);
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
          setTimeout(() => setPhase('verifying'), 800);
        }
      }, 45);
      return () => clearInterval(interval);
    } else if (phase === 'verifying') {
      let step = 0;
      const interval = setInterval(() => {
        step++;
        setGateStep(step);
        if (step >= 10) {
          clearInterval(interval);
          setTimeout(() => setPhase('done'), 5000);
        }
      }, 400);
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
    transformOrigin: '20% 20%',
    position: 'relative',
    height: '100%',
    width: '100%'
  };

  const gates = [
    { name: 'Syntax',        detail: 'Go AST parsed cleanly' },
    { name: 'Imports',       detail: 'all imports resolvable' },
    { name: 'Calls',         detail: 'no hallucinated functions' },
    { name: 'Blast Radius',  detail: '2 files modified (limit: 10)' },
    { name: 'Architecture',  detail: 'no boundary violations' },
    { name: 'Security',      detail: 'no vulnerabilities injected' },
    { name: 'Sandbox Replay', detail: 'CPU execution bounds passed' },
    { name: 'QR Tunnel',     detail: 'local tunnel server booted' },
    { name: 'Browser E2E',   detail: 'Playwright test suite passed' },
  ];

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
                ) : 'Ask anything... "Refactor the auth middleware"'}
              </div>
              <div className="tui-meta-row">
                <span className="tui-action-tag">Build</span>
                <span className="tui-dot-separator">&middot;</span>
                <span className="tui-model-tag">Claude Sonnet 4</span>
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
                Every file write passes through 9 verification gates before it touches your filesystem
              </span>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', animation: 'fadeIn 0.2s', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 13, color: '#e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 12, marginBottom: 12 }}>
               <span style={{ fontWeight: 700, color: '#fff' }}># Refactor auth middleware</span>
               <span style={{ color: '#8e8c9f' }}>8,200 tokens ($0.02)</span>
            </div>
            
            <div style={{ marginBottom: 12, color: '#e5e7eb' }}>Generated 3 hunks for <span style={{ color: '#a78bfa' }}>internal/auth/middleware.go</span></div>
            
            <div style={{ marginBottom: 8, color: '#8e8c9f', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ▸ Verification Gates
            </div>

            {gates.map((gate, i) => (
              gateStep >= (i + 1) && (
                <div key={gate.name} style={{ 
                  marginBottom: 4, 
                  animation: 'fadeInUp 0.3s forwards',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <span style={{ color: '#4ade80', fontWeight: 700 }}>✓</span>
                  <span style={{ color: '#e5e7eb', minWidth: 120 }}>[{gate.name}]</span>
                  <span style={{ color: '#8e8c9f' }}>{gate.detail}</span>
                </div>
              )
            ))}

            {gateStep >= 10 && (
              <div style={{ 
                marginTop: 12, 
                padding: '8px 12px', 
                background: 'rgba(74, 222, 128, 0.08)', 
                border: '1px solid rgba(74, 222, 128, 0.2)', 
                borderRadius: 4,
                animation: 'fadeInUp 0.4s forwards',
                color: '#4ade80',
                fontWeight: 600
              }}>
                Applied 3 hunks to internal/auth/middleware.go [✓ verified]
              </div>
            )}

            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#13111c', padding: '12px 16px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.03)' }}>
               <div>
                 <span style={{ color: '#4ade80', marginRight: 12, fontWeight: 700 }}>Build</span>
                 <span style={{ color: '#fff' }}>Claude Sonnet 4</span>
                 <span style={{ color: '#8e8c9f', marginLeft: 8 }}>9/9 gates passed</span>
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
            <span className="hero-badge">[+] Pre-launch &mdash; install the binary, bring your key, start shipping verified code</span>
            <h1 className="display-xl" style={{ marginBottom: 16 }}>
              Stop generating.<br />Start verifying.
            </h1>
            <p className="body-md hero-sub">
              Every other agent trusts the LLM and prays. Kode runs 9 deterministic verification gates &mdash; syntax, imports, calls, blast radius, architecture, security, sandbox replay, QR tunnel, and browser E2E &mdash; before any generated code touches your filesystem.
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
