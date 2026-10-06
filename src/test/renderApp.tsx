import { QueryClient } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'
import { createApi } from '../api'
import { createMockServer } from '../server/server'
import { createSimulation } from '../server/simulation'

export const TEST_ORIGIN = 'http://localhost'

/** A small, zero-latency server per test so tests are fast and isolated. */
export function createTestServer(seedCount = 60) {
  return createMockServer({ seedCount, simulation: createSimulation({ latency: 'none', failureRate: 0 }) })
}

export function renderApp(url: string, server = createTestServer()) {
  const api = createApi(`${TEST_ORIGIN}/api`, (request) => server.fetch(request))
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false }, mutations: { retry: false } },
  })
  const user = userEvent.setup()
  const utils = render(<App api={api} mockServer={server} queryClient={queryClient} initialUrl={url} />)
  return { ...utils, user, server, api }
}
