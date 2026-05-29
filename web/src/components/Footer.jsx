export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--hairline)', padding: '32px 0' }}>
      <div className="wrapper">
        <div className="footer-links-grid">
          {[
            { label: 'GitHub', href: 'https://github.com/sicario-labs/kode' },
            { label: 'Docs', href: 'https://docs.trykode.xyz' },
            { label: 'Changelog', href: '/changelog' },
            { label: 'Pricing', href: '/pricing' },
            { label: 'X', href: 'https://x.com/trykode' },
          ].map(link => (
            <a
              key={link.label}
              href={link.href}
            >
              {link.label}
            </a>
          ))}
        </div>
        <div className="footer-bottom">
          <span>&copy; 2026 Kode</span>
          <span>Brand &middot; Privacy &middot; Terms</span>
        </div>
      </div>
    </footer>
  )
}
