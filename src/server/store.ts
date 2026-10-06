import { ROLES, STATUSES } from '../api/types'
import type { Role, SortParam, Status, User, UserInput } from '../api/types'
import { DOMAINS, FIRST_NAMES, LAST_NAMES, emailSlug, mulberry32 } from './seed'

/** A user as the server stores it: the public record plus a revision counter. */
export interface StoredUser extends User {
  rev: number
}

export interface ListQuery {
  skip: number
  limit: number
  q?: string
  role?: Role
  status?: Status
  sort: SortParam
}

const DAY_MS = 86_400_000
const SEED_SPAN_MS = 730 * DAY_MS
/**
 * The newest sign-ups are spread over the last few months (hours to days
 * apart) instead of minutes apart, so the default newest-first list shows
 * varied "Added" dates the way a real workspace does.
 */
const RECENT_ROWS = 400
const RECENT_SPAN_MS = 120 * DAY_MS

/**
 * Seed emails are unique without numeric suffixes. Each (first, last) name
 * pair hands out "variants": `first.last` on each domain, then `first_last`
 * on each domain, then (rarely needed) `first.m.last` middle initials on the
 * first few domains. Every format keeps the full first and last name around
 * a single separator, so two different name pairs can never produce the
 * same address.
 */
const SEPARATORS = ['.', '_'] as const
const PLAIN_SLOTS = SEPARATORS.flatMap((_, sep) => DOMAINS.map((_, domain) => ({ domain, sep })))
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'
const MIDDLE_INITIAL_DOMAINS = 4
const EMAIL_VARIANTS = PLAIN_SLOTS.length + MIDDLE_INITIAL_DOMAINS * LETTERS.length // 136, fits a byte
const SCRAMBLE_PRIME = 1_000_003
const FIRST_SLUGS = FIRST_NAMES.map(emailSlug)
const LAST_SLUGS = LAST_NAMES.map(emailSlug)

/**
 * In-memory user table built to behave like an indexed database table at
 * 500k+ rows without holding 500k JS objects.
 *
 * - Seed rows live in typed arrays (one byte per column), ~3 MB total, and
 *   are materialised into objects only when a page is actually returned.
 * - Created and edited rows live in `overrides`, which shadows the seed data.
 * - The last filtered + sorted result set is cached and keyed on `version`,
 *   so paging through one query costs O(limit), not O(n), per request.
 */
export class UserStore {
  private readonly seedCount: number
  private readonly seedEpoch: number
  private readonly firstIdx: Uint8Array
  private readonly lastIdx: Uint8Array
  /** Which email variant this row uses for its name pair (see EMAIL_VARIANTS). */
  private readonly emailVariant: Uint8Array
  private readonly roleIdx: Uint8Array
  private readonly statusIdx: Uint8Array
  private readonly createdOffset: Float64Array

  private readonly overrides = new Map<number, StoredUser>()
  /** email -> row, for every row in `overrides`. */
  private readonly overrideEmails = new Map<string, number>()
  private count: number
  private version = 0
  private cache: { key: string; rows: Int32Array } | null = null

