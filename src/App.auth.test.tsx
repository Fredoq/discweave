import { describe, expect, it } from 'vitest'
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
    expect(
      h.screen.getByText(
        /Invited private beta users sign in with the credentials issued for their collection/i,
      ),
    ).toBeVisible()
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
    expect(
      h.screen.getByText(
        /Bootstrap creates the first admin account and its default private collection/i,
      ),
    ).toBeVisible()
  })

  it('logs out back to sign in', async () => {
    h.clearAuthSessionForTests()
    const fetchMock = h.mockFetch(
      h.jsonResponse({
        isAuthenticated: true,
        bootstrapRequired: false,
        email: 'collector@discweave.local',
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
        email: 'logout-error@discweave.local',
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
        email: 'collector@discweave.local',
        roles: ['Admin'],
      }),
    )
    const user = h.userEvent.setup()
    h.render(<h.App />)

    const form = await h.screen.findByRole('form', { name: 'Sign in' })
    await user.type(
      h.within(form).getByLabelText('Email'),
      'collector@discweave.local',
    )
    await user.type(h.within(form).getByLabelText('Password'), 'Password1!')
    await user.click(h.within(form).getByRole('button', { name: 'Sign in' }))

    expect(
      await h.screen.findByRole('heading', { name: 'Catalog' }),
    ).toBeInTheDocument()
    expect(h.screen.getByText('collector@discweave.local')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/auth/login', {
      body: JSON.stringify({
        email: 'collector@discweave.local',
        password: 'Password1!',
      }),
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })
  })

  it('opens the server-backed catalog after login without full catalog hydration', async () => {
    h.clearCatalogForTests()
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
        email: 'collector@discweave.local',
        roles: ['Admin'],
      }),
      h.emptySearchResponse(),
    )
    const user = h.userEvent.setup()
    h.render(<h.App />)

    const form = await h.screen.findByRole('form', { name: 'Sign in' })
    await user.type(
      h.within(form).getByLabelText('Email'),
      'collector@discweave.local',
    )
    await user.type(h.within(form).getByLabelText('Password'), 'Password1!')
    await user.click(h.within(form).getByRole('button', { name: 'Sign in' }))

    expect(
      await h.screen.findByRole('heading', { name: 'Catalog' }),
    ).toBeInTheDocument()
    await h.waitFor(() => {
      expect(fetchMock.mock.calls.length).toBe(3)
    })
    expect(
      fetchMock.mock.calls.map(([input]) =>
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url,
      ),
    ).toEqual([
      '/api/auth/session',
      '/api/auth/login',
      '/api/search?savedView=all&limit=100&offset=0',
    ])
  })

  it('opens artist records after login through server search without full catalog hydration', async () => {
    h.clearCatalogForTests()
    h.clearAuthSessionForTests()
    window.history.pushState({}, '', '/artists')
    const fetchMock = h.mockFetch(
      h.jsonResponse({
        isAuthenticated: false,
        bootstrapRequired: false,
        email: null,
        roles: [],
      }),
      h.jsonResponse({
        isAuthenticated: true,
        email: 'collector@discweave.local',
        roles: ['Admin'],
      }),
      h.emptySearchResponse(),
    )
    const user = h.userEvent.setup()
    h.render(<h.App />)

    const form = await h.screen.findByRole('form', { name: 'Sign in' })
    await user.type(
      h.within(form).getByLabelText('Email'),
      'collector@discweave.local',
    )
    await user.type(h.within(form).getByLabelText('Password'), 'Password1!')
    await user.click(h.within(form).getByRole('button', { name: 'Sign in' }))

    expect(
      await h.screen.findByRole('heading', { name: 'Artist index' }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('searchbox', { name: 'Search artists' }),
    ).toBeInTheDocument()

    const urls = requestUrls(fetchMock)
    expect(urls.slice(0, 2)).toEqual(['/api/auth/session', '/api/auth/login'])
    expect(
      h
        .searchRequestUrls(fetchMock)
        .some((url) => url.searchParams.get('entityType') === 'artist'),
    ).toBe(true)
    expect(urls.some((url) => url.startsWith('/api/artists?'))).toBe(false)
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
      'collector@discweave.local',
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
      'disabled@discweave.local',
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
      'collector@discweave.local',
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

  it('shows a server search error for entity workspaces', async () => {
    h.clearCatalogForTests()
    window.history.pushState({}, '', '/tracks')
    const fetchMock = h.mockFetch(
      h.jsonResponse(
        { code: 'catalog.server_error', message: 'Catalog unavailable' },
        500,
      ),
      ...h.emptyCatalogLoadResponses().slice(1),
    )

    h.render(<h.App />)

    expect(
      await h.screen.findByRole('heading', { name: 'Tracks' }),
    ).toBeInTheDocument()
    expect(await h.screen.findByRole('alert')).toHaveTextContent(
      'Catalog unavailable',
    )
    expect(
      requestUrls(fetchMock).some((url) => url.startsWith('/api/tracks?')),
    ).toBe(false)
  })

  it('returns to sign in when a catalog mutation expires the session', async () => {
    h.clearCatalogForTests()
    window.history.pushState({}, '', '/artists')
    const fetchMock = h.vi.fn<Window['fetch']>(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      await Promise.resolve()

      if (url.startsWith('/api/search?')) {
        return h.emptySearchResponse()
      }
      if (url === '/api/artists') {
        return h.jsonResponse(
          { code: 'auth.unauthenticated', message: 'Session expired' },
          401,
        )
      }

      return h.emptySearchResponse()
    })
    h.vi.stubGlobal('fetch', fetchMock)
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
    window.history.pushState({}, '', '/labels')
    h.mockFetch(
      h.emptySearchResponse(),
      ...h.emptyCatalogLoadResponses(),
      h.jsonResponse({
        id: '00000000-0000-7000-8000-000000000010',
        name: 'Refresh Failure Label',
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

    await user.click(await h.screen.findByRole('button', { name: 'Add label' }))
    const form = h.screen.getByRole('form', { name: 'Add label' })
    await user.type(
      h.within(form).getByLabelText('Name'),
      'Refresh Failure Label',
    )
    await user.click(h.within(form).getByRole('button', { name: 'Add record' }))

    expect(await h.screen.findByRole('alert')).toHaveTextContent(
      'Catalog request failed. Try again.',
    )
    expect(
      h.screen.getByRole('heading', { name: 'Labels' }),
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
      'owner@discweave.local',
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

function requestUrls(fetchMock: ReturnType<typeof h.mockFetch>) {
  return fetchMock.mock.calls.map(([input]) =>
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url,
  )
}
