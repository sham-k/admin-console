import { LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT, ROLES, SORT_FIELDS, STATUSES } from '../api/types'
import type { ErrorBody, Role, SortParam, Status, UserInput } from '../api/types'
import { validateUserInput } from '../api/validation'
import { createSimulation } from './simulation'
import type { Simulation } from './simulation'
import { UserStore, etagOf, toPublic } from './store'
import type { StoredUser } from './store'

export interface MockServerOptions {
  seedCount?: number
  /** Path prefix the server answers on, e.g. `/api`. */
  basePath?: string
  simulation?: Simulation
}

export interface MockServer {
  /** A `fetch`-compatible handler: Request in, Response out. */
  fetch(request: Request): Promise<Response>
  store: UserStore
  simulation: Simulation
  /** Mimic another admin saving this user, so the 412 flow can be exercised. */
  simulateExternalEdit(id: string): StoredUser | undefined
}

const EDITABLE_FIELDS = ['first_name', 'last_name', 'email', 'role', 'status'] as const

/**
 * A stub HTTP server that speaks real `Request`/`Response` objects. It owns
 * status codes, headers (ETag, If-Match, Location, Retry-After), validation
 * and error envelopes, so the client layer is exercised exactly as it would
 * be against a deployed API.
 */
export function createMockServer(options: MockServerOptions = {}): MockServer {
  const store = new UserStore(options.seedCount ?? 500_000)
  const simulation = options.simulation ?? createSimulation({ latency: 'none', failureRate: 0 })
  const basePath = options.basePath ?? '/api'
  let requestCounter = 0

  async function handle(request: Request): Promise<Response> {
    const requestId = `req_${(++requestCounter).toString(36)}`
    await delay(simulation.latencyMs(), request.signal)
    const response = await route(request)
    response.headers.set('X-Request-Id', requestId)
    return response
  }

  async function route(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (!url.pathname.startsWith(basePath)) return error(404, 'not_found', 'No such endpoint.')
    if (simulation.shouldFail()) {
      return error(503, 'unavailable', 'The service is temporarily unavailable.', undefined, {
        'Retry-After': '2',
      })
    }

    const segments = url.pathname.slice(basePath.length).split('/').filter(Boolean)
    const method = request.method.toUpperCase()
    let response: Response

    if (segments[0] !== 'users' || segments.length > 3) {
      response = error(404, 'not_found', 'No such endpoint.')
    } else if (segments.length === 1) {
      response =
        method === 'GET' ? listUsers(url) : method === 'POST' ? await createUser(request) : notAllowed('GET, POST')
    } else if (segments.length === 2) {
      const id = decodeURIComponent(segments[1])
      response =
        method === 'GET' ? getUser(id) : method === 'PUT' ? await updateUser(id, request) : notAllowed('GET, PUT')
    } else if (segments[2] === 'password-reset') {
      response = method === 'POST' ? resetPassword(decodeURIComponent(segments[1])) : notAllowed('POST')
    } else {
      response = error(404, 'not_found', 'No such endpoint.')
    }

    return response
  }

  // --------------------------------------------------------------- routes

  function listUsers(url: URL): Response {
    const params = url.searchParams
    const skip = parseInteger(params.get('skip'), 0)
    const limit = parseInteger(params.get('limit'), LIST_DEFAULT_LIMIT)
    const fields: Record<string, string> = {}
    if (skip === null || skip < 0) fields.skip = 'skip must be a non-negative integer.'
    if (limit === null || limit < 1 || limit > LIST_MAX_LIMIT)
      fields.limit = `limit must be an integer between 1 and ${LIST_MAX_LIMIT}.`

    const role = params.get('role') || undefined
    const status = params.get('status') || undefined
    const sort = params.get('sort') || '-created_at'
    if (role && !ROLES.includes(role as Role)) fields.role = `role must be one of ${ROLES.join(', ')}.`
    if (status && !STATUSES.includes(status as Status)) fields.status = `status must be one of ${STATUSES.join(', ')}.`
    if (!SORT_FIELDS.includes(sort.replace(/^-/, '') as never))
      fields.sort = `sort must be one of ${SORT_FIELDS.join(', ')} (prefix with - for descending).`
    if (Object.keys(fields).length) return error(400, 'invalid_query', 'Invalid query parameters.', fields)

    const result = store.list({
      skip: skip!,
      limit: limit!,
      q: params.get('q') ?? undefined,
      role: role as Role | undefined,
      status: status as Status | undefined,
      sort: sort as SortParam,
    })
    return json(200, result)
  }

  function getUser(id: string): Response {
    const user = store.get(id)
    if (!user) return error(404, 'user_not_found', 'This user doesn’t exist or was removed.')
    return json(200, toPublic(user), { ETag: etagOf(user) })
  }

  async function createUser(request: Request): Promise<Response> {
    const body = await readJson(request)
    if (body instanceof Response) return body
    const invalid = checkInput(body)
    if (invalid) return invalid
    const input = pickInput(body)
    if (store.isEmailTaken(input.email)) return emailTaken()
    const user = store.create(input)
    return json(201, toPublic(user), {
      ETag: etagOf(user),
      Location: `${basePath}/users/${user.id}`,
    })
  }

  async function updateUser(id: string, request: Request): Promise<Response> {
    const current = store.get(id)
    if (!current) return error(404, 'user_not_found', 'This user doesn’t exist or was removed.')

    const ifMatch = request.headers.get('If-Match')
    if (!ifMatch) {
      return error(428, 'precondition_required', 'Updates must include an If-Match header.')
    }
    if (!etagMatches(ifMatch, etagOf(current))) {
      return error(
        412,
        'precondition_failed',
        'This user was changed by someone else since you loaded it.',
        undefined,
        { ETag: etagOf(current) },
      )
    }

    const body = await readJson(request)
    if (body instanceof Response) return body
    const invalid = checkInput(body)
    if (invalid) return invalid
    const input = pickInput(body)
    if (store.isEmailTaken(input.email, id)) return emailTaken()

    const user = store.update(id, input)
    return json(200, toPublic(user), { ETag: etagOf(user) })
  }

  function resetPassword(id: string): Response {
    const user = store.get(id)
    if (!user) return error(404, 'user_not_found', 'This user doesn’t exist or was removed.')
    if (user.status === 'suspended') {
      return error(409, 'user_suspended', 'Suspended users can’t reset their password. Reactivate them first.')
    }
    return json(202, { status: 'queued', requested_at: new Date().toISOString() })
  }

  function simulateExternalEdit(id: string) {
    const user = store.get(id)
    if (!user) return undefined
    const nextRole = ROLES[(ROLES.indexOf(user.role) + 1) % ROLES.length]
    return store.update(id, { ...user, role: nextRole })
  }

  return { fetch: handle, store, simulation, simulateExternalEdit }
}

