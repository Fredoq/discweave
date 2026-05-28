import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App server-backed navigation', () => {
  it('syncs same-route URL query changes into server-backed workspace state', async () => {
    window.history.pushState({}, '', '/releases?query=alpha')
    h.clearCatalogForTests()
    const fetchMock = h.mockFetch(
      h.emptySearchResponse(),
      h.emptySearchResponse(),
    )
    h.render(<h.App />)

    await h.waitFor(() => {
      expect(
        h
          .searchRequestUrls(fetchMock)
          .some((url) => url.searchParams.get('query') === 'alpha'),
      ).toBe(true)
    })

    h.act(() => {
      window.history.pushState({}, '', '/releases?query=beta')
      window.dispatchEvent(new Event('cratebase:navigation'))
    })

    await h.waitFor(() => {
      expect(
        h
          .searchRequestUrls(fetchMock)
          .some((url) => url.searchParams.get('query') === 'beta'),
      ).toBe(true)
    })
  })

  it('syncs same-route URL query changes into server-backed artist workspace state', async () => {
    window.history.pushState({}, '', '/artists?query=alpha')
    h.clearCatalogForTests()
    const fetchMock = h.mockFetch(
      h.emptySearchResponse(),
      h.emptySearchResponse(),
    )
    h.render(<h.App />)

    await h.waitFor(() => {
      expect(
        h
          .searchRequestUrls(fetchMock)
          .some((url) => url.searchParams.get('query') === 'alpha'),
      ).toBe(true)
    })

    h.act(() => {
      window.history.pushState({}, '', '/artists?query=beta')
      window.dispatchEvent(new Event('cratebase:navigation'))
    })

    await h.waitFor(() => {
      expect(
        h
          .searchRequestUrls(fetchMock)
          .some((url) => url.searchParams.get('query') === 'beta'),
      ).toBe(true)
    })
  })

  it('debounces server-backed entity search typing', async () => {
    window.history.pushState({}, '', '/releases')
    h.clearCatalogForTests()
    const fetchMock = h.mockFetch(
      h.emptySearchResponse(),
      h.emptySearchResponse(),
    )
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await h.screen.findByText('No matching catalog entries.')
    await user.type(h.screen.getByRole('searchbox'), 'beta')

    await h.waitFor(() => {
      expect(
        h
          .searchRequestUrls(fetchMock)
          .some((url) => url.searchParams.get('query') === 'beta'),
      ).toBe(true)
    })
    expect(
      h
        .searchRequestUrls(fetchMock)
        .map((url) => url.searchParams.get('query') ?? ''),
    ).toEqual(['', 'beta'])
  })

  it('debounces server-backed artist search typing', async () => {
    window.history.pushState({}, '', '/artists')
    h.clearCatalogForTests()
    const fetchMock = h.mockFetch(
      h.emptySearchResponse(),
      h.emptySearchResponse(),
    )
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await h.screen.findByText('No matching artists.')
    await user.type(h.screen.getByRole('searchbox'), 'eno')

    await h.waitFor(() => {
      expect(
        h
          .searchRequestUrls(fetchMock)
          .some((url) => url.searchParams.get('query') === 'eno'),
      ).toBe(true)
    })
    expect(
      h
        .searchRequestUrls(fetchMock)
        .map((url) => url.searchParams.get('query') ?? ''),
    ).toEqual(['', 'eno'])
  })

  it('shows mutation errors in server-backed workspaces', async () => {
    window.history.pushState({}, '', '/artists')
    h.clearCatalogForTests()
    const fetchMock = h.mockFetch(
      h.emptySearchResponse(),
      h.jsonResponse(
        { code: 'catalog.server_error', message: 'Save failed' },
        500,
      ),
    )
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(
      await h.screen.findByRole('button', { name: 'Add artist' }),
    )
    const form = h.screen.getByRole('form', { name: 'Add artist' })
    await user.type(h.within(form).getByLabelText('Name'), 'Failed Artist')
    await user.click(h.within(form).getByRole('button', { name: 'Add record' }))

    expect(await h.screen.findByRole('alert')).toHaveTextContent(
      'Catalog request failed. Try again.',
    )
    expect(
      fetchMock.mock.calls.some(([input]) => input === '/api/artists'),
    ).toBe(true)
  })

  it('does not hydrate the full catalog when navigating across server-backed workspaces', async () => {
    h.clearCatalogForTests()
    h.vi.stubGlobal('__cratebaseUseRealCatalogApi', true)
    const fetchMock = h.mockFetch(
      ...Array.from({ length: 8 }, h.emptySearchResponse),
      h.emptyImportSessionsResponse(),
      h.defaultDictionaryListResponse(),
      h.defaultRatingCriteriaListResponse(),
    )
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await h.screen.findByText('No matching catalog entries.')

    const routeExpectations = [
      ['Releases', 2],
      ['Tracks', 3],
      ['Artists', 4],
      ['Labels', 5],
      ['Playlists', 6],
      ['Owned Items', 7],
      ['Relations', 8],
      ['Imports', 9],
      ['Exports', 9],
      ['Settings', 11],
    ] as const

    for (const [routeName, expectedCallCount] of routeExpectations) {
      await user.click(h.screen.getByRole('link', { name: routeName }))
      expect(
        h.within(h.screen.getByRole('banner')).getByRole('heading', {
          name: routeName,
        }),
      ).toBeInTheDocument()
      await h.waitFor(() => {
        expect(fetchMock.mock.calls).toHaveLength(expectedCallCount)
      })
    }

    const urls = fetchMock.mock.calls.map(([input]) =>
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url,
    )

    expect(urls.filter((url) => url.startsWith('/api/search?'))).toHaveLength(7)
    expect(urls).toContain('/api/owned-items?limit=100&offset=0')
    expect(urls).toContain('/api/imports?limit=100&offset=0')
    expect(urls).toContain('/api/settings/dictionaries?limit=100&offset=0')
    expect(urls).toContain('/api/rating-criteria?limit=100&offset=0')
    for (const listPath of [
      '/api/artists?',
      '/api/labels?',
      '/api/releases?',
      '/api/tracks?',
      '/api/credits?',
      '/api/artist-relations?',
      '/api/track-relations?',
      '/api/playlists?',
      '/api/ratings?',
    ]) {
      expect(urls.some((url) => url.startsWith(listPath))).toBe(false)
    }
  })
})