  constructor(seedCount: number, seed = 42, now = Date.now()) {
    this.seedCount = seedCount
    this.count = seedCount
    this.seedEpoch = now - SEED_SPAN_MS
    this.firstIdx = new Uint8Array(seedCount)
    this.lastIdx = new Uint8Array(seedCount)
    this.emailVariant = new Uint8Array(seedCount)
    this.roleIdx = new Uint8Array(seedCount)
    this.statusIdx = new Uint8Array(seedCount)
    this.createdOffset = new Float64Array(seedCount)

    const rand = mulberry32(seed)
    const recent = Math.min(RECENT_ROWS, Math.floor(seedCount / 2))
    const older = seedCount - recent
    const olderSpan = SEED_SPAN_MS - RECENT_SPAN_MS
    const olderStep = olderSpan / Math.max(older, 1)
    const recentStep = RECENT_SPAN_MS / Math.max(recent, 1)
    const pairCount = new Uint8Array(FIRST_NAMES.length * LAST_NAMES.length)

    for (let i = 0; i < seedCount; i++) {
      const first = Math.floor(rand() * FIRST_NAMES.length)
      let last = Math.floor(rand() * LAST_NAMES.length)
      // A name pair that has used every email variant (~never at 500k) moves
      // to the next surname, which keeps every seed email unique.
      while (pairCount[first * LAST_NAMES.length + last] >= EMAIL_VARIANTS) last = (last + 1) % LAST_NAMES.length
      this.firstIdx[i] = first
      this.lastIdx[i] = last
      pairCount[first * LAST_NAMES.length + last]++

      const r = rand()
      this.roleIdx[i] = r < 0.06 ? 0 : r < 0.5 ? 1 : 2 // Admin 6%, Member 44%, Viewer 50%

      // Recent sign-ups are often still pending; long-standing accounts are
      // mostly active, with some suspended and a few never-accepted invites.
      const isRecent = i >= older
      const s = rand()
      this.statusIdx[i] = isRecent
        ? s < 0.55 ? 0 : s < 0.88 ? 1 : 2 // active 55%, invited 33%, suspended 12%
        : s < 0.84 ? 0 : s < 0.9 ? 1 : 2 // active 84%, invited 6%, suspended 10%

      // Monotonic in `i`, so row order is creation order. Jitter within each
      // step keeps the gaps irregular.
      this.createdOffset[i] = isRecent
        ? olderSpan + Math.floor((i - older) * recentStep + rand() * recentStep * 0.9)
        : Math.floor(i * olderStep + rand() * olderStep * 0.9)
    }

    // Hand out each pair's variants in a scrambled row order rather than
    // creation order, so plain addresses aren't all taken by the oldest
    // accounts. Stepping by a prime larger than any seed count visits every
    // row exactly once.
    const variantsUsed = new Uint8Array(pairCount.length)
    for (let j = 0; j < seedCount; j++) {
      const row = (j * SCRAMBLE_PRIME) % seedCount
      this.emailVariant[row] = variantsUsed[this.firstIdx[row] * LAST_NAMES.length + this.lastIdx[row]]++
    }
  }

  get total(): number {
    return this.count
  }

  // ---------------------------------------------------------------- reads

  get(id: string): StoredUser | undefined {
    const row = rowFromId(id)
    if (row === undefined || row >= this.count) return undefined
    return this.read(row)
  }

  list(query: ListQuery): { items: User[]; total: number } {
    const rows = this.resolve(query)
    const items: User[] = []
    const end = Math.min(query.skip + query.limit, rows.length)
    for (let i = query.skip; i < end; i++) items.push(toPublic(this.read(rows[i])))
    return { items, total: rows.length }
  }

  isEmailTaken(email: string, exceptId?: string): boolean {
    const normalized = email.trim().toLowerCase()
    const except = exceptId === undefined ? undefined : rowFromId(exceptId)
    const overrideRow = this.overrideEmails.get(normalized)
    if (overrideRow !== undefined) return overrideRow !== except

    const row = this.findSeedRowByEmail(normalized)
    return row !== -1 && row !== except && !this.overrides.has(row)
  }

