export default function Testimonial() {
  return (
    <section>
      <div className="wrapper">
        <div className="features-list">
          <div className="heading-md" style={{ marginBottom: 16 }}>[x] Access reliable, optimized models</div>
          <p className="body-md" style={{ marginBottom: 8 }}>
            The Kode Gateway gives you access to a handpicked set of models benchmarked specifically for coding agents. No need to worry about inconsistent performance across providers — use validated models that work.
          </p>
          <div className="zen-card">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="3" fill="#201d1d" />
              <path d="M16 19V28" stroke="#201d1d" strokeWidth="2" strokeLinecap="square" />
              <path d="M16 13V4" stroke="#201d1d" strokeWidth="2" strokeLinecap="square" />
              <path d="M8 16H0" stroke="#201d1d" strokeWidth="2" strokeLinecap="square" />
              <path d="M24 16H32" stroke="#201d1d" strokeWidth="2" strokeLinecap="square" />
              <circle cx="8" cy="8" r="2" fill="#201d1d" />
              <circle cx="24" cy="24" r="2" fill="#201d1d" />
              <path d="M8 8L16 4" stroke="#201d1d" strokeWidth="1.5" />
              <path d="M24 24L16 28" stroke="#201d1d" strokeWidth="1.5" />
            </svg>
            <div>
              <p className="quote">
                &ldquo;Blast Radius caught a runaway refactor that would have touched 14 files. The gate blocked it in under 50ms. That's the kind of safety you can't get from generate-and-pray tools.&rdquo;
              </p>
              <p className="attribution">&mdash; Sarah Chen, Lead Engineer</p>
            </div>
          </div>
          <div style={{ marginTop: 24 }}>
            <a href="/zen" className="btn-primary">Learn about the Gateway &rarr;</a>
          </div>
        </div>
      </div>
    </section>
  )
}
