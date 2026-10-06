import { useId } from 'react'

/**
 * The brand wordmark: the "A" of "Admin" is a gold padlock (an A cut out of
 * the lock body, with the shackle arching over it), followed by
 * "dmin Console". `open` swings the shackle off the A on its right leg (CSS
 * transition on .padlock__shackle). The artwork matches public/lock-*.svg,
 * which serve as the favicon.
 *
 * Screen readers get the plain words "Admin Console"; the drawing is hidden
 * from them.
 */
export function BrandWordmark({ open }: { open: boolean }) {
  return (
    <>
      <span className="visually-hidden">Admin Console</span>
      <span className="wordmark" aria-hidden="true">
        <LockA open={open} />
        dmin Console
      </span>
    </>
  )
}

function LockA({ open }: { open: boolean }) {
  // Mask id must be unique per instance and safe inside url(#...).
  const maskId = `${useId().replace(/[^a-zA-Z0-9_-]/g, '')}-a`
  return (
    <svg className={`padlock${open ? ' is-open' : ''}`} viewBox="0 0 32 32" fill="none" focusable="false">
      <defs>
        {/* The letter A is cut out of the lock body, so the background shows through. */}
        <mask id={maskId}>
          <rect width="32" height="32" fill="#fff" />
          <path
            d="M11.4 26.6 16 15.6l4.6 11"
            stroke="#000"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M13.3 22.7h5.4" stroke="#000" strokeWidth="2.1" strokeLinecap="round" />
        </mask>
      </defs>
      <path
        className="padlock__shackle"
        d="M10.5 13.5V9.5a5.5 5.5 0 0 1 11 0v4"
        stroke="var(--padlock-gold, #b8862b)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <rect
        x="6"
        y="12.5"
        width="20"
        height="17"
        rx="3.5"
        fill="var(--padlock-gold, #b8862b)"
        mask={`url(#${maskId})`}
      />
    </svg>
  )
}
