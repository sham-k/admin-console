export interface ApiErrorInit {
  status: number
  code: string
  message: string
  fields?: Record<string, string>
  retryAfterSeconds?: number
  requestId?: string
}

/**
 * Every failure that comes out of the API layer is an ApiError, so UI code can
 * branch on `status`/`code` without caring whether the failure came from the
 * network, the server, or response parsing.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fields: Record<string, string>
  readonly retryAfterSeconds?: number
  readonly requestId?: string

  constructor(init: ApiErrorInit) {
    super(init.message)
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code
    this.fields = init.fields ?? {}
    this.retryAfterSeconds = init.retryAfterSeconds
    this.requestId = init.requestId
  }

  /** Network failure, timeout, or 5xx: safe to retry an idempotent request. */
  get isRetryable(): boolean {
    return this.status === 0 || this.status === 408 || this.status === 429 || this.status >= 500
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

/** A human-readable message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.status === 0) return 'Can’t reach the server. Check your connection and try again.'
    if (error.status >= 500) return 'The server ran into a problem. Please try again.'
    return error.message
  }
  if (error instanceof Error) return error.message
  return 'Something went wrong.'
}
