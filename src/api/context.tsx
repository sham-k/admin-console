import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { MockServer } from '../server/server'
import type { Api } from './index'

interface Environment {
  api: Api
  /** Present only when running against the stub server (enables dev tools). */
  mockServer?: MockServer
}

const EnvironmentContext = createContext<Environment | null>(null)

export function EnvironmentProvider({ value, children }: { value: Environment; children: ReactNode }) {
  return <EnvironmentContext.Provider value={value}>{children}</EnvironmentContext.Provider>
}

function useEnvironment(): Environment {
  const env = useContext(EnvironmentContext)
  if (!env) throw new Error('EnvironmentProvider is missing')
  return env
}

export function useApi(): Api {
  return useEnvironment().api
}

export function useMockServer(): MockServer | undefined {
  return useEnvironment().mockServer
}