// ---------------------------------------------------------------- helpers

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  })
}

function error(
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>,
  headers?: Record<string, string>,
): Response {
  const body: ErrorBody = { error: { code, message, ...(fields ? { fields } : {}) } }
  return json(status, body, headers)
}

function notAllowed(allow: string) {
  return error(405, 'method_not_allowed', 'Method not allowed.', undefined, { Allow: allow })
}

function emailTaken() {
  return error(409, 'email_taken', 'A user with this email already exists.', {
    email: 'A user with this email already exists.',
  })
}

async function readJson(request: Request): Promise<Record<string, unknown> | Response> {
  if (!request.headers.get('Content-Type')?.includes('application/json')) {
    return error(415, 'unsupported_media_type', 'Send the request body as application/json.')
  }
  try {
    const body = await request.json()
    if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new Error()
    return body as Record<string, unknown>
  } catch {
    return error(400, 'invalid_json', 'The request body must be a JSON object.')
  }
}

function checkInput(body: Record<string, unknown>): Response | null {
  const fields = validateUserInput(body)
  return Object.keys(fields).length
    ? error(422, 'validation_failed', 'Some fields need attention.', fields as Record<string, string>)
    : null
}

function pickInput(body: Record<string, unknown>): UserInput {
  return Object.fromEntries(EDITABLE_FIELDS.map((field) => [field, body[field]])) as unknown as UserInput
}

/** RFC 9110 If-Match: `*` or a comma-separated list of strong ETags. */
function etagMatches(header: string, current: string): boolean {
  return header
    .split(',')
    .map((tag) => tag.trim())
    .some((tag) => tag === '*' || tag === current)
}

function parseInteger(raw: string | null, fallback: number): number | null {
  if (raw === null || raw === '') return fallback
  return /^\d+$/.test(raw) ? Number(raw) : null
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
    if (ms <= 0) return resolve()
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    function onAbort() {
      clearTimeout(timer)
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}
