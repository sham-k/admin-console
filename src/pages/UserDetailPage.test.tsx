import { screen, waitFor, within } from '@testing-library/react'
import { createTestServer, renderApp } from '../test/renderApp'

async function openFirstUser() {
  const server = createTestServer()
  const [first] = server.store.list({ skip: 0, limit: 1, sort: '-created_at' }).items
  const utils = renderApp(`/users/${first.id}`, server)
  await screen.findByRole('heading', { level: 1, name: `${first.first_name} ${first.last_name}` })
  return { ...utils, first }
}

describe('User details', () => {
  it('saves edits with If-Match and confirms', async () => {
    const { user, server, first } = await openFirstUser()
    const lastName = screen.getByLabelText('Last name')
    await user.clear(lastName)
    await user.type(lastName, 'Updated')
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Changes saved.')).toBeInTheDocument()
    expect(server.store.get(first.id)?.last_name).toBe('Updated')
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
  })

  it('handles a 412 by showing a diff and merging on request', async () => {
    const { user, server, first } = await openFirstUser()
    const lastName = screen.getByLabelText('Last name')
    await user.clear(lastName)
    await user.type(lastName, 'Mine')

    const theirs = server.simulateExternalEdit(first.id)! // another admin changes the role
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    const dialog = await screen.findByRole('alertdialog', { name: 'Your changes weren’t saved' })
    await within(dialog).findByRole('table')
    expect(within(dialog).getByRole('rowheader', { name: /Role/ })).toBeInTheDocument()
    expect(within(dialog).getByRole('rowheader', { name: /Last name/ })).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Review merged version' }))
    expect(screen.getByLabelText('Last name')).toHaveValue('Mine')
    expect(screen.getByRole('radio', { name: new RegExp(theirs.role) })).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByText('Changes saved.')
    expect(server.store.get(first.id)).toMatchObject({ last_name: 'Mine', role: theirs.role })
  })

  it('can discard local edits in favour of the latest version after a 412', async () => {
    const { user, server, first } = await openFirstUser()
    await user.type(screen.getByLabelText('First name'), 'X')
    server.simulateExternalEdit(first.id)
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    const dialog = await screen.findByRole('alertdialog')
    await within(dialog).findByRole('table')
    await user.click(within(dialog).getByRole('button', { name: 'Discard my changes' }))
    expect(screen.getByLabelText('First name')).toHaveValue(first.first_name)
    await waitFor(() => expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument())
  })

  it('maps server field errors onto the form', async () => {
    const { user, server } = await openFirstUser()
    const other = server.store.list({ skip: 1, limit: 1, sort: '-created_at' }).items[0]
    const email = screen.getByLabelText('Email')
    await user.clear(email)
    await user.type(email, other.email)
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('A user with this email already exists.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Email')).toHaveFocus()
  })

  it('shows a not-found state for unknown ids', async () => {
    renderApp('/users/usr_zzzzzz')
    expect(await screen.findByRole('heading', { level: 1, name: 'User not found' })).toBeInTheDocument()
  })

  it('sends a password reset after confirmation', async () => {
    const { user, first } = await openFirstUser()
    if (first.status === 'suspended') return // seed-dependent; covered in API tests
    await user.click(screen.getByRole('button', { name: /Send password reset/ }))
    const confirm = await screen.findByRole('alertdialog')
    await user.click(within(confirm).getByRole('button', { name: 'Send reset email' }))
    expect(await screen.findByText(`Password reset email sent to ${first.email}.`)).toBeInTheDocument()
  })
})
