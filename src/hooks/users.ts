import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useApi } from '../api/context'
import type { User, UserInput, UserListParams, Versioned } from '../api/types'

export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (params: UserListParams) => [...userKeys.lists(), params] as const,
  detail: (id: string) => [...userKeys.all, 'detail', id] as const,
}

/**
 * One page of users. Keeps the previous page on screen while the next loads
 * (no layout jump) and prefetches the following page so "Next" feels instant.
 */
export function useUserList(params: UserListParams) {
  const api = useApi()
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: userKeys.list(params),
    queryFn: ({ signal }) => api.users.list(params, signal),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })

  const total = query.data?.total
  useEffect(() => {
    if (total === undefined || query.isPlaceholderData) return
    const next = { ...params, skip: (params.skip ?? 0) + (params.limit ?? 25) }
    if (next.skip < total) {
      void queryClient.prefetchQuery({
        queryKey: userKeys.list(next),
        queryFn: ({ signal }) => api.users.list(next, signal),
        staleTime: 15_000,
      })
    }
  }, [api, queryClient, params, total, query.isPlaceholderData])

  return query
}

export function useUser(id: string) {
  const api = useApi()
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: ({ signal }) => api.users.get(id, signal),
    // Poll gently so edits made elsewhere surface before the admin hits Save.
    refetchInterval: 30_000,
  })
}

export function useCreateUser() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UserInput) => api.users.create(input),
    onSuccess: (result) => {
      queryClient.setQueryData(userKeys.detail(result.data.id), result)
      void queryClient.invalidateQueries({ queryKey: userKeys.lists() })
    },
  })
}

export function useUpdateUser() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input, etag }: { id: string; input: UserInput; etag: string }) =>
      api.users.update(id, input, etag),
    onSuccess: (result) => {
      queryClient.setQueryData(userKeys.detail(result.data.id), result)
      void queryClient.invalidateQueries({ queryKey: userKeys.lists() })
    },
  })
}

export function useResetPassword() {
  const api = useApi()
  return useMutation({ mutationFn: (id: string) => api.users.resetPassword(id) })
}

/**
 * Read-modify-write for one-click actions from the list (e.g. suspend). The
 * list doesn't carry ETags, so fetch the current version first, then PUT with
 * If-Match. A 412 here means it changed between those two calls: surfaced as
 * an error rather than retried blindly.
 */
export function useQuickUpdateUser() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<UserInput> }) => {
      const current = await api.users.get(id)
      return api.users.update(id, { ...toInput(current.data), ...patch }, current.etag)
    },
    onSuccess: (result: Versioned<User>) => {
      queryClient.setQueryData(userKeys.detail(result.data.id), result)
      void queryClient.invalidateQueries({ queryKey: userKeys.lists() })
    },
  })
}

export function toInput(user: User): UserInput {
  return {
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    role: user.role,
    status: user.status,
  }
}
