import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useBlocker, useLocation, useParams } from 'react-router-dom'
import { errorMessage, isApiError } from '../api/errors'
import type { User, UserInput, Versioned } from '../api/types'
import { validateUserInput } from '../api/validation'
import type { FieldErrors } from '../api/validation'
import { ConflictDialog } from '../components/ConflictDialog'
import { ConfirmDialog } from '../components/Dialog'
import { Icon } from '../components/Icon'
import { Avatar, EmailText, EmptyState, ErrorState, StatusBadge } from '../components/States'
import { useToast } from '../components/Toast'
import { UserFields } from '../components/UserFields'
import { diffVersions, mergeVersions, sameInput } from '../lib/conflicts'
import { focusFirstError } from '../lib/forms'
import { toInput, useResetPassword, useUpdateUser, useUser, userKeys } from '../hooks/users'
import { formatDateTime, formatRelative, fullName } from '../lib/format'
import { copyToClipboard, useBeforeUnload, useDocumentTitle } from '../lib/hooks'

export function UserDetailPage() {
  const { userId = '' } = useParams()
  const location = useLocation()
  const query = useUser(userId)
  const user = query.data?.data
  // Return to the exact list page/filters the admin came from.
  const backTo = `/users${(location.state as { from?: string } | null)?.from ?? ''}`
  useDocumentTitle(user ? fullName(user) : 'User details')

  const notFound = isApiError(query.error) && query.error.status === 404

  return (
    <div className="page page--fade-in">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <ol>
          <li>
            <Link to={backTo}>
              <Icon name="arrowLeft" size={16} /> Users
            </Link>
          </li>
          <li aria-current="page">{user ? fullName(user) : notFound ? 'Not found' : 'Loading…'}</li>
        </ol>
      </nav>

      {/* The h1 stays mounted across loading → loaded so route focus isn't lost. */}
      <header className="page-header page-header--user">
        {user && <Avatar first={user.first_name} last={user.last_name} size="lg" />}
        <div className="page-header__title">
          <h1 tabIndex={-1}>{user ? fullName(user) : notFound ? 'User not found' : 'User details'}</h1>
          {user && (
            <p className="page-header__subtitle">
              <span className="page-header__email">
                <EmailText email={user.email} />
              </span>
              <StatusBadge status={user.status} />
            </p>
          )}
        </div>
        {query.data && <PasswordResetButton user={query.data.data} />}
      </header>

      {query.isPending ? (
        <DetailSkeleton />
      ) : notFound ? (
        <EmptyState
          title="This user doesn’t exist"
          body="They may have been removed, or the link may be wrong."
          action={
            <Link to={backTo} className="button button--secondary">
              Back to users
            </Link>
          }
        />
      ) : query.isError && !query.data ? (
        <ErrorState title="Couldn’t load this user" error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data ? (
        <UserEditor key={userId} record={query.data} />
      ) : null}
    </div>
  )
}

/**
 * Edit form with optimistic-concurrency handling.
 *
 * `base` is the server version the admin started editing from; its ETag goes
 * in If-Match. `record` is the latest version React Query has fetched (it
 * polls and refetches on focus). When they diverge:
 *   - form untouched -> silently adopt the new version;
 *   - form dirty     -> warn now, rather than waiting for a 412 on save.
 */
function UserEditor({ record }: { record: Versioned<User> }) {
  const [base, setBase] = useState(record)
  const [values, setValues] = useState<UserInput>(() => toInput(record.data))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [conflict, setConflict] = useState<{ fromSave: boolean } | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const queryClient = useQueryClient()
  const update = useUpdateUser()
  const toast = useToast()

  const baseInput = toInput(base.data)
  const dirty = !sameInput(values, baseInput)
  const stale = record.etag !== base.etag

  if (stale && !dirty) {
    setBase(record)
    setValues(toInput(record.data))
  }

  useBeforeUnload(dirty)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname,
  )

  const theirChanges = stale ? diffVersions(baseInput, toInput(record.data), values).filter((d) => d.changedByThem) : []
  const highlight = Object.fromEntries(
    theirChanges.map((d) => [d.key, `Changed by someone else to “${d.theirs}” since you started editing.`]),
  )

  const save = (input: UserInput, etag: string) => {
    setFormError(null)
    update.mutate(
      { id: base.data.id, input, etag },
      {
        onSuccess: (result) => {
          setBase(result)
          // Don't clobber anything typed while the request was in flight.
          setValues((current) => (sameInput(current, input) ? toInput(result.data) : current))
          setErrors({})
          setConflict(null)
          toast.success('Changes saved.')
        },
        onError: (error) => {
          if (isApiError(error) && error.status === 412) {
            // Someone saved first. Fetch their version and let the admin decide.
            setConflict({ fromSave: true })
            queryClient.refetchQueries({ queryKey: userKeys.detail(base.data.id) }).catch(() => {
              toast.error('Couldn’t load the latest version. Try again.')
            })
            return
          }
          if (isApiError(error) && Object.keys(error.fields).length) {
            setErrors(error.fields)
            focusFirstError(formRef.current, error.fields)
            return
          }
          setFormError(errorMessage(error))
        },
      },
    )
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (update.isPending || !dirty) return
    const clientErrors = validateUserInput(values)
    setErrors(clientErrors)
    if (Object.keys(clientErrors).length) {
      focusFirstError(formRef.current, clientErrors)
      return
    }
    save(values, base.etag)
  }

  const onChange = <K extends keyof UserInput>(field: K, value: UserInput[K]) => {
    setValues((current) => ({ ...current, [field]: value }))
    if (errors[field]) setErrors(({ [field]: _removed, ...rest }) => rest)
  }

  const adoptLatest = () => {
    setBase(record)
    setValues(toInput(record.data))
    setErrors({})
    setConflict(null)
  }

  return (
    <div className="detail-grid">
      <form ref={formRef} className="card" onSubmit={onSubmit} noValidate aria-labelledby="profile-heading">
        <div className="card__header">
          <h2 id="profile-heading" className="card__title">
            Profile
          </h2>
          {dirty && <span className="tag tag--info">Unsaved changes</span>}
        </div>

        {stale && dirty && !conflict && (
          <div className="alert alert--warning" role="alert">
            <Icon name="alert" />
            <p>Someone else updated this user while you were editing.</p>
            <button
              type="button"
              className="button button--secondary button--sm"
              onClick={() => setConflict({ fromSave: false })}
            >
              Review changes
            </button>
          </div>
        )}
        {formError && (
          <div className="alert alert--error" role="alert">
            <Icon name="alert" />
            <p>{formError}</p>
          </div>
        )}

        <UserFields values={values} errors={errors} onChange={onChange} highlight={highlight} />

        <div className="card__footer">
          <button
            type="button"
            className="button button--secondary"
            onClick={() => {
              setValues(baseInput)
              setErrors({})
              setFormError(null)
            }}
            disabled={!dirty || update.isPending}
          >
            Discard changes
          </button>
          <button
            type="submit"
            className="button button--primary"
            aria-disabled={!dirty || update.isPending}
            data-busy={update.isPending || undefined}
          >
            {update.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>

      <MetadataCard user={record.data} />

      <ConflictDialog
        open={conflict !== null}
        fromSave={conflict?.fromSave ?? false}
        base={baseInput}
        mine={values}
        latest={stale ? record.data : undefined}
        busy={update.isPending}
        onCancel={() => setConflict(null)}
        onDiscardMine={() => {
          adoptLatest()
          toast.info('Loaded the latest version.')
        }}
        onMerge={() => {
          setValues(mergeVersions(baseInput, toInput(record.data), values))
          setBase(record)
          setErrors({})
          setConflict(null)
          toast.info('Merged with the latest version. Review the form, then save.')
        }}
        onOverwrite={() => save(values, record.etag)}
      />

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="Leave without saving?"
        description="You have unsaved changes to this user. If you leave, they’ll be lost."
        confirmLabel="Leave and discard"
        tone="danger"
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </div>
  )
}

function PasswordResetButton({ user }: { user: User }) {
  const [confirming, setConfirming] = useState(false)
  const reset = useResetPassword()
  const toast = useToast()
  const suspended = user.status === 'suspended'

  return (
    <div className="page-header__actions">
      <button
        type="button"
        className="button button--secondary button--reset"
        onClick={() => setConfirming(true)}
        disabled={suspended}
        aria-describedby={suspended ? 'reset-disabled-reason' : undefined}
      >
        <Icon name="key" /> Send password reset
      </button>
      {suspended && (
        <p id="reset-disabled-reason" className="field__hint">
          Reactivate this user to reset their password.
        </p>
      )}
      <ConfirmDialog
        open={confirming}
        busy={reset.isPending}
        title={`Send password reset to ${fullName(user)}?`}
        description={`They’ll get an email at ${user.email} with a link to choose a new password. Their current password keeps working until they do.`}
        confirmLabel="Send reset email"
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          reset.mutate(user.id, {
            onSuccess: () => toast.success(`Password reset email sent to ${user.email}.`),
            onError: (error) => toast.error(`Couldn’t send the reset email: ${errorMessage(error)}`),
            onSettled: () => setConfirming(false),
          })
        }
      />
    </div>
  )
}

