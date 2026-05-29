import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

export default function Nav() {
  const [isOpen, setIsOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const handleHashClick = (e, hash) => {
    setIsOpen(false)
    if (location.pathname !== '/') {
      e.preventDefault()
      navigate('/' + hash)
    }
  }

  return (
    <>
      <nav className="header-nav">
        <div className="wrapper">
          <Link to="/" className="nav-logo" onClick={() => setIsOpen(false)}>
            <img src="/kode-logo-light.svg" alt="Kode" style={{ height: 32, width: 'auto', display: 'block' }} />
          </Link>
          <ul className="nav-menu">
            <li><a href="#features" onClick={(e) => handleHashClick(e, '#features')}>[+] Features</a></li>
            <li><Link to="/pricing">Plans</Link></li>
            <li><a href="#faq" onClick={(e) => handleHashClick(e, '#faq')}>[x] FAQ</a></li>
            <li><a href="https://docs.trykode.xyz">Docs</a></li>
            <li><a href="https://github.com/sicario-labs/kode" target="_blank" rel="noreferrer">GitHub</a></li>
          </ul>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="#install" className="btn-primary" style={{ height: 32, fontSize: 14 }}>Download</a>
            <button className="nav-toggle" onClick={() => setIsOpen(!isOpen)}>
               {isOpen ? '[close]' : '[menu]'}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer */}
      <div className={`mobile-drawer ${isOpen ? 'open' : ''}`}>
        <ul className="mobile-drawer-links">
          <li><a href="#features" onClick={(e) => handleHashClick(e, '#features')}>[+] Features</a></li>
          <li><Link to="/pricing" onClick={() => setIsOpen(false)}>[x] Plans</Link></li>
          <li><a href="#faq" onClick={(e) => handleHashClick(e, '#faq')}>[x] FAQ</a></li>
          <li><a href="https://docs.trykode.xyz" onClick={() => setIsOpen(false)}>[x] Docs</a></li>
          <li><a href="https://github.com/sicario-labs/kode" target="_blank" rel="noreferrer" onClick={() => setIsOpen(false)}>[x] GitHub</a></li>
        </ul>
      </div>
    </>
  )
}
