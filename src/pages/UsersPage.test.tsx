import { screen, waitFor, within } from '@testing-library/react'
import { createTestServer, renderApp } from '../test/renderApp'

describe('Users page', () => {
  it('is reachable from the top navigation and marks it current', async () => {
    const { user } = renderApp('/dashboard')
    const nav = screen.getByRole('navigation', { name: 'Main' })
    await user.click(within(nav).getByRole('link', { name: 'Users' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Users' })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: 'Users' })).toHaveAttribute('aria-current', 'page')
  })

  it('shows one page at a time with an accurate range', async () => {
    renderApp('/users', createTestServer(60))
    expect(await screen.findByText('Showing 1–25 of 60 users')).toBeInTheDocument()
    const rows = within(screen.getByRole('table')).getAllByRole('row')
    expect(rows).toHaveLength(26) // header + 25
  })

  it('pages forward and reflects the page in the URL-driven controls', async () => {
    const { user } = renderApp('/users', createTestServer(60))
    await screen.findByText('Showing 1–25 of 60 users')
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(await screen.findByText('Showing 26–50 of 60 users')).toBeInTheDocument()
    expect(screen.getByLabelText('Page')).toHaveValue('2')
  })

  it('searches (debounced) and shows an empty state with a way out', async () => {
    const { user } = renderApp('/users')
    await screen.findByText(/Showing 1–25/)
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'zzzz-nobody')
    expect(await screen.findByRole('heading', { name: 'No users match your filters' })).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: /Clear filters/ })[0])
    expect(await screen.findByText(/Showing 1–25/)).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('')
  })

  it('exposes sort state on column headers', async () => {
    const { user } = renderApp('/users')
    await screen.findByText(/Showing 1–25/)
    const nameHeader = screen.getByRole('columnheader', { name: /User/ })
    expect(nameHeader).not.toHaveAttribute('aria-sort')
    await user.click(within(nameHeader).getByRole('button'))
    await waitFor(() => expect(nameHeader).toHaveAttribute('aria-sort', 'ascending'))
  })

  it('shows an error state with retry when the API fails', async () => {
    const server = createTestServer()
    server.simulation.set({ failureRate: 1 })
    const { user } = renderApp('/users', server)
    expect(await screen.findByRole('heading', { name: 'Couldn’t load users' })).toBeInTheDocument()

    server.simulation.set({ failureRate: 0 })
    await user.click(screen.getByRole('button', { name: /Try again/ }))
    expect(await screen.findByText(/Showing 1–25/)).toBeInTheDocument()
  })

  it('creates a user, validating first, and lists them at the top', async () => {
    const { user } = renderApp('/users')
    await screen.findByText(/Showing 1–25/)
    await user.click(screen.getByRole('button', { name: 'Add user' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add user' })

    await user.click(within(dialog).getByRole('button', { name: 'Add user' }))
    expect(within(dialog).getByText('First name is required.')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('First name')).toHaveFocus()

    await user.type(within(dialog).getByLabelText('First name'), 'Grace')
    await user.type(within(dialog).getByLabelText('Last name'), 'Hopper')
    await user.type(within(dialog).getByLabelText('Email'), 'grace@example.com')
    await user.click(within(dialog).getByRole('radio', { name: /Admin/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Add user' }))

    expect(await screen.findByText('Grace Hopper was added and invited.')).toBeInTheDocument()
    const firstRow = (await screen.findAllByRole('row'))[1]
    await waitFor(() => expect(within(firstRow).getByRole('link', { name: 'Grace Hopper' })).toBeInTheDocument())
  })
})
