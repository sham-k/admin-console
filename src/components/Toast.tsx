import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './Icon'

type Tone = 'success' | 'error' | 'info'

interface ToastInput {
  message: string
  tone?: Tone
  action?: { label: string; to: string }
}

interface ToastItem extends ToastInput {
  id: number
  tone: Tone
}

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null)

const AUTO_DISMISS_MS = 6_000

/**
 * Notifications live in a persistent live region so screen readers announce
 * them. Success/info auto-dismiss (paused while hovered or focused, per WCAG
 * 2.2.1); errors stay until dismissed.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), [])
  const show = useCallback((toast: ToastInput) => {
    const id = nextId.current++
    setToasts((all) => [...all.slice(-3), { tone: 'success', ...toast, id }])
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <section className="toasts" aria-label="Notifications">
        <ol className="toasts__list" aria-live="polite" aria-relevant="additions">
          {toasts.map((toast) => (
            <ToastView key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </ol>
      </section>
    </ToastContext.Provider>
  )
}

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const { id } = toast
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (toast.tone === 'error' || paused) return
    const timer = setTimeout(() => onDismiss(id), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [id, toast.tone, paused, onDismiss])

  return (
    <li
      className={`toast toast--${toast.tone}`}
      role={toast.tone === 'error' ? 'alert' : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Icon name={toast.tone === 'error' ? 'alert' : toast.tone === 'info' ? 'info' : 'check'} />
      <p className="toast__message">{toast.message}</p>
      {toast.action && (
        <Link className="toast__action" to={toast.action.to} onClick={() => onDismiss(id)}>
          {toast.action.label}
        </Link>
      )}
      <button
        type="button"
        className="icon-button icon-button--sm"
        onClick={() => onDismiss(id)}
        aria-label="Dismiss notification"
      >
        <Icon name="close" size={16} />
      </button>
    </li>
  )
}

export function useToast() {
  const show = useContext(ToastContext)
  if (!show) throw new Error('ToastProvider is missing')
  return useMemo(
    () => ({
      success: (message: string, action?: ToastInput['action']) => show({ message, tone: 'success', action }),
      error: (message: string) => show({ message, tone: 'error' }),
      info: (message: string) => show({ message, tone: 'info' }),
    }),
    [show],
  )
}
