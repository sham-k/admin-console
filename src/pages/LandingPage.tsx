import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent, RefObject } from 'react'
import { Link } from 'react-router-dom'
import { useMockServer } from '../api/context'
import { Icon } from '../components/Icon'
import { BrandWordmark } from '../components/Padlock'
import type { IconName } from '../components/Icon'
import { formatNumber } from '../lib/format'
import { useDocumentTitle, useFavicon } from '../lib/hooks'

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'search',
    title: 'Find anyone, instantly',
    body: 'Search by name or email and filter by role or status. Results stay fast across hundreds of thousands of users.',
  },
  {
    icon: 'shield',
    title: 'Edits that never collide',
    body: 'If another admin changes a user while you’re editing, you’ll see it before you save, and choose to merge, reload or overwrite.',
  },
  {
    icon: 'users',
    title: 'Roles that make sense',
    body: 'Admin, Member and Viewer, each with a plain-language description, so you always know what access you’re granting.',
  },
  {
    icon: 'key',
    title: 'One-click account actions',
    body: 'Send password resets, suspend or reactivate people, and copy emails straight from the list.',
  },
  {
    icon: 'refresh',
    title: 'Views you can share',
    body: 'Filters, sorting and paging live in the URL. Bookmark a view, send it to a teammate, or come back to it later.',
  },
  {
    icon: 'check',
    title: 'Built for everyone',
    body: 'Full keyboard support, screen-reader labels, high-contrast text, and animations that respect Reduce Motion.',
  },
]

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Reveals every `[data-reveal]` element inside `root` the first time it
 * scrolls into view, by adding `is-revealed` (CSS does the fade/rise).
 * Without IntersectionObserver, or with Reduce Motion on, everything is
 * shown straight away so content is never stuck invisible.
 */
function useScrollReveal(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const container = root.current
    if (!container || typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) return
    const targets = container.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-revealed)')
    // Content only starts hidden once this class is set, i.e. once the
    // observer is actually running. If this code never runs, nothing hides.
    container.classList.add('reveal-armed')
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-revealed')
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    )
    targets.forEach((el) => observer.observe(el))
    return () => {
      observer.disconnect()
      container.classList.remove('reveal-armed')
    }
  }, [root])
}

const MAX_TILT_DEG = 5

const clampUnit = (n: number) => Math.max(-1, Math.min(1, n))

/**
 * Tilts `card` a few degrees by setting --tilt-x / --tilt-y (CSS does the
 * rotation and easing). Never with Reduce Motion; updates are batched to
 * one per animation frame.
 * - Mouse/trackpad: the card turns toward the pointer anywhere on the page.
 * - Touch screens (no pointer to follow): it leans with its position on
 *   screen as you scroll, and while a finger is on it, it tilts toward the
 *   finger and settles back on release. Scrolling is never blocked.
 */
function useMouseTilt(card: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = card.current
    if (!el || prefersReducedMotion()) return
    const setTilt = (x: number, y: number) => {
      el.style.setProperty('--tilt-x', `${x.toFixed(2)}deg`)
      el.style.setProperty('--tilt-y', `${y.toFixed(2)}deg`)
    }
    if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return touchTilt(el, setTilt)

    let frame = 0
    let pointer = { x: 0, y: 0 }
    const apply = () => {
      frame = 0
      const rect = el.getBoundingClientRect()
      // -1..1: how far the pointer is from the card's centre, per axis.
      const dx = clampUnit((pointer.x - (rect.left + rect.width / 2)) / (window.innerWidth / 2))
      const dy = clampUnit((pointer.y - (rect.top + rect.height / 2)) / (window.innerHeight / 2))
      // Turn the card's face toward the pointer.
      setTilt(dx * MAX_TILT_DEG, -dy * MAX_TILT_DEG)
    }
    const onMove = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY }
      if (!frame) frame = requestAnimationFrame(apply)
    }
    const reset = () => setTilt(0, 0)
    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', reset)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', reset)
    }
  }, [card])
}

/** Touch-screen tilt for useMouseTilt. Returns its cleanup. */
function touchTilt(el: HTMLElement, setTilt: (x: number, y: number) => void) {
  let frame = 0
  let touch: { x: number; y: number } | null = null

  const apply = () => {
    frame = 0
    const rect = el.getBoundingClientRect()
    if (touch) {
      // Finger on the card: tilt toward it (relative to the card's centre).
      const dx = clampUnit((touch.x - (rect.left + rect.width / 2)) / (rect.width / 2))
      const dy = clampUnit((touch.y - (rect.top + rect.height / 2)) / (rect.height / 2))
      setTilt(dx * MAX_TILT_DEG, -dy * MAX_TILT_DEG)
    } else {
      // Scrolling: lean back when low on screen, flatten at the middle,
      // lean forward as it rises past the top.
      const dy = clampUnit((rect.top + rect.height / 2 - window.innerHeight / 2) / (window.innerHeight / 2))
      setTilt(0, dy * MAX_TILT_DEG * 0.8)
    }
  }
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(apply)
  }
  const onTouch = (event: TouchEvent) => {
    const t = event.touches[0]
    if (t) touch = { x: t.clientX, y: t.clientY }
    schedule()
  }
  const onRelease = () => {
    touch = null
    schedule()
  }

  // All passive: the page keeps scrolling normally under a finger.
  window.addEventListener('scroll', schedule, { passive: true })
  el.addEventListener('touchstart', onTouch, { passive: true })
  el.addEventListener('touchmove', onTouch, { passive: true })
  el.addEventListener('touchend', onRelease)
  el.addEventListener('touchcancel', onRelease)
  schedule()
  return () => {
    cancelAnimationFrame(frame)
    window.removeEventListener('scroll', schedule)
    el.removeEventListener('touchstart', onTouch)
    el.removeEventListener('touchmove', onTouch)
    el.removeEventListener('touchend', onRelease)
    el.removeEventListener('touchcancel', onRelease)
  }
}

