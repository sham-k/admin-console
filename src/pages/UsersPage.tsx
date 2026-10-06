import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/errors'
import { ROLES, STATUSES } from '../api/types'
import type { Role, SortField, SortParam, Status, User } from '../api/types'
import { CreateUserDialog } from '../components/CreateUserDialog'
import { ConfirmDialog } from '../components/Dialog'
import { Icon } from '../components/Icon'
import { Menu } from '../components/Menu'
import { Pagination } from '../components/Pagination'
import { Select } from '../components/Select'
import type { SelectOption } from '../components/Select'
import { Avatar, EmailText, EmptyState, ErrorState, RoleLabel, StatusBadge } from '../components/States'
import { useToast } from '../components/Toast'
import { useQuickUpdateUser, useResetPassword, useUserList } from '../hooks/users'
import { formatDate, formatDateTime, formatNumber, fullName } from '../lib/format'
import { copyToClipboard, useDebouncedValue, useDocumentTitle } from '../lib/hooks'
import { useListParams } from '../lib/useListParams'

type PendingAction = { kind: 'reset' | 'suspend' | 'reactivate'; user: User }

const SORT_LABELS: Record<SortField, string> = {
  name: 'name',
  email: 'email',
  created_at: 'date added',
  role: 'role',
  status: 'status',
}

// '' stands for "no filter" in the role and status dropdowns.
const ROLE_OPTIONS: SelectOption<Role | ''>[] = [
  { value: '', label: 'All roles' },
  ...ROLES.map((r) => ({ value: r, label: r })),
]

const STATUS_OPTIONS: SelectOption<Status | ''>[] = [
  { value: '', label: 'All statuses' },
  ...STATUSES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) })),
]

const SORT_OPTIONS: SelectOption<SortParam>[] = [
  { value: '-created_at', label: 'Newest first' },
  { value: 'created_at', label: 'Oldest first' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: '-name', label: 'Name (Z–A)' },
  { value: 'email', label: 'Email (A–Z)' },
  { value: 'role', label: 'Role' },
  { value: 'status', label: 'Status' },
]

