import { createTestServer, TEST_ORIGIN } from '../test/renderApp'
import { createApi } from './index'
import { ApiError } from './errors'
import { createHttpClient } from './http'
import type { UserInput } from './types'

function setup(seedCount = 200) {
  const server = createTestServer(seedCount)
  const transport = (request: Request) => server.fetch(request)
  return {
    server,
    api: createApi(`${TEST_ORIGIN}/api`, transport),
    http: createHttpClient(`${TEST_ORIGIN}/api`, transport),
  }
}

const newUser: UserInput = {
  first_name: 'Grace',
  last_name: 'Hopper',
  email: 'grace@example.com',
  role: 'Admin',
  status: 'invited',
}

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof ApiError) return error
    throw error
  }
  throw new Error('Expected the request to fail')
}

describe('GET /users', () => {
  it('paginates with contract defaults (skip 0, limit 25)', async () => {
    const { api } = setup()
    const page = await api.users.list({})
    expect(page.total).toBe(200)
    expect(page.items).toHaveLength(25)
  })

  it('honours skip and limit and never overlaps pages', async () => {
    const { api } = setup()
    const first = await api.users.list({ skip: 0, limit: 10 })
    const second = await api.users.list({ skip: 10, limit: 10 })
    const ids = new Set([...first.items, ...second.items].map((u) => u.id))
    expect(ids.size).toBe(20)
  })

  it('returns an empty page past the end, with the real total', async () => {
    const { api } = setup()
    const page = await api.users.list({ skip: 500, limit: 10 })
    expect(page).toEqual({ items: [], total: 200 })
  })

  it('rejects limit above 100 with a 400 and a field message', async () => {
    const { api } = setup()
    const error = await rejection(api.users.list({ limit: 101 }))
    expect(error.status).toBe(400)
    expect(error.fields.limit).toMatch(/between 1 and 100/)
  })

  it('filters by search, role and status together', async () => {
    const { api } = setup(2_000)
    const page = await api.users.list({ q: 'a', role: 'Admin', status: 'active', limit: 100 })
    expect(page.total).toBeGreaterThan(0)
    for (const user of page.items) {
      expect(user.role).toBe('Admin')
      expect(user.status).toBe('active')
      expect(`${user.first_name} ${user.last_name} ${user.email}`.toLowerCase()).toContain('a')
    }
  })

  it('sorts by name', async () => {
    const { api } = setup()
    const { items } = await api.users.list({ sort: 'name', limit: 100 })
    const keys = items.map((u) => `${u.last_name}\u0000${u.first_name}`.toLowerCase())
    expect(keys).toEqual([...keys].sort())
  })
})

describe('GET /users/:id', () => {
  it('returns the user with an ETag', async () => {
    const { api } = setup()
    const [first] = (await api.users.list({ limit: 1 })).items
    const result = await api.users.get(first.id)
    expect(result.data).toEqual(first)
    expect(result.etag).toMatch(/^".+"$/)
  })

  it('404s for an unknown user', async () => {
    const { api } = setup()
    const error = await rejection(api.users.get('usr_zzzzzz'))
    expect(error.status).toBe(404)
    expect(error.code).toBe('user_not_found')
  })
})

describe('POST /users', () => {
  it('creates a user, returns its ETag, and it appears first in the default list', async () => {
    const { api } = setup()
    const created = await api.users.create(newUser)
    expect(created.data).toMatchObject(newUser)
    expect(created.etag).toBeTruthy()
    const page = await api.users.list({ limit: 1 })
    expect(page.total).toBe(201)
    expect(page.items[0].id).toBe(created.data.id)
  })

  it('rejects duplicate emails case-insensitively with a 409 on the email field', async () => {
    const { api } = setup()
    const [existing] = (await api.users.list({ limit: 1 })).items
    const error = await rejection(api.users.create({ ...newUser, email: existing.email.toUpperCase() }))
    expect(error.status).toBe(409)
    expect(error.fields.email).toBeDefined()
  })

  it('validates input with a 422 and per-field messages', async () => {
    const { api } = setup()
    const error = await rejection(api.users.create({ ...newUser, first_name: ' ', email: 'nope' }))
    expect(error.status).toBe(422)
    expect(Object.keys(error.fields).sort()).toEqual(['email', 'first_name'])
  })
})

describe('PUT /users/:id (optimistic concurrency)', () => {
  it('succeeds with the current ETag and returns a new one', async () => {
    const { api } = setup()
    const created = await api.users.create(newUser)
    const updated = await api.users.update(created.data.id, { ...newUser, role: 'Viewer' }, created.etag)
    expect(updated.data.role).toBe('Viewer')
    expect(updated.etag).not.toBe(created.etag)
  })

  it('returns 412 when the ETag is stale, and does not apply the write', async () => {
    const { api, server } = setup()
    const created = await api.users.create(newUser)
    server.simulateExternalEdit(created.data.id) // someone else saves first

    const error = await rejection(api.users.update(created.data.id, { ...newUser, last_name: 'Mine' }, created.etag))
    expect(error.status).toBe(412)
    expect((await api.users.get(created.data.id)).data.last_name).toBe('Hopper')
  })

  it('requires If-Match (428)', async () => {
    const { api, http } = setup()
    const created = await api.users.create(newUser)
    const error = await rejection(http.request('PUT', `/users/${created.data.id}`, { body: newUser }))
    expect(error.status).toBe(428)
  })

  it('allows keeping your own email but not taking someone else’s', async () => {
    const { api } = setup()
    const a = await api.users.create(newUser)
    const b = await api.users.create({ ...newUser, email: 'other@example.com' })
    await expect(api.users.update(a.data.id, { ...newUser, first_name: 'G' }, a.etag)).resolves.toBeTruthy()
    const error = await rejection(api.users.update(b.data.id, { ...newUser }, b.etag))
    expect(error.status).toBe(409)
  })
})

describe('POST /users/:id/password-reset', () => {
  it('accepts without If-Match', async () => {
    const { api } = setup()
    const created = await api.users.create({ ...newUser, status: 'active' })
    await expect(api.users.resetPassword(created.data.id)).resolves.toMatchObject({ status: 'queued' })
  })

  it('refuses for suspended users', async () => {
    const { api } = setup()
    const created = await api.users.create(newUser)
    await api.users.update(created.data.id, { ...newUser, status: 'suspended' }, created.etag)
    const error = await rejection(api.users.resetPassword(created.data.id))
    expect(error.status).toBe(409)
  })
})

describe('transport behaviour', () => {
  it('surfaces 5xx as retryable ApiErrors carrying Retry-After and a request id', async () => {
    const { api, server } = setup()
    server.simulation.set({ failureRate: 1 })
    const error = await rejection(api.users.list({}))
    expect(error.status).toBe(503)
    expect(error.isRetryable).toBe(true)
    expect(error.retryAfterSeconds).toBe(2)
    expect(error.requestId).toMatch(/^req_/)
  })

  it('propagates caller aborts as AbortError, not ApiError', async () => {
    const { api, server } = setup()
    server.simulation.set({ latency: 'slow' })
    const controller = new AbortController()
    const pending = api.users.list({}, controller.signal)
    controller.abort()
    await expect(pending).rejects.toSatisfy((e: unknown) => !(e instanceof ApiError))
  })

  it('maps transport failures to a network ApiError', async () => {
    const api = createApi(`${TEST_ORIGIN}/api`, () => Promise.reject(new TypeError('Failed to fetch')))
    const error = await rejection(api.users.list({}))
    expect(error.status).toBe(0)
    expect(error.code).toBe('network_error')
  })
})
