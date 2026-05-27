import Hero from '../components/Hero'
import Features from '../components/Features'
import Stats from '../components/Stats'
import Architecture from '../components/Architecture'
import Privacy from '../components/Privacy'
import PricingCards from '../components/PricingCards'
import Testimonial from '../components/Testimonial'
import FAQ from '../components/FAQ'
import Newsletter from '../components/Newsletter'

export default function Home() {
  return (
    <>
      <Hero />
      <Features />
      <Stats />
      <Architecture />
      <Privacy />
      <section id="plans">
        <div className="wrapper">
          <div className="features-list">
            <div className="heading-md" style={{ marginBottom: 24 }}>[x] Plans & Pricing</div>
            <p className="body-md" style={{ marginBottom: 32 }}>
              Start for free, upgrade when you need more. Every tier includes the full Kode Gatekeeper engine.
            </p>
          </div>
          <PricingCards />
          <div className="features-list">
            <div style={{
              fontSize: 14, color: 'var(--body)', lineHeight: 1.6,
              borderTop: '1px solid var(--hairline)', paddingTop: 16,
            }}>
              <strong>All plans include:</strong> Go Gatekeeper engine &middot; Blast Radius &middot; TDD Lockjaw &middot; Cost Budgeting &middot; Blindfold Mode &middot; Unlimited public projects
            </div>
          </div>
        </div>
      </section>
      <Testimonial />
      <FAQ />
      <Newsletter />
    </>
  )
}
