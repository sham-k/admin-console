/**
 * Knobs for the stub server, exposed in the UI's "Simulation" panel so a
 * reviewer can see loading, error and retry states on demand.
 */
export type LatencyProfile = 'none' | 'fast' | 'realistic' | 'slow'

export interface SimulationSettings {
  latency: LatencyProfile
  /** 0–1 probability that a request fails with a 503. */
  failureRate: number
}

export const LATENCY_RANGES: Record<LatencyProfile, [number, number]> = {
  none: [0, 0],
  fast: [40, 120],
  realistic: [250, 700],
  slow: [1500, 3000],
}

type Listener = () => void

export function createSimulation(initial: SimulationSettings) {
  let settings = initial
  const listeners = new Set<Listener>()
  return {
    get: () => settings,
    set(patch: Partial<SimulationSettings>) {
      settings = { ...settings, ...patch }
      listeners.forEach((listener) => listener())
    },
    subscribe(listener: Listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    latencyMs() {
      const [min, max] = LATENCY_RANGES[settings.latency]
      return min + Math.random() * (max - min)
    },
    shouldFail() {
      return Math.random() < settings.failureRate
    },
  }
}

export type Simulation = ReturnType<typeof createSimulation>
