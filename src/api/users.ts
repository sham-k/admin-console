import { ApiError } from './errors'
import type { HttpClient, HttpResponse } from './http'
import type { PasswordResetResponse, User, UserInput, UserListParams, UserListResponse, Versioned } from './types'

export interface UsersApi {
  list(params: UserListParams, signal?: AbortSignal): Promise<UserListResponse>
  get(id: string, signal?: AbortSignal): Promise<Versioned<User>>
  create(input: UserInput): Promise<Versioned<User>>
  /** Throws ApiError(412) if `etag` is no longer the server's current version. */
  update(id: string, input: UserInput, etag: string): Promise<Versioned<User>>
  resetPassword(id: string): Promise<PasswordResetResponse>
}

export function createUsersApi(http: HttpClient): UsersApi {
  return {
    async list(params, signal) {
      const { data } = await http.request<UserListResponse>('GET', '/users', {
        query: { ...params },
        signal,
      })
      return data
    },

    async get(id, signal) {
      return versioned(await http.request<User>('GET', `/users/${encodeURIComponent(id)}`, { signal }))
    },

    async create(input) {
      return versioned(await http.request<User>('POST', '/users', { body: input }))
    },

    async update(id, input, etag) {
      return versioned(
        await http.request<User>('PUT', `/users/${encodeURIComponent(id)}`, {
          body: input,
          headers: { 'If-Match': etag },
        }),
      )
    },

    async resetPassword(id) {
      const { data } = await http.request<PasswordResetResponse>(
        'POST',
        `/users/${encodeURIComponent(id)}/password-reset`,
      )
      return data
    },
  }
}

function versioned(response: HttpResponse<User>): Versioned<User> {
  const etag = response.headers.get('ETag')
  if (!etag) {
    // Without an ETag we could never save this record safely, so treat it as
    // a broken response rather than letting the UI fail later on save.
    throw new ApiError({
      status: response.status,
      code: 'missing_etag',
      message: 'The server response was missing a version tag.',
    })
  }
  return { data: response.data, etag }
}
