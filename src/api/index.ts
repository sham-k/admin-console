import { createHttpClient } from './http'
import type { Transport } from './http'
import { createUsersApi } from './users'

/**
 * Builds the typed API surface on top of any fetch-compatible transport.
 * Against a real backend: `createApi('https://api.example.com', fetch)`.
 */
export function createApi(baseUrl: string, transport: Transport) {
  const http = createHttpClient(baseUrl, transport)
  return {
    users: createUsersApi(http),
  }
}

export type Api = ReturnType<typeof createApi>
