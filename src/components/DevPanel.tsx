import { useSyncExternalStore } from 'react'
import { useMatch } from 'react-router-dom'
import type { MockServer } from '../server/server'
import type { LatencyProfile } from '../server/simulation'
import { formatNumber } from '../lib/format'
import { Dialog } from './Dialog'
import { useToast } from './Toast'

const LATENCY_OPTIONS: { value: LatencyProfile; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'fast', label: 'Fast (~100 ms)' },
  { value: 'realistic', label: 'Realistic (250–700 ms)' },
  { value: 'slow', label: 'Slow (1.5–3 s)' },
]

const FAILURE_OPTIONS = [
  { value: 0, label: 'Never' },
  { value: 0.1, label: '10% of requests' },
  { value: 0.3, label: '30% of requests' },
  { value: 1, label: 'Every request' },
]

/**
 * Reviewer tooling for the stub server: dial in latency and failures to see
 * loading/error states, and fake a concurrent edit to trigger a 412.
 */
export function DevPanel({ open, onClose, server }: { open: boolean; onClose: () => void; server: MockServer }) {
  const { simulation } = server
  const settings = useSyncExternalStore(simulation.subscribe, simulation.get)
  const userMatch = useMatch('/users/:userId')
  const toast = useToast()

  const simulateEdit = () => {
    const userId = userMatch?.params.userId
    if (!userId) return
    const updated = server.simulateExternalEdit(userId)
    if (!updated) return toast.error('That user doesn’t exist on the server.')
    toast.info(`Another admin changed this user’s role to ${updated.role}. Save your edits to see the conflict.`)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Simulation"
      description={
        <p>
          The API is served by an in-memory stub with {formatNumber(server.store.total)} users. These settings change
          how it behaves.
        </p>
      }
      footer={
        <button type="button" className="button button--primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <fieldset className="field">
        <legend className="field__label">Network latency</legend>
        <div className="radio-list">
          {LATENCY_OPTIONS.map((option) => (
            <label key={option.value} className="radio">
              <input
                type="radio"
                name="latency"
                checked={settings.latency === option.value}
                onChange={() => simulation.set({ latency: option.value })}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend className="field__label">Fail with 503 Service Unavailable</legend>
        <div className="radio-list">
          {FAILURE_OPTIONS.map((option) => (
            <label key={option.value} className="radio">
              <input
                type="radio"
                name="failure"
                checked={settings.failureRate === option.value}
                onChange={() => simulation.set({ failureRate: option.value })}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <p className="field__label" id="concurrent-label">
          Concurrent edit
        </p>
        <p className="field__hint" id="concurrent-hint">
          {userMatch
            ? 'Changes this user’s role on the server, as if another admin saved it. Then edit and save here to get a 412 Precondition Failed.'
            : 'Open a user’s details page to use this.'}
        </p>
        <button
          type="button"
          className="button button--secondary"
          onClick={simulateEdit}
          disabled={!userMatch}
          aria-describedby="concurrent-hint"
        >
          Simulate another admin editing this user
        </button>
      </div>
    </Dialog>
  )
}
