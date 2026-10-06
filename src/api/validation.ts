import { ROLES, STATUSES } from './types'
import type { UserInput } from './types'

export const NAME_MAX_LENGTH = 50
export const EMAIL_MAX_LENGTH = 254
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type FieldErrors = Partial<Record<keyof UserInput, string>>

/**
 * Validation rules shared by the form (for instant feedback) and the stub
 * server (as the source of truth). In a real system this would be a schema
 * package published by the backend team.
 */
export function validateUserInput(input: Partial<Record<keyof UserInput, unknown>>): FieldErrors {
  const errors: FieldErrors = {}

  for (const [field, label] of [
    ['first_name', 'First name'],
    ['last_name', 'Last name'],
  ] as const) {
    const value = input[field]
    if (typeof value !== 'string' || !value.trim()) errors[field] = `${label} is required.`
    else if (value.trim().length > NAME_MAX_LENGTH)
      errors[field] = `${label} must be ${NAME_MAX_LENGTH} characters or fewer.`
  }

  const email = input.email
  if (typeof email !== 'string' || !email.trim()) errors.email = 'Email is required.'
  else if (email.trim().length > EMAIL_MAX_LENGTH) errors.email = 'Email is too long.'
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Enter an email address like name@example.com.'

  if (!ROLES.includes(input.role as never)) errors.role = 'Choose a role.'
  if (!STATUSES.includes(input.status as never)) errors.status = 'Choose a status.'

  return errors
}