  /**
   * Decodes a seed-format email back to (first, last, variant), then finds
   * the one row holding that combination. The scan compares bytes in typed
   * arrays only (~1 ms at 500k rows) and runs on writes, not on reads.
   */
  private findSeedRowByEmail(email: string): number {
    const [local, domain, ...rest] = email.split('@')
    const domainIndex = DOMAINS.indexOf(domain)
    if (rest.length || domainIndex === -1) return -1

    // first.m.last, or first<sep>last with exactly one separator.
    const dotted = local.split('.')
    const isMiddle = dotted.length === 3 && dotted[1].length === 1
    const sep = isMiddle ? 0 : SEPARATORS.findIndex((s) => local.split(s).length === 2)
    if (sep === -1) return -1
    const [firstSlug, lastSlug] = isMiddle ? [dotted[0], dotted[2]] : local.split(SEPARATORS[sep])
    if (!isMiddle && SEPARATORS.some((s, i) => i !== sep && local.includes(s))) return -1

    const first = FIRST_SLUGS.indexOf(firstSlug)
    const last = LAST_SLUGS.indexOf(lastSlug)
    if (first === -1 || last === -1) return -1
    const pair = first * LAST_NAMES.length + last
    let variant: number
    if (isMiddle) {
      const letter = LETTERS.indexOf(dotted[1])
      if (letter === -1 || domainIndex >= MIDDLE_INITIAL_DOMAINS) return -1
      variant = PLAIN_SLOTS.length + domainIndex * LETTERS.length + middleOffset(pair, letter)
    } else {
      variant = PLAIN_SLOTS.findIndex((s) => s.domain === domainIndex && s.sep === sep)
    }

    for (let row = 0; row < this.seedCount; row++) {
      if (this.firstIdx[row] === first && this.lastIdx[row] === last && this.emailVariant[row] === variant) return row
    }
    return -1
  }

  // --------------------------------------------------------------- writes

  create(input: UserInput, now = new Date()): StoredUser {
    const row = this.count++
    const timestamp = now.toISOString()
    const user: StoredUser = {
      id: idFromRow(row),
      ...normalizeInput(input),
      created_at: timestamp,
      updated_at: timestamp,
      rev: 1,
    }
    this.write(row, user)
    return user
  }

  update(id: string, input: UserInput, now = new Date()): StoredUser {
    const row = rowFromId(id)
    const current = row === undefined ? undefined : this.get(id)
    if (row === undefined || !current) throw new Error(`No user ${id}`)
    const next: StoredUser = {
      ...current,
      ...normalizeInput(input),
      updated_at: now.toISOString(),
      rev: current.rev + 1,
    }
    this.overrideEmails.delete(current.email)
    this.write(row, next)
    return next
  }

  // ------------------------------------------------------------ internals

  private write(row: number, user: StoredUser) {
    this.overrides.set(row, user)
    this.overrideEmails.set(user.email, row)
    this.version++
  }

  private read(row: number): StoredUser {
    const override = this.overrides.get(row)
    if (override) return override
    const created = new Date(this.seedEpoch + this.createdOffset[row]).toISOString()
    return {
      id: idFromRow(row),
      first_name: FIRST_NAMES[this.firstIdx[row]],
      last_name: LAST_NAMES[this.lastIdx[row]],
      email: this.seedEmail(row),
      role: ROLES[this.roleIdx[row]],
      status: STATUSES[this.statusIdx[row]],
      created_at: created,
      updated_at: created,
      rev: 1,
    }
  }

  private seedEmail(row: number): string {
    const first = FIRST_SLUGS[this.firstIdx[row]]
    const last = LAST_SLUGS[this.lastIdx[row]]
    const variant = this.emailVariant[row]
    if (variant < PLAIN_SLOTS.length) {
      const { domain, sep } = PLAIN_SLOTS[variant]
      return `${first}${SEPARATORS[sep]}${last}@${DOMAINS[domain]}`
    }
    const m = variant - PLAIN_SLOTS.length
    const pair = this.firstIdx[row] * LAST_NAMES.length + this.lastIdx[row]
    const domain = DOMAINS[Math.floor(m / LETTERS.length)]
    return `${first}.${LETTERS[middleLetter(pair, m % LETTERS.length)]}.${last}@${domain}`
  }

