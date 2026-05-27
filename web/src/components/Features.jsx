const features = [
  { label: 'Blast Radius Lockdown', desc: 'Hard-limit on files touched per verify round. Walks the full dependency graph backward from every modified file. Exceed the cap? Blocked.' },
  { label: 'Test-First Lockjaw', desc: 'TDD enforcement: no prod file write passes without a test file present. Runs your test suite automatically — blocks on pass, allows on fail.' },
  { label: 'Context Budgeting', desc: 'Hard token and cost caps per loop cycle with per-model pricing. Short-circuits the pipeline before the next LLM call if budget is exhausted.' },
  { label: 'Surgical Revert', desc: 'Non-destructive undo at the hunk level. Original content is snapshotted before every write; revert restores exact line ranges.' },
  { label: 'Blindfold Mode', desc: 'Two-way identifier obfuscation before LLM submission. Package names, functions, types — deterministically replaced with SHA-256 salt. Reversed on output.' },
  { label: 'Any model, any provider', desc: 'Supports every OpenAI-compatible API. Claude, GPT, Gemini, local models via Ollama — or the Kode gateway at api.trykode.xyz.' },
]

export default function Features() {
  return (
    <section id="features">
      <div className="wrapper">
        <div className="features-list">
          <div className="heading-md" style={{ marginBottom: 24 }}>What is Kode?</div>
          <p className="body-md" style={{ marginBottom: 32 }}>
            Kode is an open source agent that helps you write code in your terminal. Every generated patch runs through a compiled Go verification gate before it touches your filesystem — a safety guarantee no TS-only tool can offer.
          </p>
          {features.map(f => (
            <div key={f.label} className="feature-row">
              <span className="marker">[+]</span>
              <div>
                <span className="label">{f.label}</span>
                <br />
                <span className="desc">{f.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