export function UsersPage() {
  useDocumentTitle('Users')
  const { state, apiParams, update, hasFilters, clearFilters } = useListParams()
  const query = useUserList(apiParams)
  const [createOpen, setCreateOpen] = useState(false)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const resetPassword = useResetPassword()
  const quickUpdate = useQuickUpdateUser()

  const total = query.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / state.size))
  const items = query.data?.items ?? []

  // If the result set shrank (filter, or records changed) past the current
  // page, snap to the last page that exists instead of showing "no results".
  useEffect(() => {
    if (query.data && !query.isPlaceholderData && total > 0 && state.page > pageCount) {
      update({ page: pageCount }, { replace: true })
    }
  }, [query.data, query.isPlaceholderData, total, state.page, pageCount, update])

  const runPending = () => {
    if (!pending) return
    const { kind, user } = pending
    const done = () => setPending(null)
    if (kind === 'reset') {
      resetPassword.mutate(user.id, {
        onSuccess: () => toast.success(`Password reset email sent to ${user.email}.`),
        onError: (error) => toast.error(`Couldn’t send the reset email: ${errorMessage(error)}`),
        onSettled: done,
      })
    } else {
      const status: Status = kind === 'suspend' ? 'suspended' : 'active'
      quickUpdate.mutate(
        { id: user.id, patch: { status } },
        {
          onSuccess: () => toast.success(`${fullName(user)} was ${kind === 'suspend' ? 'suspended' : 'reactivated'}.`),
          onError: (error) => toast.error(`Couldn’t update ${fullName(user)}: ${errorMessage(error)}`),
          onSettled: done,
        },
      )
    }
  }

  const rangeStart = total === 0 ? 0 : apiParams.skip! + 1
  const rangeEnd = Math.min(apiParams.skip! + items.length, total)
  const isInitialLoad = query.isPending
  const isRefreshing = query.isFetching && !isInitialLoad
  const [sortField, sortDesc] = splitSort(state.sort)

  return (
    <div className="page page--fade-in">
      <header className="page-header">
        <div>
          <h1 tabIndex={-1}>Users</h1>
          <p className="page-header__subtitle">Manage who can access your workspace and what they can do.</p>
        </div>
        <button type="button" className="button button--primary" onClick={() => setCreateOpen(true)}>
          <Icon name="plus" /> Add user
        </button>
      </header>

      <Toolbar
        q={state.q}
        role={state.role}
        status={state.status}
        sort={state.sort}
        onSearch={(q) => update({ q }, { replace: true })}
        onRole={(role) => update({ role })}
        onStatus={(status) => update({ status })}
        onSort={(sort) => update({ sort })}
        hasFilters={hasFilters}
        onClear={clearFilters}
      />

      <div className="panel">
        <div className="panel__bar">
          <p className="result-count" role="status" aria-live="polite">
            {isInitialLoad
              ? 'Loading users…'
              : query.data
                ? total === 0
                  ? 'No matching users'
                  : `Showing ${formatNumber(rangeStart)}–${formatNumber(rangeEnd)} of ${formatNumber(total)} users`
                : ''}
          </p>
          {isRefreshing && <span className="progress" aria-hidden="true" />}
        </div>

        {query.isError && query.data && (
          <div className="alert alert--warning" role="alert">
            <Icon name="alert" />
            <p>Couldn’t refresh the list. You’re seeing the last results that loaded.</p>
            <button type="button" className="button button--secondary button--sm" onClick={() => void query.refetch()}>
              Try again
            </button>
          </div>
        )}

        {query.isError && !query.data ? (
          <ErrorState title="Couldn’t load users" error={query.error} onRetry={() => void query.refetch()} />
        ) : !isInitialLoad && total === 0 ? (
          hasFilters ? (
            <EmptyState
              title="No users match your filters"
              body={
                state.q
                  ? `Nothing matches “${state.q}”. Check the spelling or try fewer filters.`
                  : 'Try removing a filter.'
              }
              action={
                <button type="button" className="button button--secondary" onClick={clearFilters}>
                  Clear filters
                </button>
              }
            />
          ) : (
            <EmptyState
              title="No users yet"
              body="Add your first user to give them access."
              action={
                <button type="button" className="button button--primary" onClick={() => setCreateOpen(true)}>
                  <Icon name="plus" /> Add user
                </button>
              }
            />
          )
        ) : (
          <div className="table-wrap" data-refreshing={isRefreshing || undefined}>
            <table className="table" aria-busy={query.isFetching}>
              <caption className="visually-hidden">
                Users, sorted by {SORT_LABELS[sortField]}, {sortDesc ? 'descending' : 'ascending'}
              </caption>
              <thead>
                <tr>
                  <SortHeader field="name" label="User" sort={state.sort} onSort={(sort) => update({ sort })} />
                  <SortHeader
                    field="role"
                    label="Role"
                    sort={state.sort}
                    onSort={(sort) => update({ sort })}
                    className="hide-sm"
                  />
                  <SortHeader
                    field="status"
                    label="Status"
                    sort={state.sort}
                    onSort={(sort) => update({ sort })}
                    className="hide-sm"
                  />
                  <SortHeader
                    field="created_at"
                    label="Added"
                    sort={state.sort}
                    onSort={(sort) => update({ sort })}
                    className="hide-sm"
                    descFirst
                  />
                  <th scope="col" className="table__actions">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {isInitialLoad
                  ? Array.from({ length: Math.min(state.size, 10) }, (_, i) => <SkeletonRow key={i} />)
                  : items.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <div className="user-cell">
                            <Avatar first={user.first_name} last={user.last_name} />
                            <div className="user-cell__text">
                              <Link
                                to={`/users/${user.id}`}
                                state={{ from: location.search }}
                                className="user-cell__name"
                              >
                                {fullName(user)}
                              </Link>
                              <span className="user-cell__email">
                                <EmailText email={user.email} />
                              </span>
                              {/* Phones: role and status sit under the email (their
                                  columns are hidden), so the name column gets the width. */}
                              <span className="user-cell__meta show-sm">
                                <span className="user-cell__role">{user.role}</span>
                                <StatusBadge status={user.status} />
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="hide-sm">
                          <RoleLabel role={user.role} />
                        </td>
                        <td className="hide-sm">
                          <StatusBadge status={user.status} />
                        </td>
                        <td className="hide-sm">
                          <time dateTime={user.created_at} title={formatDateTime(user.created_at)}>
                            {formatDate(user.created_at)}
                          </time>
                        </td>
                        <td className="table__actions">
                          <Menu
                            label={`Actions for ${fullName(user)}`}
                            trigger={<Icon name="more" />}
                            items={[
                              {
                                label: 'View and edit',
                                onSelect: () => navigate(`/users/${user.id}`, { state: { from: location.search } }),
                              },
                              {
                                label: 'Copy email',
                                onSelect: async () => {
                                  if (await copyToClipboard(user.email)) toast.success(`Copied ${user.email}.`)
                                  else toast.error('Couldn’t copy to the clipboard.')
                                },
                              },
                              {
                                label: 'Send password reset',
                                onSelect: () => setPending({ kind: 'reset', user }),
                                disabled: user.status === 'suspended',
                              },
                              user.status === 'suspended'
                                ? { label: 'Reactivate', onSelect: () => setPending({ kind: 'reactivate', user }) }
                                : {
                                    label: 'Suspend',
                                    tone: 'danger',
                                    onSelect: () => setPending({ kind: 'suspend', user }),
                                  },
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <Pagination
            page={state.page}
            pageCount={pageCount}
            size={state.size}
            onPageChange={(page) => update({ page })}
            onSizeChange={(size) => update({ size })}
          />
        )}
      </div>

      <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      <ConfirmDialog
        open={pending !== null}
        busy={resetPassword.isPending || quickUpdate.isPending}
        onCancel={() => setPending(null)}
        onConfirm={runPending}
        {...confirmCopy(pending)}
      />
    </div>
  )
}

function confirmCopy(pending: PendingAction | null) {
  if (!pending) return { title: '', description: '', confirmLabel: '' }
  const name = fullName(pending.user)
  switch (pending.kind) {
    case 'reset':
      return {
        title: `Send password reset to ${name}?`,
        description: `They’ll get an email at ${pending.user.email} with a link to choose a new password. Their current password keeps working until they do.`,
        confirmLabel: 'Send reset email',
      }
    case 'suspend':
      return {
        title: `Suspend ${name}?`,
        description: 'They’ll be signed out and won’t be able to sign in until reactivated. Their data is kept.',
        confirmLabel: 'Suspend user',
        tone: 'danger' as const,
      }
    case 'reactivate':
      return {
        title: `Reactivate ${name}?`,
        description: 'They’ll be able to sign in again with their existing role.',
        confirmLabel: 'Reactivate',
      }
  }
}

interface ToolbarProps {
  q: string
  role?: Role
  status?: Status
  sort: SortParam
  onSearch: (q: string) => void
  onRole: (role?: Role) => void
  onStatus: (status?: Status) => void
  onSort: (sort: SortParam) => void
  hasFilters: boolean
  onClear: () => void
}

function Toolbar({ q, role, status, sort, onSearch, onRole, onStatus, onSort, hasFilters, onClear }: ToolbarProps) {
  const ids = { search: useId(), role: useId(), status: useId(), sort: useId(), hint: useId() }
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(q)
  const debounced = useDebouncedValue(text, 300)
  const lastSent = useRef(q)

  // Typing -> URL (debounced so 500k-row scans don't run per keystroke).
  useEffect(() => {
    if (debounced.trim() === lastSent.current) return
    lastSent.current = debounced.trim()
    onSearch(debounced.trim())
  }, [debounced, onSearch])

  // URL -> input (Back button, "Clear filters").
  useEffect(() => {
    if (q !== lastSent.current) {
      lastSent.current = q
      setText(q)
    }
  }, [q])

  // Ctrl/⌘+K focuses search. A modified shortcut, so it can't fire by accident (WCAG 2.1.4).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)

  return (
    <div role="search" className="toolbar" aria-label="Filter users">
      <div className="toolbar__field toolbar__field--grow">
        <label htmlFor={ids.search}>Search</label>
        <div className="search-input">
          <Icon name="search" />
          <input
            ref={inputRef}
            id={ids.search}
            type="search"
            className="input"
            placeholder="Name or email"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSearch((lastSent.current = text.trim()))
            }}
            aria-describedby={ids.hint}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd id={ids.hint} className="search-input__kbd">
            <span className="visually-hidden">Shortcut: </span>
            {isMac ? '⌘K' : 'Ctrl K'}
          </kbd>
        </div>
      </div>
      <div className="toolbar__field">
        <label htmlFor={ids.role} id={`${ids.role}-label`}>
          Role
        </label>
        <Select
          id={ids.role}
          labelId={`${ids.role}-label`}
          value={role ?? ''}
          options={ROLE_OPTIONS}
          onChange={(v) => onRole((v || undefined) as Role)}
        />
      </div>
      <div className="toolbar__field">
        <label htmlFor={ids.status} id={`${ids.status}-label`}>
          Status
        </label>
        <Select
          id={ids.status}
          labelId={`${ids.status}-label`}
          value={status ?? ''}
          options={STATUS_OPTIONS}
          onChange={(v) => onStatus((v || undefined) as Status)}
        />
      </div>
      {/* Column headers sort too; this select exists for small screens and discoverability. */}
      <div className="toolbar__field">
        <label htmlFor={ids.sort} id={`${ids.sort}-label`}>
          Sort by
        </label>
        <Select id={ids.sort} labelId={`${ids.sort}-label`} value={sort} options={SORT_OPTIONS} onChange={onSort} />
      </div>
      {hasFilters && (
        <button type="button" className="button button--ghost toolbar__clear" onClick={onClear}>
          <Icon name="close" /> Clear filters
        </button>
      )}
    </div>
  )
}

