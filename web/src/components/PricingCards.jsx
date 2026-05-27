export default function PricingCards() {
  const cards = [
    {
      name: 'Free',
      price: '$0',
      sub: 'Get started instantly with no API key needed.',
      features: ['3 free models included', '100 requests/day', 'Full gatekeeper engine', 'Community support'],
      cta: 'Get Started',
      href: '#install',
      primary: false,
      popular: false,
    },
    {
      name: 'Go',
      price: '$5',
      sub: 'first month / then $10/mo',
      desc: 'Curated open models for daily coding.',
      features: ['10+ open models', '5hr/week usage limit', 'DeepSeek, Qwen, GLM, Kimi', 'Priority support'],
      cta: 'Subscribe \u2192',
      href: '/go',
      primary: true,
      popular: true,
    },
    {
      name: 'Zen',
      price: 'Pay as you go',
      sub: 'Premium models billed per token. Top up as needed.',
      features: ['GPT-4o, Claude, Gemini', '30+ premium models', 'Per-token billing', 'Auto-reload & alerts'],
      cta: 'Get API Key',
      href: '/zen',
      primary: false,
      popular: false,
    },
  ]

  return (
    <div className="pricing-grid">
      {cards.map(card => (
        <div key={card.name} className={`pricing-card ${card.popular ? 'popular' : ''}`}>
          <div className="pricing-card-header">
            {card.popular ? (
              <div className="pricing-card-tier">
                {card.name} <span style={{ color: 'var(--accent-neon)', fontWeight: 700 }}>Most popular</span>
              </div>
            ) : (
              <div className="pricing-card-tier">{card.name}</div>
            )}
            <div className="pricing-card-price">{card.price}</div>
            {card.popular && <div className="pricing-card-sub">{card.sub}</div>}
            <div className="pricing-card-desc">{card.desc || card.sub}</div>
          </div>
          <ul className="pricing-card-features">
            {card.features.map(f => <li key={f}>[+] {f}</li>)}
          </ul>
          <div className="pricing-card-action">
            <a
              href={card.href}
              className={card.popular ? 'btn-primary' : 'btn-secondary'}
              style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
            >
              {card.cta}
            </a>
          </div>
        </div>
      ))}
    </div>
  )
}
