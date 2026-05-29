export default function Stats() {
const stats = [
    { value: '9', label: 'Verification gates per file write', sub: 'syntax → imports → calls → blast radius → architecture → security → sandbox → qr tunnel → browser' },
    { value: '<50ms', label: 'Gate execution time', sub: 'Compiled Go binary, zero CGo. The user never notices.' },
    { value: '10,839', label: 'Lines of original Go engine code', sub: '18 packages. 90 files. 100% original.' },
    { value: '5', label: 'Languages verified', sub: 'Go, TypeScript, JavaScript, Python, Rust' },
    { value: '25+', label: 'AI providers supported', sub: 'Claude, GPT, Gemini, Bedrock, local models via Ollama, or the Kode Gateway' },
    { value: '0', label: 'Lines of your code stored by Kode', sub: '100% local execution. Blindfold Mode for extra privacy.' },
  ]

  return (
    <section>
      <div className="wrapper">
        <div className="features-list">
          <div className="heading-md" style={{ marginBottom: 8 }}>The numbers</div>
          <p className="body-md" style={{ maxWidth: 600 }}>
            Built in 3 days by a solo founder. 10,839 lines of Go that do what no incumbent offers &mdash; deterministic pre-write verification for AI-generated code.
          </p>
          <div className="stat-grid">
            {stats.map((s, i) => (
              <div key={i} className="stat-tile">
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
                <div className="stat-sub">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
