import type { CSSProperties, ReactNode } from 'react'
import { errorMessage, isApiError } from '../api/errors'
import type { Role, Status } from '../api/types'
import { Icon } from './Icon'

export function ErrorState({
  error,
  onRetry,
  title = 'Couldn’t load this',
}: {
  error: unknown
  onRetry?: () => void
  title?: string
}) {
  const requestId = isApiError(error) ? error.requestId : undefined
  return (
    <div className="state state--error" role="alert">
      <Icon name="alert" size={28} />
      <h2 className="state__title">{title}</h2>
      <p className="state__body">{errorMessage(error)}</p>
      {requestId && <p className="state__meta">Reference: {requestId}</p>}
      {onRetry && (
        <button type="button" className="button button--secondary" onClick={onRetry}>
          <Icon name="refresh" /> Try again
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="state">
      <Icon name="users" size={28} />
      <h2 className="state__title">{title}</h2>
      {body && <p className="state__body">{body}</p>}
      {action}
    </div>
  )
}

const STATUS_LABEL: Record<Status, string> = { active: 'Active', invited: 'Invited', suspended: 'Suspended' }

/** Status is conveyed by text, not colour alone (WCAG 1.4.1). */
/** An email address that, when it has to wrap, breaks just before the @. */
export function EmailText({ email }: { email: string }) {
  const at = email.lastIndexOf('@')
  if (at <= 0) return <>{email}</>
  return (
    <>
      {email.slice(0, at)}
      <wbr />
      {email.slice(at)}
    </>
  )
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`badge badge--${status}`}>
      <span className="badge__dot" aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  )
}

export function RoleLabel({ role }: { role: Role }) {
  return <span className={`role role--${role.toLowerCase()}`}>{role}</span>
}

export function Avatar({ first, last, size = 'md' }: { first: string; last: string; size?: 'md' | 'lg' }) {
  // Stable hue per name so avatars are distinguishable at a glance.
  const hue = [...`${first}${last}`].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 360
  return (
    <span className={`avatar avatar--${size}`} style={{ '--avatar-hue': hue } as CSSProperties} aria-hidden="true">
      {(first[0] ?? '').toUpperCase()}
      {(last[0] ?? '').toUpperCase()}
    </span>
  )
}
