export default function Architecture() {
  return (
    <section>
      <div className="wrapper">
        <div className="features-list">
          <div className="heading-md" style={{ marginBottom: 24 }}>[x] Architecture</div>
          <p className="body-md" style={{ marginBottom: 8 }}>
            The Go Gatekeeper sits between LLM output and disk, running 5 inline checks before any file write is permitted. This is Kode's competitive moat.
          </p>
          <div className="arch-flow">
            <div className="arch-stages">
              <span className="stage">Plan</span>
              <span className="arrow">&rarr;</span>
              <span className="stage">Critique</span>
              <span className="arrow">&rarr;</span>
              <span className="stage">Generate</span>
              <span className="arrow">&rarr;</span>
              <span className="stage verify-stage">Verify</span>
              <span className="arrow">&rarr;</span>
              <span className="stage">Apply</span>
              <span className="arrow">&rarr;</span>
              <span className="stage">Test</span>
            </div>
            <div className="gate-note">
              The <strong>Verify</strong> stage runs all 5 gates inline: syntax &rarr; imports &rarr; calls &rarr; blast radius &rarr; architecture + TDD. Block on any gate, and the write never reaches disk. Rollback is automatic.
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
