import { ApiError } from './errors'
import type { ErrorBody } from './types'

/**
 * Anything with the shape of `fetch`. In production this is `window.fetch`;
 * here it is the in-memory server. The client never knows the difference.
 */
export type Transport = (request: Request) => Promise<Response>

type QueryValue = string | number | boolean | undefined | null

export interface RequestOptions {
  query?: Record<string, QueryValue>
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
  /** Abort the request if it takes longer than this (ms). */
  timeoutMs?: number
}

export interface HttpResponse<T> {
  status: number
  headers: Headers
  data: T
}

export interface HttpClient {
  request<T>(method: string, path: string, options?: RequestOptions): Promise<HttpResponse<T>>
}

const DEFAULT_TIMEOUT_MS = 15_000

export function createHttpClient(baseUrl: string, transport: Transport): HttpClient {
  async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<HttpResponse<T>> {
    const url = new URL(baseUrl.replace(/\/$/, '') + path)
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
    }

    const headers = new Headers({ Accept: 'application/json', ...options.headers })
    let body: string | undefined
    if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json')
      body = JSON.stringify(options.body)
    }

    // Combine the caller's signal (e.g. React Query cancelling a stale page)
    // with our own timeout so a hung request can never spin forever.
    const timeout = AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout

    let response: Response
    try {
      response = await transport(new Request(url, { method, headers, body, signal }))
    } catch (error) {
      // Caller-initiated aborts propagate untouched so query libraries can
      // recognise them as cancellations rather than failures.
      if (options.signal?.aborted) throw error
      if (timeout.aborted) {
        throw new ApiError({ status: 408, code: 'timeout', message: 'The request timed out.' })
      }
      throw new ApiError({ status: 0, code: 'network_error', message: 'Network request failed.' })
    }

    const data = await parseBody(response)
    if (!response.ok) throw toApiError(response, data)
    return { status: response.status, headers: response.headers, data: data as T }
  }

  return { request }
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined
  const text = await response.text()
  if (!text) return undefined
  const type = response.headers.get('Content-Type') ?? ''
  if (!type.includes('json')) return text
  try {
    return JSON.parse(text)
  } catch {
    throw new ApiError({
      status: response.status,
      code: 'invalid_response',
      message: 'The server sent a response that couldn’t be read.',
    })
  }
}

function toApiError(response: Response, data: unknown): ApiError {
  const envelope = (data as Partial<ErrorBody> | undefined)?.error
  const retryAfter = Number(response.headers.get('Retry-After'))
  return new ApiError({
    status: response.status,
    code: envelope?.code ?? `http_${response.status}`,
    message: envelope?.message ?? (response.statusText || `Request failed (${response.status})`),
    fields: envelope?.fields,
    retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
    requestId: response.headers.get('X-Request-Id') ?? undefined,
  })
}
