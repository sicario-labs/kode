export default function Architecture() {
  const stages = [
    { name: 'Plan', desc: 'Build 8K-token context graph from project structure', active: false },
    { name: 'Critique', desc: '4 lenses review the task before generation starts', active: false },
    { name: 'Generate', desc: 'LLM produces structured code patches with budget tracking', active: false },
    { name: 'Verify', desc: '9 gates check every file before disk write', active: true },
    { name: 'Apply', desc: 'Atomic write with snapshot for instant rollback', active: false },
    { name: 'Test', desc: 'Auto-detect and run your test suite. Fail = rollback.', active: false },
    { name: 'Bench', desc: 'Golf gate: benchmark regression detection', active: false },
  ]

  return (
    <section>
      <div className="wrapper">
        <div className="features-list">
          <div className="heading-md" style={{ marginBottom: 24 }}>[x] Architecture — the 7-stage pipeline</div>
          <p className="body-md" style={{ marginBottom: 8 }}>
            The Go engine orchestrates a 7-stage pipeline for every task. The <strong>Verify</strong> stage is the thesis — a compiled Go binary that runs 9 inline gates before any file write is permitted.
          </p>
          <div className="arch-flow">
            <div className="arch-stages">
              {stages.map((s, i) => (
                <span key={s.name}>
                  <span className={`stage ${s.active ? 'verify-stage' : ''}`} title={s.desc}>
                    {s.name}
                  </span>
                  {i < stages.length - 1 && <span className="arrow">&rarr;</span>}
                </span>
              ))}
            </div>
            <div className="gate-note">
              <strong>How it differs:</strong> Cursor and Copilot run <code>LLM → disk</code> (pray it works). Kode runs <code>LLM → 9 gates → disk</code> (verified) — or <code>fail → LLM self-corrects → retry</code>. The user is never the verification layer.
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
