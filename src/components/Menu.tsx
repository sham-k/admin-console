import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'

const MENU_MAX_HEIGHT = 220

export interface MenuItem {
  label: string
  onSelect: () => void
  tone?: 'danger'
  disabled?: boolean
}

/**
 * WAI-ARIA menu button: arrow keys / Home / End move focus, Escape closes and
 * returns focus to the trigger, Tab closes and continues normally.
 */
export function Menu({ label, trigger, items }: { label: string; trigger: ReactNode; items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  // Fixed positioning escapes the table's scroll container so the menu is never clipped.
  const [position, setPosition] = useState<CSSProperties>({})
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const focusItem = (index: number) => {
    const nodes = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([aria-disabled="true"])')
    if (!nodes?.length) return
    nodes[(index + nodes.length) % nodes.length].focus({ preventScroll: true })
  }

  useEffect(() => {
    if (!open) return
    focusItem(0)
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const dismiss = () => setOpen(false)
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('resize', dismiss)
    window.addEventListener('scroll', dismiss, { capture: true, passive: true })
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('resize', dismiss)
      window.removeEventListener('scroll', dismiss, { capture: true })
    }
  }, [open])

  const openMenu = () => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (rect) {
      const right = window.innerWidth - rect.right
      const fitsBelow = rect.bottom + MENU_MAX_HEIGHT < window.innerHeight
      setPosition(fitsBelow ? { top: rect.bottom + 4, right } : { bottom: window.innerHeight - rect.top + 4, right })
    }
    setOpen(true)
  }

  const close = (restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) buttonRef.current?.focus()
  }

  const onMenuKeyDown = (event: KeyboardEvent) => {
    const nodes = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [],
    )
    const current = nodes.indexOf(document.activeElement as HTMLButtonElement)
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        focusItem(current + 1)
        break
      case 'ArrowUp':
        event.preventDefault()
        focusItem(current - 1)
        break
      case 'Home':
        event.preventDefault()
        focusItem(0)
        break
      case 'End':
        event.preventDefault()
        focusItem(nodes.length - 1)
        break
      case 'Escape':
        event.preventDefault()
        close(true)
        break
      case 'Tab':
        close(false)
        break
    }
  }

  return (
    <div className="menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="icon-button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            openMenu()
          }
        }}
      >
        {trigger}
      </button>
      {open && (
        <ul
          id={menuId}
          ref={menuRef}
          role="menu"
          aria-label={label}
          className="menu__list"
          style={position}
          onKeyDown={onMenuKeyDown}
        >
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={`menu__item${item.tone === 'danger' ? ' menu__item--danger' : ''}`}
                aria-disabled={item.disabled || undefined}
                onClick={() => {
                  if (item.disabled) return
                  close(true)
                  item.onSelect()
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