function MetadataCard({ user }: { user: User }) {
  const toast = useToast()
  return (
    <section className="card card--aside" aria-labelledby="meta-heading">
      <h2 id="meta-heading" className="card__title">
        Details
      </h2>
      <dl className="meta-list">
        <div>
          <dt>User ID</dt>
          <dd className="meta-list__id">
            <code>{user.id}</code>
            <button
              type="button"
              className="icon-button icon-button--sm"
              aria-label="Copy user ID"
              onClick={async () => {
                if (await copyToClipboard(user.id)) toast.success('User ID copied.')
                else toast.error('Couldn’t copy to the clipboard.')
              }}
            >
              <Icon name="copy" size={16} />
            </button>
          </dd>
        </div>
        <div>
          <dt>Added</dt>
          <dd>
            <time dateTime={user.created_at}>{formatDateTime(user.created_at)}</time>
          </dd>
        </div>
        <div>
          <dt>Last updated</dt>
          <dd>
            <time dateTime={user.updated_at} title={formatDateTime(user.updated_at)}>
              {formatRelative(user.updated_at)}
            </time>
          </dd>
        </div>
      </dl>
    </section>
  )
}

function DetailSkeleton() {
  return (
    <>
      <p className="visually-hidden" role="status">
        Loading user…
      </p>
      <div className="detail-grid" aria-hidden="true">
        <div className="card">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="skeleton-field">
              <span className="skeleton skeleton--sm" style={{ width: '6rem' }} />
              <span className="skeleton skeleton--input" />
            </div>
          ))}
        </div>
        <div className="card card--aside">
          <span className="skeleton" style={{ width: '8rem' }} />
          <span className="skeleton skeleton--sm" style={{ width: '12rem' }} />
        </div>
      </div>
    </>
  )
}
