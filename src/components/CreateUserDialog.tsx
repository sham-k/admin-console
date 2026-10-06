import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { errorMessage, isApiError } from '../api/errors'
import type { UserInput } from '../api/types'
import { validateUserInput } from '../api/validation'
import type { FieldErrors } from '../api/validation'
import { useCreateUser } from '../hooks/users'
import { fullName } from '../lib/format'
import { Dialog } from './Dialog'
import { Icon } from './Icon'
import { useToast } from './Toast'
import { focusFirstError } from '../lib/forms'
import { UserFields } from './UserFields'

const EMPTY: UserInput = { first_name: '', last_name: '', email: '', role: 'Member', status: 'invited' }
const CREATE_STATUSES = ['invited', 'active'] as const

/**
 * The draft survives closing the dialog (until it's created), so an admin who
 * closes it by accident, or to look something up, doesn't lose their typing.
 */
export function CreateUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [values, setValues] = useState<UserInput>(EMPTY)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [attempted, setAttempted] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [createAnother, setCreateAnother] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const create = useCreateUser()
  const toast = useToast()

  const onChange = <K extends keyof UserInput>(field: K, value: UserInput[K]) => {
    const next = { ...values, [field]: value }
    setValues(next)
    // Validate as-you-type only after the first submit, so we don't nag early.
    if (attempted) setErrors(validateUserInput(next))
  }

  const reset = () => {
    setValues(EMPTY)
    setErrors({})
    setAttempted(false)
    setFormError(null)
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (create.isPending) return
    setAttempted(true)
    setFormError(null)
    const clientErrors = validateUserInput(values)
    setErrors(clientErrors)
    if (Object.keys(clientErrors).length) {
      focusFirstError(formRef.current, clientErrors)
      return
    }

    create.mutate(values, {
      onSuccess: ({ data: user }) => {
        toast.success(`${fullName(user)} was added${user.status === 'invited' ? ' and invited' : ''}.`, {
          label: 'View user',
          to: `/users/${user.id}`,
        })
        reset()
        if (createAnother) formRef.current?.querySelector<HTMLInputElement>('input[name="first_name"]')?.focus()
        else onClose()
      },
      onError: (error) => {
        if (isApiError(error) && Object.keys(error.fields).length) {
          setErrors(error.fields)
          focusFirstError(formRef.current, error.fields)
        } else {
          setFormError(errorMessage(error))
        }
      },
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add user"
      description={<p>New users with the Invited status get an email to set up their account.</p>}
      dismissible={!create.isPending}
      footer={
        <>
          <label className="checkbox dialog__footer-start">
            <input type="checkbox" checked={createAnother} onChange={(e) => setCreateAnother(e.target.checked)} />
            Add another user
          </label>
          <button type="button" className="button button--secondary" onClick={onClose} disabled={create.isPending}>
            Cancel
          </button>
          <button
            type="submit"
            form="create-user-form"
            className="button button--primary"
            aria-disabled={create.isPending}
          >
            {create.isPending ? 'Adding…' : 'Add user'}
          </button>
        </>
      }
    >
      <form id="create-user-form" ref={formRef} onSubmit={onSubmit} noValidate>
        {formError && (
          <div className="alert alert--error" role="alert">
            <Icon name="alert" />
            <p>{formError}</p>
          </div>
        )}
        <UserFields
          values={values}
          errors={errors}
          onChange={onChange}
          allowedStatuses={CREATE_STATUSES}
          autoFocusFirst
        />
      </form>
    </Dialog>
  )
}