const SEARCH_DEMO_ROWS = [
  { initials: 'ND', name: 'Noah Dang', email: 'noah.dang@contoso.com', status: 'active', hue: 40 },
  { initials: 'NO', name: 'Noah Okafor', email: 'noah.okafor@fabrikam.com', status: 'invited', hue: 160 },
  { initials: 'NS', name: 'Noah Silva', email: 'noah.silva@litwareinc.com', status: 'active', hue: 260 },
] as const

/** Decorative accent block inside the hero feature card: a search in action. */
function SearchDemo({ total }: { total: number }) {
  return (
    <div className="landing__demo" aria-hidden="true">
      <div className="landing__demo-search">
        <Icon name="search" size={16} />
        <span>
          noah
          <span className="landing__demo-caret" />
        </span>
        <kbd>⌘K</kbd>
      </div>
      <ul className="landing__demo-results">
        {SEARCH_DEMO_ROWS.map((row) => (
          <li key={row.email}>
            <span className="landing__preview-avatar" style={{ background: `hsl(${row.hue} 55% 82%)` }}>
              {row.initials}
            </span>
            <span className="landing__demo-who">
              <strong>
                <mark>Noah</mark>
                {row.name.slice(4)}
              </strong>
              <span>
                <mark>noah</mark>
                {row.email.slice(4)}
              </span>
            </span>
            <span className={`badge badge--${row.status}`}>
              <span className="badge__dot" />
              {row.status[0].toUpperCase() + row.status.slice(1)}
            </span>
          </li>
        ))}
      </ul>
      <p className="landing__demo-meta">3 matches · {formatNumber(total)} users searched</p>
    </div>
  )
}

/**
 * Tracks the cursor inside an element and returns its position relative to
 * that element, at most once per animation frame. When the cursor leaves
 * (or before it ever enters) the position rests at the element's centre.
 * With Reduce Motion the position stays at the centre.
 */
function useCursorPosition<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const frame = useRef(0)

  const recenter = useCallback(() => {
    cancelAnimationFrame(frame.current)
    const rect = ref.current?.getBoundingClientRect()
    if (rect) setPos({ x: rect.width / 2, y: rect.height * 0.45 })
  }, [])

  useEffect(() => {
    recenter()
    window.addEventListener('resize', recenter)
    return () => {
      window.removeEventListener('resize', recenter)
      cancelAnimationFrame(frame.current)
    }
  }, [recenter])

  const onMouseMove = (event: MouseEvent<T>) => {
    if (prefersReducedMotion()) return
    const rect = event.currentTarget.getBoundingClientRect()
    const next = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => setPos(next))
  }

  return { ref, pos, onMouseMove, onMouseLeave: recenter }
}

// Three organic outlines for the plum blob. Each is the same four cubic
// curves (same commands, same order) so the browser can morph between them.
const PLUM_SHAPES = [
  'M100,18 C150,14 186,52 182,98 C178,148 140,184 96,180 C48,176 16,140 20,96 C24,50 56,22 100,18 Z',
  'M108,24 C160,30 178,70 170,112 C160,160 118,186 78,170 C34,152 14,108 32,68 C48,34 72,20 108,24 Z',
  'M94,14 C138,8 190,40 186,92 C182,138 154,176 108,184 C60,190 22,150 18,104 C14,58 52,20 94,14 Z',
]

/**
 * Liquid background blobs behind the hero text:
 * - a deep plum inline-SVG path whose curve points morph between
 *   PLUM_SHAPES (SVG <animate> on `d`), so its curvature truly changes;
 * - a bright coral blob morphed with a CSS border-radius keyframe
 *   ("animate-blob").
 * Both also drift slowly (CSS). With Reduce Motion the SVG morph isn't
 * rendered at all, since SVG animation ignores the CSS motion setting.
 */