function SortHeader({
  field,
  label,
  sort,
  onSort,
  className,
  descFirst = false,
}: {
  field: SortField
  label: string
  sort: SortParam
  onSort: (sort: SortParam) => void
  className?: string
  descFirst?: boolean
}) {
  const [activeField, desc] = splitSort(sort)
  const active = activeField === field
  const next: SortParam = active ? (desc ? field : `-${field}`) : descFirst ? `-${field}` : field
  return (
    <th scope="col" aria-sort={active ? (desc ? 'descending' : 'ascending') : undefined} className={className}>
      <button type="button" className="sort-button" onClick={() => onSort(next)}>
        {label}
        <Icon name={active ? (desc ? 'arrowDown' : 'arrowUp') : 'sort'} size={14} />
      </button>
    </th>
  )
}

function SkeletonRow() {
  return (
    <tr className="skeleton-row" aria-hidden="true">
      <td>
        <div className="user-cell">
          <span className="skeleton skeleton--circle" />
          <div className="user-cell__text">
            <span className="skeleton" style={{ width: '9rem' }} />
            <span className="skeleton skeleton--sm" style={{ width: '13rem' }} />
          </div>
        </div>
      </td>
      <td className="hide-sm">
        <span className="skeleton" style={{ width: '4rem' }} />
      </td>
      <td className="hide-sm">
        <span className="skeleton" style={{ width: '5rem' }} />
      </td>
      <td className="hide-sm">
        <span className="skeleton" style={{ width: '6rem' }} />
      </td>
      <td />
    </tr>
  )
}

function splitSort(sort: SortParam): [SortField, boolean] {
  const desc = sort.startsWith('-')
  return [(desc ? sort.slice(1) : sort) as SortField, desc]
}
