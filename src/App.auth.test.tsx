import { describe, expect, it, vi } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App auth', () => {
  it('shows sign in for unauthenticated users', async () => {
    h.clearAuthSessionForTests()
    h.mockFetch(
      h.jsonResponse({
        isAuthenticated: false,
        bootstrapRequired: false,
        email: null,
        roles: [],
      }),
    )

    h.render(<h.App />)

    expect(
      await h.screen.findByRole('form', { name: 'Sign in' }),
    ).toBeInTheDocument()
  })

  it('shows bootstrap setup for first user state', async () => {
    h.clearAuthSessionForTests()
    h.mockFetch(
      h.jsonResponse({
        isAuthenticated: false,
        bootstrapRequired: true,
        email: null,
        roles: [],
      }),
    )

    h.render(<h.App />)

    expect(
      await h.screen.findByRole('form', { name: 'Bootstrap setup' }),
    ).toBeInTheDocument()
  })

  it('logs out back to sign in', async () => {
    h.clearAuthSessionForTests()
    const fetchMock = h.mockFetch(
      h.jsonResponse({
        isAuthenticated: true,
        bootstrapRequired: false,
        email: 'collector@cratebase.local',
        roles: ['Admin'],
      }),
      new Response(null, { status: 204 }),
    )
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(await h.screen.findByRole('button', { name: 'Log out' }))

    expect(
      await h.screen.findByRole('form', { name: 'Sign in' }),
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/auth/logout', {
      body: JSON.stringify({}),
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })
  })

  it('surfaces logout failures in the authenticated shell', async () => {
    h.clearAuthSessionForTests()
    h.mockFetch(
      h.jsonResponse({
        isAuthenticated: true,
        bootstrapRequired: false,
        email: 'logout-error@cratebase.local',
        roles: ['Admin'],
      }),
      h.jsonResponse(
        { code: 'auth.logout_failed', message: 'Logout failed' },
        500,
      ),
    )
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(await h.screen.findByRole('button', { name: 'Log out' }))

    expect(await h.screen.findByRole('alert')).toHaveTextContent(
      'Log out failed. Try again.',
    )
    expect(h.screen.getByRole('link', { name: 'Catalog' })).toBeInTheDocument()
  })

  it('enters the app shell after successful login', async () => {
    h.clearAuthSessionForTests()
    const fetchMock = h.mockFetch(
      h.jsonResponse({
        isAuthenticated: false,
        bootstrapRequired: false,
        email: null,
        roles: [],
      }),
      h.jsonResponse({
        isAuthenticated: true,
        email: 'collector@cratebase.local',
        roles: ['Admin'],
      }),
    )
    const user = h.userEvent.setup()
    h.render(<h.App />)

    const form = await h.screen.findByRole('form', { name: 'Sign in' })
    await user.type(
      h.within(form).getByLabelText('Email'),
      'collector@cratebase.local',
    )
    await user.type(h.within(form).getByLabelText('Password'), 'Password1!')
    await user.click(h.within(form).getByRole('button', { name: 'Sign in' }))

    expect(
      await h.screen.findByRole('heading', { name: 'Catalog' }),
    ).toBeInTheDocument()
    expect(h.screen.getByText('collector@cratebase.local')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/auth/login', {
      body: JSON.stringify({
        email: 'collector@cratebase.local',
        password: 'Password1!',
      }),
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })
  })

  it('shows an accessible error after invalid login', async () => {
    h.clearAuthSessionForTests()
    h.mockFetch(
      h.jsonResponse({
        isAuthenticated: false,
        bootstrapRequired: false,
        email: null,
        roles: [],
      }),
      h.jsonResponse(
        { code: 'auth.invalid_credentials', message: 'Invalid credentials' },
        401,
      ),
    )
    const user = h.userEvent.setup()
    h.render(<h.App />)

    const form = await h.screen.findByRole('form', { name: 'Sign in' })
    await user.type(
      h.within(form).getByLabelText('Email'),
      'collector@cratebase.local',
    )
    await user.type(h.within(form).getByLabelText('Password'), 'wrong')
    await user.click(h.within(form).getByRole('button', { name: 'Sign in' }))

    expect(await h.screen.findByRole('alert')).toHaveTextContent(
      'Email or password is incorrect.',
    )
  })

  it('shows an accessible error after disabled login', async () => {
    h.clearAuthSessionForTests()
    h.mockFetch(
      h.jsonResponse({
        isAuthenticated: false,
        bootstrapRequired: false,
        email: null,
        roles: [],
      }),
      h.jsonResponse(
        { code: 'auth.user_disabled', message: 'User account is disabled' },
        401,
      ),
    )
    const user = h.userEvent.setup()
    h.render(<h.App />)

    const form = await h.screen.findByRole('form', { name: 'Sign in' })
    await user.type(
      h.within(form).getByLabelText('Email'),
      'disabled@cratebase.local',
    )
    await user.type(h.within(form).getByLabelText('Password'), 'Password1!')
    await user.click(h.within(form).getByRole('button', { name: 'Sign in' }))

    expect(await h.screen.findByRole('alert')).toHaveTextContent(
      'This account is disabled.',
    )
  })

  it('resets pending state and shows an error after network login failure', async () => {
    h.clearAuthSessionForTests()
    h.mockFetch(
      h.jsonResponse({
        isAuthenticated: false,
        bootstrapRequired: false,
        email: null,
        roles: [],
      }),
      new TypeError('Network unavailable'),
    )
    const user = h.userEvent.setup()
    h.render(<h.App />)

    const form = await h.screen.findByRole('form', { name: 'Sign in' })
    await user.type(
      h.within(form).getByLabelText('Email'),
      'collector@cratebase.local',
    )
    await user.type(h.within(form).getByLabelText('Password'), 'Password1!')
    await user.click(h.within(form).getByRole('button', { name: 'Sign in' }))

    expect(await h.screen.findByRole('alert')).toHaveTextContent(
      'Server unavailable. Check connection and retry.',
    )
    expect(
      h.within(form).getByRole('button', { name: 'Sign in' }),
    ).toBeEnabled()
  })

  it('shows retryable catalog API error when initial catalog loading fails', async () => {
    h.clearCatalogForTests()
    vi.stubGlobal(
      'fetch',
      vi
        .fn<Window['fetch']>()
        .mockImplementation(() =>
          Promise.resolve(
            h.jsonResponse(
              { code: 'catalog.server_error', message: 'Catalog unavailable' },
              500,
            ),
          ),
        ),
    )

    h.render(<h.App />)

    expect(
      await h.screen.findByRole('heading', { name: 'Catalog unavailable' }),
    ).toBeInTheDocument()
    expect(h.screen.getByRole('alert')).toHaveTextContent(
      'Catalog request failed. Try again.',
    )
    expect(h.screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
  })

  it('returns to sign in when a catalog mutation expires the session', async () => {
    h.clearCatalogForTests()
    window.history.pushState({}, '', '/artists')
    h.mockFetch(
      ...h.emptyCatalogLoadResponses(),
      h.jsonResponse(
        { code: 'auth.unauthenticated', message: 'Session expired' },
        401,
      ),
      new Response(null, { status: 204 }),
    )
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(
      await h.screen.findByRole('button', { name: 'Add artist' }),
    )
    const form = h.screen.getByRole('form', { name: 'Add artist' })
    await user.type(h.within(form).getByLabelText('Name'), 'Expired Session')
    await user.click(h.within(form).getByRole('button', { name: 'Add record' }))

    expect(
      await h.screen.findByRole('form', { name: 'Sign in' }),
    ).toBeInTheDocument()
  })

  it('keeps the loaded workspace available when a catalog refresh fails after a mutation', async () => {
    h.clearCatalogForTests()
    window.history.pushState({}, '', '/artists')
    h.mockFetch(
      ...h.emptyCatalogLoadResponses(),
      h.jsonResponse({
        id: '00000000-0000-7000-8000-000000000010',
        type: 'person',
        name: 'Refresh Failure Artist',
      }),
      h.jsonResponse(
        { code: 'catalog.server_error', message: 'Catalog refresh failed' },
        500,
      ),
      ...h.emptyCatalogLoadResponses().slice(1),
      ...h.emptyCatalogLoadResponses(),
    )
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(
      await h.screen.findByRole('button', { name: 'Add artist' }),
    )
    const form = h.screen.getByRole('form', { name: 'Add artist' })
    await user.type(
      h.within(form).getByLabelText('Name'),
      'Refresh Failure Artist',
    )
    await user.click(h.within(form).getByRole('button', { name: 'Add record' }))

    expect(await h.screen.findByRole('alert')).toHaveTextContent(
      'Catalog request failed. Try again.',
    )
    expect(
      h.screen.getByRole('heading', { name: 'Artists' }),
    ).toBeInTheDocument()

    await user.click(h.screen.getByRole('link', { name: 'Tracks' }))

    expect(
      h.screen.getByRole('heading', { name: 'Tracks' }),
    ).toBeInTheDocument()

    await user.click(
      h.screen.getByRole('button', { name: 'Retry catalog sync' }),
    )

    expect(
      await h.screen.findByRole('heading', { name: 'Tracks' }),
    ).toBeInTheDocument()
    expect(h.screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('maps bootstrap unavailable to the bootstrap form error', async () => {
    h.clearAuthSessionForTests()
    h.mockFetch(
      h.jsonResponse({
        isAuthenticated: false,
        bootstrapRequired: true,
        email: null,
        roles: [],
      }),
      h.jsonResponse(
        {
          code: 'auth.registration_closed',
          message: 'Public registration is closed',
        },
        409,
      ),
    )
    const user = h.userEvent.setup()
    h.render(<h.App />)

    const form = await h.screen.findByRole('form', { name: 'Bootstrap setup' })
    await user.type(
      h.within(form).getByLabelText('Email'),
      'owner@cratebase.local',
    )
    await user.type(h.within(form).getByLabelText('Password'), 'Password1!')
    await user.type(
      h.within(form).getByLabelText('Confirm password'),
      'Password1!',
    )
    await user.click(
      h.within(form).getByRole('button', { name: 'Create admin' }),
    )

    expect(await h.screen.findByRole('alert')).toHaveTextContent(
      'Bootstrap setup is not available.',
    )
  })
})
