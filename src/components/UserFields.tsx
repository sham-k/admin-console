import { useId } from 'react'
import type { ReactNode } from 'react'
import { ROLES, STATUSES } from '../api/types'
import type { Role, Status, UserInput } from '../api/types'
import { EMAIL_MAX_LENGTH, NAME_MAX_LENGTH } from '../api/validation'
import type { FieldErrors } from '../api/validation'
import { Icon } from './Icon'
import type { IconName } from './Icon'

const ROLE_ICONS: Record<Role, IconName> = {
  Admin: 'shield',
  Member: 'user',
  Viewer: 'eye',
}

const STATUS_ICONS: Record<Status, IconName> = {
  active: 'checkCircle',
  invited: 'mail',
  suspended: 'ban',
}

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  Admin: 'Full access to organization settings, billing, and user management.',
  Member: 'Can view and edit workspace content.',
  Viewer: 'Read-only access.',
}

const STATUS_DESCRIPTIONS: Record<Status, string> = {
  active: 'Can sign in.',
  // Non-breaking hyphen (U+2011) so "sign‑in" never wraps as "sign- / in".
  invited: 'Invitation sent. Awaiting first sign‑in.',
  suspended: 'Can’t sign in. Their data is kept.',
}

interface UserFieldsProps {
  values: UserInput
  errors: FieldErrors
  onChange: <K extends keyof UserInput>(field: K, value: UserInput[K]) => void
  disabled?: boolean
  /** New users can't be created as suspended. */
  allowedStatuses?: readonly Status[]
  /** Fields changed elsewhere since editing began, flagged for the admin. */
  highlight?: Partial<Record<keyof UserInput, string>>
  /** Mark the first field as the dialog's initial focus target. */
  autoFocusFirst?: boolean
}

export function UserFields({
  values,
  errors,
  onChange,
  disabled,
  allowedStatuses = STATUSES,
  highlight = {},
  autoFocusFirst = false,
}: UserFieldsProps) {
  return (
    <div className="fields">
      <div className="fields__row">
        <TextField
          name="first_name"
          label="First name"
          autoFocusTarget={autoFocusFirst}
          value={values.first_name}
          error={errors.first_name}
          note={highlight.first_name}
          onChange={(v) => onChange('first_name', v)}
          disabled={disabled}
          autoComplete="off"
          maxLength={NAME_MAX_LENGTH}
        />
        <TextField
          name="last_name"
          label="Last name"
          value={values.last_name}
          error={errors.last_name}
          note={highlight.last_name}
          onChange={(v) => onChange('last_name', v)}
          disabled={disabled}
          autoComplete="off"
          maxLength={NAME_MAX_LENGTH}
        />
      </div>
      <TextField
        name="email"
        label="Email"
        type="email"
        value={values.email}
        error={errors.email}
        note={highlight.email}
        onChange={(v) => onChange('email', v)}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        maxLength={EMAIL_MAX_LENGTH}
      />

      <ChoiceGroup
        name="role"
        legend="Role"
        value={values.role}
        options={ROLES.map((role) => ({
          value: role,
          label: role,
          description: ROLE_DESCRIPTIONS[role],
          icon: ROLE_ICONS[role],
        }))}
        error={errors.role}
        note={highlight.role}
        onChange={(v) => onChange('role', v as Role)}
        disabled={disabled}
      />
      <ChoiceGroup
        name="status"
        legend="Status"
        value={values.status}
        options={allowedStatuses.map((status) => ({
          value: status,
          label: status[0].toUpperCase() + status.slice(1),
          description: STATUS_DESCRIPTIONS[status],
          icon: STATUS_ICONS[status],
        }))}
        error={errors.status}
        note={highlight.status}
        onChange={(v) => onChange('status', v as Status)}
        disabled={disabled}
      />
    </div>
  )
}

interface TextFieldProps {
  name: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  note?: string
  hint?: ReactNode
  type?: 'text' | 'email'
  disabled?: boolean
  autoComplete?: string
  spellCheck?: boolean
  maxLength?: number
  autoFocusTarget?: boolean
}

export function TextField({
  name,
  label,
  value,
  onChange,
  error,
  note,
  hint,
  type = 'text',
  autoFocusTarget,
  ...rest
}: TextFieldProps) {
  const id = useId()
  const describedBy = [hint && `${id}-hint`, note && `${id}-note`, error && `${id}-error`].filter(Boolean).join(' ')
  return (
    <div className={`field${error ? ' field--invalid' : ''}${note ? ' field--changed' : ''}`}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="field__hint">
          {hint}
        </p>
      )}
      <input
        id={id}
        name={name}
        type={type}
        className="input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        required
        data-autofocus={autoFocusTarget || undefined}
        {...rest}
      />
      {note && (
        <p id={`${id}-note`} className="field__note">
          {note}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="field__error">
          {error}
        </p>
      )}
    </div>
  )
}

interface ChoiceGroupProps {
  name: string
  legend: string
  value: string
  options: { value: string; label: string; description: string; icon?: IconName }[]
  onChange: (value: string) => void
  error?: string
  note?: string
  disabled?: boolean
}

/** Radio cards: every option and its consequence is visible without opening a menu. */
function ChoiceGroup({ name, legend, value, options, onChange, error, note, disabled }: ChoiceGroupProps) {
  const id = useId()
  const describedBy = [note && `${id}-note`, error && `${id}-error`].filter(Boolean).join(' ')
  return (
    <fieldset
      className={`field choice-group${error ? ' field--invalid' : ''}${note ? ' field--changed' : ''}`}
      aria-describedby={describedBy || undefined}
      disabled={disabled}
    >
      <legend className="field__label">{legend}</legend>
      <div className="choice-group__options">
        {options.map((option) => (
          <label key={option.value} className="choice">
            <input
              type="radio"
              name={`${id}-${name}`}
              data-field={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              aria-describedby={`${id}-${option.value}-desc`}
            />
            <span className="choice__text">
              <span className="choice__label">
                {option.icon && (
                  <span className={`choice__icon choice__icon--${option.value.toLowerCase()}`}>
                    <Icon name={option.icon} size={16} />
                  </span>
                )}
                {option.label}
              </span>
              <span id={`${id}-${option.value}-desc`} className="choice__description">
                {option.description}
              </span>
            </span>
          </label>
        ))}
      </div>
      {note && (
        <p id={`${id}-note`} className="field__note">
          {note}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="field__error">
          {error}
        </p>
      )}
    </fieldset>
  )
}
