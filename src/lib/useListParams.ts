import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ROLES, SORT_FIELDS, STATUSES } from '../api/types'
import type { Role, SortParam, Status, UserListParams } from '../api/types'

export const PAGE_SIZES = [10, 25, 50, 100] as const
const DEFAULT_SIZE = 25
const DEFAULT_SORT: SortParam = '-created_at'

export interface ListState {
  page: number
  size: number
  q: string
  role?: Role
  status?: Status
  sort: SortParam
}

/**
 * List state lives in the URL, so filtered views are shareable, survive a
 * reload, and the browser Back button returns to the exact page the admin
 * left. Anything malformed falls back to defaults rather than erroring.
 */
export function useListParams() {
  const [searchParams, setSearchParams] = useSearchParams()

  const state = useMemo<ListState>(() => {
    const page = Number(searchParams.get('page'))
    const size = Number(searchParams.get('size'))
    const role = searchParams.get('role')
    const status = searchParams.get('status')
    const sort = searchParams.get('sort') ?? ''
    return {
      page: Number.isInteger(page) && page > 0 ? page : 1,
      size: (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_SIZE,
      q: searchParams.get('q') ?? '',
      role: ROLES.includes(role as Role) ? (role as Role) : undefined,
      status: STATUSES.includes(status as Status) ? (status as Status) : undefined,
      sort: SORT_FIELDS.includes(sort.replace(/^-/, '') as never) ? (sort as SortParam) : DEFAULT_SORT,
    }
  }, [searchParams])

  const update = useCallback(
    (patch: Partial<ListState>, options: { replace?: boolean } = {}) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          // Any change other than paging invalidates the current page number.
          if (!('page' in patch)) next.delete('page')
          for (const [key, value] of Object.entries(patch)) {
            const isDefault =
              value === undefined ||
              value === '' ||
              (key === 'page' && value === 1) ||
              (key === 'size' && value === DEFAULT_SIZE) ||
              (key === 'sort' && value === DEFAULT_SORT)
            if (isDefault) next.delete(key)
            else next.set(key, String(value))
          }
          return next
        },
        { replace: options.replace },
      )
    },
    [setSearchParams],
  )

  const apiParams = useMemo<UserListParams>(
    () => ({
      skip: (state.page - 1) * state.size,
      limit: state.size,
      q: state.q || undefined,
      role: state.role,
      status: state.status,
      sort: state.sort,
    }),
    [state],
  )

  return {
    state,
    apiParams,
    update,
    hasFilters: Boolean(state.q || state.role || state.status),
    clearFilters: () => update({ q: '', role: undefined, status: undefined }),
  }
}
