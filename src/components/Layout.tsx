import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useMockServer } from '../api/context'
import { DevPanel } from './DevPanel'
import { Icon } from './Icon'
import { BrandWordmark } from './Padlock'
import { ToastProvider } from './Toast'
import { useFavicon } from '../lib/hooks'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/users', label: 'Users' },
  { to: '/teams', label: 'Teams' },
  { to: '/audit-log', label: 'Audit log' },
  { to: '/settings', label: 'Settings' },
]

export function Layout() {
  const { pathname } = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const firstRender = useRef(true)

  // SPA navigation doesn't move focus like a page load does. Move it to the
  // new page's heading so screen reader users hear where they've landed.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    const heading = mainRef.current?.querySelector<HTMLElement>('h1')
    ;(heading ?? mainRef.current)?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <ToastProvider>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <TopNav />
      <main id="main" ref={mainRef} tabIndex={-1} className="main">
        <Outlet />
      </main>
    </ToastProvider>
  )
}

function TopNav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const [devOpen, setDevOpen] = useState(false)
  const mockServer = useMockServer()

  // Entering the console unlocks the padlock: it renders closed, then swings
  // open a beat later so the motion is visible. The tab icon swaps too.
  const [unlocked, setUnlocked] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setUnlocked(true), 350)
    return () => clearTimeout(timer)
  }, [])
  useFavicon(unlocked ? '/lock-open.svg' : '/lock-closed.svg')

  return (
    <header
      className="topbar"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && menuOpen) {
          setMenuOpen(false)
          toggleRef.current?.focus()
        }
      }}
    >
      <div className="topbar__inner">
        {/* The brand goes home to the landing page. */}
        <Link to="/" className="brand">
          <BrandWordmark open={unlocked} />
        </Link>

        <button
          ref={toggleRef}
          type="button"
          className="icon-button topbar__menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="primary-nav"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Icon name={menuOpen ? 'close' : 'menu'} />
          <span className="visually-hidden">Menu</span>
        </button>

        <nav id="primary-nav" aria-label="Main" className={`nav${menuOpen ? ' nav--open' : ''}`}>
          <ul className="nav__list">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                {/* NavLink sets aria-current="page" on the active entry. */}
                <NavLink to={item.to} className="nav__link" onClick={() => setMenuOpen(false)}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="topbar__actions">
          {mockServer && (
            <button type="button" className="button button--ghost button--sm" onClick={() => setDevOpen(true)}>
              <Icon name="sliders" />
              <span className="topbar__action-label">Simulation</span>
            </button>
          )}
        </div>
      </div>
      {mockServer && <DevPanel open={devOpen} onClose={() => setDevOpen(false)} server={mockServer} />}
    </header>
  )
}
