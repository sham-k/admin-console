import type { User, UserInput } from '../api/types'
import { toInput } from '../hooks/users'
import { diffVersions } from '../lib/conflicts'
import { formatDateTime } from '../lib/format'
import { Dialog } from './Dialog'

interface ConflictDialogProps {
  open: boolean
  base: UserInput
  mine: UserInput
  latest: User | undefined
  /** True when opened by a failed save (412), false when detected proactively. */
  fromSave: boolean
  busy: boolean
  onDiscardMine: () => void
  onMerge: () => void
  onOverwrite: () => void
  onCancel: () => void
}

export function ConflictDialog({
  open,
  base,
  mine,
  latest,
  fromSave,
  busy,
  onDiscardMine,
  onMerge,
  onOverwrite,
  onCancel,
}: ConflictDialogProps) {
  const rows = latest ? diffVersions(base, toInput(latest), mine) : []
  const conflicts = rows.filter((row) => row.conflict).length

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      size="lg"
      role="alertdialog"
      dismissible={!busy}
      title={fromSave ? 'Your changes weren’t saved' : 'This user was updated elsewhere'}
      description={
        latest ? (
          <p>
            Someone else saved changes to this user ({formatDateTime(latest.updated_at)}) after you started editing.{' '}
            {conflicts > 0
              ? `${conflicts} field${conflicts === 1 ? '' : 's'} were changed by both of you.`
              : 'None of their changes overlap with yours.'}{' '}
            Choose how to continue.
          </p>
        ) : (
          <p>Loading the latest version…</p>
        )
      }
      footer={
        <>
          <button type="button" className="button button--secondary" onClick={onDiscardMine} disabled={busy || !latest}>
            Discard my changes
          </button>
          <button type="button" className="button button--secondary" onClick={onOverwrite} disabled={busy || !latest}>
            {busy ? 'Saving…' : 'Overwrite with mine'}
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={onMerge}
            disabled={busy || !latest}
            data-autofocus
          >
            Review merged version
          </button>
        </>
      }
    >
      {latest && (
        <>
          <table className="diff-table">
            <caption className="visually-hidden">Differences between the saved version and your edits</caption>
            <thead>
              <tr>
                <th scope="col">Field</th>
                <th scope="col">Saved now</th>
                <th scope="col">Your edit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className={row.conflict ? 'diff-table__conflict' : undefined}>
                  <th scope="row">
                    {row.label}
                    {row.conflict && <span className="tag tag--danger">Both changed</span>}
                  </th>
                  <td>
                    {row.theirs}
                    {row.changedByThem && !row.conflict && <span className="tag">Changed by them</span>}
                  </td>
                  <td>
                    {row.mine}
                    {row.changedByMe && !row.conflict && <span className="tag">Changed by you</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="conflict-help">
            <li>
              <strong>Review merged version</strong> keeps your edits and takes their changes for every other field.
              Nothing is saved until you click Save.
            </li>
            <li>
              <strong>Overwrite with mine</strong> saves exactly what is in your form now, replacing all of their
              changes.
            </li>
            <li>
              <strong>Discard my changes</strong> reloads the saved version.
            </li>
          </ul>
        </>
      )}
    </Dialog>
  )
}
