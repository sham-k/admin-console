import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './Icon'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** When false, Escape and the close button are disabled (e.g. mid-save). */
  dismissible?: boolean
  /** alertdialog for confirmations that interrupt the workflow. */
  role?: 'dialog' | 'alertdialog'
}

/**
 * Modal built on the native <dialog> element: the browser supplies the focus
 * trap, inert background, Escape handling and focus restoration on close.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissible = true,
  role = 'dialog',
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // Native <dialog> focuses the first focusable element (the close button).
      // Prefer an explicit target: first field in a form, the safe choice in a confirm.
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={`dialog dialog--${size}`}
      role={role === 'alertdialog' ? 'alertdialog' : undefined}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault()
        if (dismissible) onClose()
      }}
    >
      {open && (
        <div className="dialog__surface">
          <header className="dialog__header">
            <h2 id={titleId} className="dialog__title">
              {title}
            </h2>
            <button
              type="button"
              className="icon-button"
              onClick={onClose}
              disabled={!dismissible}
              aria-label="Close dialog"
            >
              <Icon name="close" />
            </button>
          </header>
          {description && (
            <div id={descriptionId} className="dialog__description">
              {description}
            </div>
          )}
          {children && <div className="dialog__body">{children}</div>}
          {footer && <footer className="dialog__footer">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel: string
  tone?: 'primary' | 'danger'
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = 'primary',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      size="sm"
      role="alertdialog"
      dismissible={!busy}
      footer={
        <>
          <button type="button" className="button button--secondary" onClick={onCancel} disabled={busy} data-autofocus>
            Cancel
          </button>
          <button
            type="button"
            className={`button button--${tone}`}
            onClick={busy ? undefined : onConfirm}
            aria-disabled={busy}
            data-busy={busy || undefined}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    />
  )
}
