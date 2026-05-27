import PricingCards from '../components/PricingCards'
import FAQ from '../components/FAQ'
import Newsletter from '../components/Newsletter'

export default function Pricing() {
  return (
    <>
      <section className="hero-section">
        <div className="wrapper">
          <div className="features-list">
            <span className="hero-badge" style={{ marginBottom: 24 }}>[x] Plans & Pricing</span>
            <h1 className="display-xl" style={{ marginBottom: 16 }}>
              Choose your plan
            </h1>
            <p className="body-md hero-sub">
              Start for free, upgrade when you need more. Every tier includes the full Kode Gatekeeper engine with all 5 verification gates.
            </p>
          </div>
          <PricingCards />
          <div className="features-list" style={{ marginTop: 24 }}>
            <div style={{
              fontSize: 14, color: 'var(--body)', lineHeight: 1.6,
              borderTop: '1px solid var(--hairline)', paddingTop: 16,
            }}>
              <strong>All plans include:</strong> Go Gatekeeper engine &middot; Blast Radius &middot; TDD Lockjaw &middot; Cost Budgeting &middot; Blindfold Mode &middot; Unlimited public projects
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrapper">
          <div className="features-list">
            <div className="heading-md" style={{ marginBottom: 16 }}>Gateway model catalog</div>
            <p className="body-md" style={{ marginBottom: 24 }}>
              Every model in the Kode Gateway is benchmarked specifically for coding agent workloads. No random selection — each model passes a standardized eval suite before being added.
            </p>
          </div>
          
          <div className="models-table-container">
            <table className="models-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Tier</th>
                  <th>Provider</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['DeepSeek-V3', 'Free', 'DeepSeek'],
                  ['Llama 3.1 70B', 'Free', 'Meta'],
                  ['Nemotron 70B', 'Free', 'NVIDIA'],
                  ['DeepSeek-R1', 'Go', 'DeepSeek'],
                  ['Qwen 2.5 Coder 32B', 'Go', 'Alibaba'],
                  ['GLM-4-Coder', 'Go', 'Zhipu'],
                  ['Kimi-Coder', 'Go', 'Moonshot'],
                  ['GPT-4o', 'Zen', 'OpenAI'],
                  ['Claude 3.5 Sonnet', 'Zen', 'Anthropic'],
                  ['Gemini 1.5 Pro', 'Zen', 'Google'],
                ].map(row => (
                  <tr key={row[0]}>
                    <td>{row[0]}</td>
                    <td>{row[1]}</td>
                    <td>{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <FAQ />
      <Newsletter />
    </>
  )
}
