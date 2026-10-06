import type { UserInput } from '../api/types'
import type { FieldErrors } from '../api/validation'

const FIELD_ORDER: (keyof UserInput)[] = ['first_name', 'last_name', 'email', 'role', 'status']

/** Move focus to the first invalid control so keyboard and SR users land on it (WCAG 3.3.1). */
export function focusFirstError(container: HTMLElement | null, errors: FieldErrors) {
  const first = FIELD_ORDER.find((field) => errors[field])
  if (!first || !container) return
  const target =
    container.querySelector<HTMLElement>(`[name="${first}"]`) ??
    container.querySelector<HTMLElement>(`[data-field="${first}"]:checked`) ??
    container.querySelector<HTMLElement>(`[data-field="${first}"]`)
  target?.focus()
}
