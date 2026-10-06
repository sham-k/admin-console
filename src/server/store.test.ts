import { UserStore } from './store'

describe('seed data', () => {
  const store = new UserStore(500_000)
  const all = store.list({ skip: 0, limit: 500_000, sort: 'created_at' }).items

  it('gives every seed user a unique email with no numbers in it', () => {
    const emails = new Set(all.map((u) => u.email))
    expect(emails.size).toBe(all.length)
    expect(all.some((u) => /\d/.test(u.email))).toBe(false)
  })

  it('recognises any seed email as taken (case-insensitive), except for its own user', () => {
    for (const user of [all[0], all[1234], all[250_000], all[499_999]]) {
      expect(store.isEmailTaken(user.email.toUpperCase())).toBe(true)
      expect(store.isEmailTaken(user.email, user.id)).toBe(false)
    }
    expect(store.isEmailTaken('someone.new@contoso.com')).toBe(false)
  })

  it('spreads the newest sign-ups over different days and statuses', () => {
    const newest = store.list({ skip: 0, limit: 25, sort: '-created_at' }).items
    const days = new Set(newest.map((u) => u.created_at.slice(0, 10)))
    const statuses = new Set(newest.map((u) => u.status))
    expect(days.size).toBeGreaterThan(3)
    expect(statuses.size).toBe(3)
  })
})
