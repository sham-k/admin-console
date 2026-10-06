import type { UserInput } from '../api/types'

const FIELDS: { key: keyof UserInput; label: string }[] = [
  { key: 'first_name', label: 'First name' },
  { key: 'last_name', label: 'Last name' },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Role' },
  { key: 'status', label: 'Status' },
]

export interface FieldDiff {
  key: keyof UserInput
  label: string
  theirs: string
  mine: string
  changedByThem: boolean
  changedByMe: boolean
  /** Both sides changed the field to different values. */
  conflict: boolean
}

/** Three-way comparison: what the admin started from, what's saved now, and their edits. */
export function diffVersions(base: UserInput, theirs: UserInput, mine: UserInput): FieldDiff[] {
  return FIELDS.map(({ key, label }) => {
    const changedByThem = base[key] !== theirs[key]
    const changedByMe = base[key] !== mine[key]
    return {
      key,
      label,
      theirs: theirs[key],
      mine: mine[key],
      changedByThem,
      changedByMe,
      conflict: changedByThem && changedByMe && theirs[key] !== mine[key],
    }
  }).filter((row) => row.changedByThem || row.changedByMe)
}

/** Keep the admin's edits; take everyone else's changes for fields they didn't touch. */
export function mergeVersions(base: UserInput, theirs: UserInput, mine: UserInput): UserInput {
  const merged: UserInput = { ...theirs }
  for (const { key } of FIELDS) {
    if (base[key] !== mine[key]) Object.assign(merged, { [key]: mine[key] })
  }
  return merged
}

export function sameInput(a: UserInput, b: UserInput): boolean {
  return FIELDS.every(({ key }) => a[key] === b[key])
}
