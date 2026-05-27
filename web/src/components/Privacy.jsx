export default function Privacy() {
  return (
    <section>
      <div className="wrapper">
        <div className="features-list">
          <span style={{ fontSize: 24, color: 'var(--ink)', marginBottom: 16, display: 'block' }}>[+]</span>
          <div className="heading-md" style={{ marginBottom: 16 }}>Built for privacy first</div>
          <p className="body-md">
            Kode's Blindfold Mode obfuscates every identifier — package names, functions, types — using deterministic SHA-256 salt before sending your code to the LLM. The obfuscation is reversed on output. Your proprietary logic is never exposed in plain text. No code, no context data is stored by the engine.{' '}
            <a href="/privacy" className="link-md">Learn more about privacy.</a>
          </p>
        </div>
      </div>
    </section>
  )
}
