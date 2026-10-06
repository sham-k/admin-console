import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { RouterProvider, createBrowserRouter, createMemoryRouter } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import { EnvironmentProvider } from './api/context'
import type { Api } from './api'
import { isApiError } from './api/errors'
import { Layout } from './components/Layout'
import { LandingPage } from './pages/LandingPage'
import { NotFoundPage, PlaceholderPage, RouteError } from './pages/PlaceholderPage'
import { UserDetailPage } from './pages/UserDetailPage'
import { UsersPage } from './pages/UsersPage'
import type { MockServer } from './server/server'

export const routes: RouteObject[] = [
  // Public welcome page: full-screen, outside the console's top bar.
  { path: '/', element: <LandingPage />, errorElement: <RouteError /> },
  {
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { path: 'users', element: <UsersPage /> },
      { path: 'users/:userId', element: <UserDetailPage /> },
      { path: 'dashboard', element: <PlaceholderPage title="Dashboard" /> },
      { path: 'teams', element: <PlaceholderPage title="Teams" /> },
      { path: 'audit-log', element: <PlaceholderPage title="Audit log" /> },
      { path: 'settings', element: <PlaceholderPage title="Settings" /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Retry transient failures (network, 5xx) with backoff; never retry 4xx.
        retry: (failureCount, error) => failureCount < 2 && (!isApiError(error) || error.isRetryable),
        retryDelay: (attempt, error) =>
          isApiError(error) && error.retryAfterSeconds ? error.retryAfterSeconds * 1000 : 500 * 2 ** attempt,
        refetchOnWindowFocus: true,
      },
      // Writes are never retried automatically: a timed-out POST may have succeeded.
      mutations: { retry: false },
    },
  })
}

interface AppProps {
  api: Api
  mockServer?: MockServer
  queryClient?: QueryClient
  /** Tests render with an in-memory router at a given URL. */
  initialUrl?: string
}

export function App({ api, mockServer, queryClient, initialUrl }: AppProps) {
  const [client] = useState(() => queryClient ?? createQueryClient())
  const [router] = useState(() =>
    initialUrl ? createMemoryRouter(routes, { initialEntries: [initialUrl] }) : createBrowserRouter(routes),
  )
  return (
    <EnvironmentProvider value={{ api, mockServer }}>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </EnvironmentProvider>
  )
}
