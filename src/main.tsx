import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { createApi } from './api'
import { createMockServer } from './server/server'
import { createSimulation } from './server/simulation'
import './styles.css'

// No backend exists, so the API client talks to an in-memory server through a
// fetch-shaped transport. Swap in `fetch` and a real origin to go live.
const mockServer = createMockServer({
  seedCount: 500_000,
  basePath: '/api',
  simulation: createSimulation({ latency: 'realistic', failureRate: 0 }),
})
const api = createApi(`${window.location.origin}/api`, (request) => mockServer.fetch(request))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App api={api} mockServer={mockServer} />
  </StrictMode>,
)
