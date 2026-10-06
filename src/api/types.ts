/**
 * Wire-level contract shared by the client API layer and the stubbed server.
 * Field names mirror the JSON the API sends (snake_case) so nothing gets
 * silently renamed between the network boundary and the UI.
 */

export const ROLES = ['Admin', 'Member', 'Viewer'] as const
export type Role = (typeof ROLES)[number]

export const STATUSES = ['active', 'invited', 'suspended'] as const
export type Status = (typeof STATUSES)[number]

export interface User {
  id: string
  first_name: string
  last_name: string
  email: string
  role: Role
  status: Status
  /** ISO-8601 timestamp. Added beyond the minimum contract. */
  created_at: string
  /** ISO-8601 timestamp. Added beyond the minimum contract. */
  updated_at: string
}

/** The fields an admin can write. Used for both POST and PUT bodies. */
export type UserInput = Pick<User, 'first_name' | 'last_name' | 'email' | 'role' | 'status'>

export const SORT_FIELDS = ['name', 'email', 'created_at', 'role', 'status'] as const
export type SortField = (typeof SORT_FIELDS)[number]
/** `name` = ascending, `-name` = descending. */
export type SortParam = SortField | `-${SortField}`

export interface UserListParams {
  /** Records to skip (contract: default 0). */
  skip?: number
  /** Page size (contract: default 25, max 100). */
  limit?: number
  // ---- Extensions to the contract (documented in the README) ----
  /** Case-insensitive match on name or email. */
  q?: string
  role?: Role
  status?: Status
  sort?: SortParam
}

export interface UserListResponse {
  items: User[]
  total: number
}

/** A single resource plus the version token needed to write it back. */
export interface Versioned<T> {
  data: T
  etag: string
}

export interface PasswordResetResponse {
  status: 'queued'
  requested_at: string
}

/** Error envelope returned by every non-2xx response. */
export interface ErrorBody {
  error: {
    code: string
    message: string
    /** Per-field validation messages, keyed by field name. */
    fields?: Record<string, string>
  }
}

export const LIST_DEFAULT_LIMIT = 25
export const LIST_MAX_LIMIT = 100
