import { screen, within } from '@testing-library/react'
import axe from 'axe-core'
import { createTestServer, renderApp } from './renderApp'

// Automated WCAG 2.x A/AA checks on key screens. jsdom can't compute colour
// contrast, so that rule is verified manually (tokens in styles.css) instead.
async function expectNoViolations(root: Element = document.body) {
  const results = await axe.run(root, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    rules: { 'color-contrast': { enabled: false } },
  })
  const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
  expect(summary).toEqual([])
}

describe('accessibility', () => {
  it('users list has no detectable violations', async () => {
    renderApp('/users')
    await screen.findByText(/Showing 1–25/)
    await expectNoViolations()
  })

  it('add-user dialog with validation errors has no detectable violations', async () => {
    const { user } = renderApp('/users')
    await screen.findByText(/Showing 1–25/)
    await user.click(screen.getByRole('button', { name: 'Add user' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add user' })
    await user.click(within(dialog).getByRole('button', { name: 'Add user' }))
    await expectNoViolations(dialog)
  })

  it('user details has no detectable violations', async () => {
    const server = createTestServer()
    const [first] = server.store.list({ skip: 0, limit: 1, sort: '-created_at' }).items
    renderApp(`/users/${first.id}`, server)
    await screen.findByRole('heading', { level: 1, name: `${first.first_name} ${first.last_name}` })
    await expectNoViolations()
  })
})