function LiquidBlobs() {
  const animate = !prefersReducedMotion()
  return (
    <>
      <svg className="landing__liquid landing__liquid--plum" viewBox="0 0 200 200">
        <defs>
          <linearGradient id="landing-plum" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7a1f6e" />
            <stop offset="55%" stopColor="#4c0f4f" />
            <stop offset="100%" stopColor="#2e0a3a" />
          </linearGradient>
        </defs>
        <path d={PLUM_SHAPES[0]} fill="url(#landing-plum)">
          {animate && (
            <animate
              attributeName="d"
              dur="14s"
              repeatCount="indefinite"
              calcMode="spline"
              keyTimes="0;0.33;0.66;1"
              keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1"
              values={[...PLUM_SHAPES, PLUM_SHAPES[0]].join(';')}
            />
          )}
        </path>
      </svg>
      <span className="landing__liquid landing__liquid--coral" />
    </>
  )
}

/**
 * Hero with an interactive background: liquid blobs that morph and drift,
 * plus a vivid purple-pink glow that chases the cursor (CSS eases each move
 * over 500ms). Its own component, so cursor updates re-render only the hero.
 */
function Hero({ total }: { total: number }) {
  const { ref, pos, onMouseMove, onMouseLeave } = useCursorPosition<HTMLElement>()

  return (
    <section
      ref={ref}
      className="landing__hero"
      aria-labelledby="landing-title"
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      <div className="landing__aurora" aria-hidden="true">
        <LiquidBlobs />
        <span
          className="landing__cursor-glow"
          style={pos ? { transform: `translate(${pos.x}px, ${pos.y}px)` } : undefined}
        />
      </div>

      <p className="landing__eyebrow">User management for your workspace</p>
      <h1 id="landing-title" className="landing__title">
        Manage every user,
        <br />
        in one calm place.
      </h1>
      <p className="landing__lead">
        Search, edit and secure {formatNumber(total)} accounts without stepping on your teammates’ changes.
      </p>
      <div className="landing__actions">
        <Link to="/users" className="landing__cta">
          Open console <Icon name="chevronRight" />
        </Link>
        <a href="#features" className="landing__glass-button">
          See what’s inside
        </a>
      </div>
    </section>
  )
}

/** Public welcome page at `/`, outside the console layout. */
export function LandingPage() {
  useDocumentTitle('Welcome')
  // Locked on the landing page; the console unlocks it.
  useFavicon('/lock-closed.svg')
  const total = useMockServer()?.store.total ?? 500_000
  const rootRef = useRef<HTMLDivElement>(null)
  const heroCardRef = useRef<HTMLDivElement>(null)
  useScrollReveal(rootRef)
  useMouseTilt(heroCardRef)

  // Page-level background/overscroll for the landing page only; see
  // html.is-landing in styles.css. Removed again when leaving the page.
  useEffect(() => {
    document.documentElement.classList.add('is-landing')
    return () => document.documentElement.classList.remove('is-landing')
  }, [])

  return (
    <div className="landing" ref={rootRef}>
      {/* Soft violet waves behind everything, like light through glass. */}
      <div className="landing__backdrop" aria-hidden="true">
        <span className="landing__blob landing__blob--1" />
        <span className="landing__blob landing__blob--2" />
        <span className="landing__blob landing__blob--3" />
      </div>

      <header className="landing__nav">
        <span className="landing__brand">
          <BrandWordmark open={false} />
        </span>
        <Link to="/users" className="landing__glass-button">
          Open console
        </Link>
      </header>

      <main className="landing__main">
        <Hero total={total} />

        <section id="features" className="landing__features" aria-labelledby="features-title">
          <h2 id="features-title" className="landing__section-title" data-reveal>
            Everything an admin needs
          </h2>
          {/* Bento layout: the first feature is a large hero card (2 columns x
              2 rows on desktop) with a small search demo; the rest fill in
              around it. */}
          <ul className="landing__grid">
            {FEATURES.map((feature, index) => {
              const content = (
                <>
                  <span className="landing__card-icon">
                    <Icon name={feature.icon} size={22} />
                  </span>
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                </>
              )
              const reveal = { '--reveal-delay': `${Math.min(index, 3) * 90}ms` } as CSSProperties
              if (index > 0) {
                return (
                  <li key={feature.title} className="landing__card" data-reveal style={reveal}>
                    {content}
                  </li>
                )
              }
              // Hero card, three layers so each motion owns its transform:
              // the <li> reveals on scroll, the wrapper floats, the card tilts.
              return (
                <li key={feature.title} className="landing__hero-slot" data-reveal style={reveal}>
                  <div className="landing__float">
                    <div ref={heroCardRef} className="landing__card landing__card--hero">
                      {content}
                      <SearchDemo total={total} />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="landing__closing" aria-labelledby="closing-title" data-reveal>
          <h2 id="closing-title" className="landing__section-title">
            Ready when you are.
          </h2>
          <Link to="/users" className="landing__cta">
            Open console <Icon name="chevronRight" />
          </Link>
        </section>
      </main>

      <footer className="landing__footer">Admin Console · Built with React, TypeScript and TanStack Query</footer>
    </div>
  )
}