  /** Filter + sort, memoised on the query and the store version. */
  private resolve(query: ListQuery): Int32Array {
    const q = query.q?.trim().toLowerCase() ?? ''
    const key = `${this.version}|${q}|${query.role ?? ''}|${query.status ?? ''}|${query.sort}`
    if (this.cache?.key === key) return this.cache.rows

    const roleCode = query.role ? ROLES.indexOf(query.role) : -1
    const statusCode = query.status ? STATUSES.indexOf(query.status) : -1
    const matched = new Int32Array(this.count)
    let n = 0

    for (let row = 0; row < this.count; row++) {
      const override = this.overrides.get(row)
      if (override) {
        if (query.role && override.role !== query.role) continue
        if (query.status && override.status !== query.status) continue
        if (q && !haystack(override.first_name, override.last_name, override.email).includes(q)) continue
      } else {
        if (roleCode >= 0 && this.roleIdx[row] !== roleCode) continue
        if (statusCode >= 0 && this.statusIdx[row] !== statusCode) continue
        if (
          q &&
          !haystack(FIRST_NAMES[this.firstIdx[row]], LAST_NAMES[this.lastIdx[row]], this.seedEmail(row)).includes(q)
        )
          continue
      }
      matched[n++] = row
    }

    const rows = this.sortRows(matched.subarray(0, n), query.sort)
    this.cache = { key, rows }
    return rows
  }

  private sortRows(rows: Int32Array, sort: SortParam): Int32Array {
    const desc = sort.startsWith('-')
    const field = (desc ? sort.slice(1) : sort) as SortParam
    const dir = desc ? -1 : 1

    // Rows are already in creation order, so created_at needs no comparison.
    if (field === 'created_at') return desc ? rows.slice().reverse() : rows

    // Precompute one sort key per row so the comparator does no allocation.
    const keys = new Array<string | number>(rows.length)
    const order = new Array<number>(rows.length)
    for (let i = 0; i < rows.length; i++) {
      keys[i] = this.sortKey(rows[i], field)
      order[i] = i
    }
    order.sort((a, b) => {
      const ka = keys[a]
      const kb = keys[b]
      if (ka < kb) return -dir
      if (ka > kb) return dir
      return a - b // stable tiebreak: creation order
    })
    const sorted = new Int32Array(rows.length)
    for (let i = 0; i < order.length; i++) sorted[i] = rows[order[i]]
    return sorted
  }

  private sortKey(row: number, field: SortParam): string | number {
    const override = this.overrides.get(row)
    switch (field) {
      case 'name':
        return override
          ? `${override.last_name}\u0000${override.first_name}`.toLowerCase()
          : `${LAST_NAMES[this.lastIdx[row]]}\u0000${FIRST_NAMES[this.firstIdx[row]]}`.toLowerCase()
      case 'email':
        return override ? override.email : this.seedEmail(row)
      case 'role':
        return override ? ROLES.indexOf(override.role) : this.roleIdx[row]
      case 'status':
        return override ? STATUSES.indexOf(override.status) : this.statusIdx[row]
      default:
        return row
    }
  }
}

function haystack(first: string, last: string, email: string): string {
  return `${first} ${last}\u0000${email}`.toLowerCase()
}

function normalizeInput(input: UserInput): UserInput {
  return {
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role,
    status: input.status,
  }
}

export function toPublic(user: StoredUser): User {
  const { rev: _rev, ...rest } = user
  return rest
}

/** Strong ETag derived from identity + revision. Opaque to the client. */
export function etagOf(user: StoredUser): string {
  return `"${user.id}.${user.rev}"`
}

/**
 * Middle-initial offsets (0-25) map to letters rotated by the name pair, so
 * a pair's first middle-initial address isn't always "x.a.y".
 * middleOffset inverts middleLetter.
 */
function middleLetter(pair: number, offset: number): number {
  return (offset + pair) % 26
}

function middleOffset(pair: number, letter: number): number {
  return (((letter - pair) % 26) + 26) % 26
}

function idFromRow(row: number): string {
  return `usr_${row.toString(36).padStart(6, '0')}`
}

function rowFromId(id: string): number | undefined {
  const match = /^usr_([0-9a-z]{6,})$/.exec(id)
  if (!match) return undefined
  const row = parseInt(match[1], 36)
  return Number.isSafeInteger(row) ? row : undefined
}
