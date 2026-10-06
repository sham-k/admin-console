import type { UserInput } from '../api/types'
import { diffVersions, mergeVersions } from './conflicts'

const base: UserInput = {
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
  role: 'Member',
  status: 'active',
}

describe('diffVersions', () => {
  it('attributes each change to its author and flags true conflicts', () => {
    const theirs = { ...base, role: 'Admin' as const, last_name: 'Byron' }
    const mine = { ...base, last_name: 'King', email: 'ada.k@example.com' }
    const rows = diffVersions(base, theirs, mine)

    expect(rows.map((r) => r.key)).toEqual(['last_name', 'email', 'role'])
    expect(rows.find((r) => r.key === 'last_name')).toMatchObject({ conflict: true })
    expect(rows.find((r) => r.key === 'role')).toMatchObject({
      changedByThem: true,
      changedByMe: false,
      conflict: false,
    })
    expect(rows.find((r) => r.key === 'email')).toMatchObject({ changedByThem: false, changedByMe: true })
  })

  it('does not call identical edits a conflict', () => {
    const same = { ...base, role: 'Viewer' as const }
    expect(diffVersions(base, same, same)[0]).toMatchObject({ conflict: false })
  })
})

describe('mergeVersions', () => {
  it('keeps my edits and takes their changes elsewhere', () => {
    const theirs = { ...base, role: 'Admin' as const, last_name: 'Byron' }
    const mine = { ...base, last_name: 'King' }
    expect(mergeVersions(base, theirs, mine)).toEqual({ ...base, role: 'Admin', last_name: 'King' })
  })
})
