import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App workspace navigation', () => {
  it('syncs same-route URL query changes into the catalog search state', async () => {
    window.history.pushState({}, '', '/catalog?query=alpha')
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
      window.history.pushState({}, '', '/catalog?query=beta')
      window.dispatchEvent(new Event('discweave:navigation'))
    })

    await h.waitFor(() => {
      expect(
        h
          .searchRequestUrls(fetchMock)
          .some((url) => url.searchParams.get('query') === 'beta'),
      ).toBe(true)
    })
  })

  it('renders releases as an editable release workspace after hydrating the catalog', async () => {
    window.history.pushState({}, '', '/releases')
    h.clearCatalogForTests()
    const fetchMock = h.vi.fn<Window['fetch']>(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      await Promise.resolve()

      if (url.startsWith('/api/artists?')) {
        return listResponse([
          { id: 'artist-orb', type: 'group', name: 'The Orb' },
        ])
      }

      if (url.startsWith('/api/labels?')) {
        return listResponse([{ id: 'label-big-life', name: 'Big Life' }])
      }

      if (url.startsWith('/api/releases?')) {
        return listResponse([
          {
            id: 'release-orb',
            title: "The Orb's Adventures Beyond the Ultraworld",
            type: 'album',
            year: 1991,
            releaseDate: null,
            genres: ['Electronic'],
            tags: [],
            artistCredits: [
              {
                artistId: 'artist-orb',
                artistName: 'The Orb',
                role: 'mainArtist',
              },
            ],
            labels: [
              {
                labelId: 'label-big-life',
                name: 'Big Life',
                catalogNumber: 'BLRCD 5',
                hasNoCatalogNumber: false,
              },
            ],
            tracklist: [],
          },
        ])
      }

      if (url.startsWith('/api/settings/dictionaries?')) {
        return h.defaultDictionaryListResponse()
      }

      if (url.startsWith('/api/rating-criteria?')) {
        return h.defaultRatingCriteriaListResponse()
      }

      return h.emptyCatalogListResponse()
    })
    h.vi.stubGlobal('fetch', fetchMock)

    h.render(<h.App />)

    expect(
      await h.screen.findByRole('heading', { name: 'Releases' }),
    ).toBeInTheDocument()
    expect(
      await h.screen.findByRole('heading', { name: 'Release records' }),
    ).toBeInTheDocument()
    expect(
      h.screen.queryByRole('heading', { name: 'Catalog results' }),
    ).not.toBeInTheDocument()
    expect(
      h.screen.getByRole('columnheader', { name: 'Catalog #' }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('row', {
        name: /The Orb's Adventures Beyond the Ultraworld/i,
      }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('button', { name: 'Edit record' }),
    ).toBeInTheDocument()

    const urls = requestUrls(fetchMock)
    expect(urls.some((url) => url.startsWith('/api/releases?'))).toBe(true)
    expect(
      searchUrls(fetchMock).some(
        (url) => url.searchParams.get('entityType') === 'release',
      ),
    ).toBe(false)
  })

  it('hydrates the full catalog when navigating from catalog search into entity workspaces', async () => {
    h.clearCatalogForTests()
    const fetchMock = h.vi.fn<Window['fetch']>(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      await Promise.resolve()

      if (url.startsWith('/api/search?')) {
        return h.emptySearchResponse()
      }

      if (url.startsWith('/api/settings/dictionaries?')) {
        return h.defaultDictionaryListResponse()
      }

      if (url.startsWith('/api/rating-criteria?')) {
        return h.defaultRatingCriteriaListResponse()
      }

      return h.emptyCatalogListResponse()
    })
    h.vi.stubGlobal('fetch', fetchMock)
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await h.screen.findByText('No matching catalog entries.')
    await user.click(h.screen.getByRole('link', { name: 'Releases' }))

    expect(
      await h.screen.findByRole('heading', { name: 'Release records' }),
    ).toBeInTheDocument()

    await user.click(h.screen.getByRole('link', { name: 'Tracks' }))

    expect(
      await h.screen.findByRole('heading', { name: 'Track records' }),
    ).toBeInTheDocument()

    const urls = requestUrls(fetchMock)
    expect(
      searchUrls(fetchMock).map((url) => url.searchParams.get('entityType')),
    ).toEqual([null])
    expect(urls.some((url) => url.startsWith('/api/releases?'))).toBe(true)
    expect(urls.some((url) => url.startsWith('/api/tracks?'))).toBe(true)
    expect(urls.some((url) => url.startsWith('/api/owned-items?'))).toBe(true)
  })

  it('shows mutation errors in editable workspaces', async () => {
    window.history.pushState({}, '', '/artists')
    h.clearCatalogForTests()
    const fetchMock = h.vi.fn<Window['fetch']>(async (input, init) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      await Promise.resolve()

      if (url === '/api/artists' && init?.method === 'POST') {
        return h.jsonResponse(
          { code: 'catalog.server_error', message: 'Save failed' },
          500,
        )
      }

      if (url.startsWith('/api/settings/dictionaries?')) {
        return h.defaultDictionaryListResponse()
      }

      if (url.startsWith('/api/rating-criteria?')) {
        return h.defaultRatingCriteriaListResponse()
      }

      return h.emptyCatalogListResponse()
    })
    h.vi.stubGlobal('fetch', fetchMock)
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
})

function requestUrls(fetchMock: ReturnType<typeof h.mockFetch>) {
  return fetchMock.mock.calls.map(([input]) =>
    typeof input === 'string' ? input : (input as Request).url,
  )
}

function searchUrls(fetchMock: ReturnType<typeof h.mockFetch>) {
  return requestUrls(fetchMock)
    .filter((url) => url.startsWith('/api/search?'))
    .map((url) => new URL(url, window.location.origin))
}

function listResponse(items: unknown[]) {
  return h.jsonResponse({
    items,
    limit: 100,
    offset: 0,
    total: items.length,
  })
}
