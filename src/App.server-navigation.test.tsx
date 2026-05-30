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

  it('renders releases through paged server search without hydrating the full catalog', async () => {
    window.history.pushState({}, '', '/releases')
    h.clearCatalogForTests()
    const fetchMock = h.mockFetch(h.emptySearchResponse())

    h.render(<h.App />)

    expect(
      await h.screen.findByRole('heading', { name: 'Releases' }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('heading', { name: 'Catalog results' }),
    ).toBeInTheDocument()

    const urls = requestUrls(fetchMock)
    expect(searchUrls(fetchMock)).toHaveLength(1)
    expect(searchUrls(fetchMock)[0].searchParams.get('entityType')).toBe(
      'release',
    )
    expect(searchUrls(fetchMock)[0].searchParams.get('limit')).toBe('100')
    expect(searchUrls(fetchMock)[0].searchParams.get('offset')).toBe('0')
    expect(urls.some((url) => url.startsWith('/api/releases?'))).toBe(false)
    expect(urls.some((url) => url.startsWith('/api/tracks?'))).toBe(false)
    expect(urls.some((url) => url.startsWith('/api/owned-items?'))).toBe(false)
  })

  it('keeps entity navigation on server search without full catalog hydration', async () => {
    h.clearCatalogForTests()
    const fetchMock = h.mockFetch(
      h.emptySearchResponse(),
      h.emptySearchResponse(),
      h.emptySearchResponse(),
    )
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await h.screen.findByText('No matching catalog entries.')
    await user.click(h.screen.getByRole('link', { name: 'Releases' }))

    expect(
      await h.screen.findByRole('heading', { name: 'Catalog results' }),
    ).toBeInTheDocument()

    await user.click(h.screen.getByRole('link', { name: 'Tracks' }))

    expect(
      await h.screen.findByRole('heading', { name: 'Catalog results' }),
    ).toBeInTheDocument()

    const urls = requestUrls(fetchMock)
    expect(
      searchUrls(fetchMock).map((url) => url.searchParams.get('entityType')),
    ).toEqual([null, 'release', 'track'])
    expect(urls.some((url) => url.startsWith('/api/releases?'))).toBe(false)
    expect(urls.some((url) => url.startsWith('/api/tracks?'))).toBe(false)
    expect(urls.some((url) => url.startsWith('/api/owned-items?'))).toBe(false)
  })

  it('requests the next release page from the server instead of preloading all releases', async () => {
    window.history.pushState({}, '', '/releases')
    h.clearCatalogForTests()
    const fetchMock = h.vi.fn<Window['fetch']>(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      await Promise.resolve()

      if (url.startsWith('/api/search?')) {
        const params = new URL(url, window.location.origin).searchParams

        return params.get('offset') === '100'
          ? releaseSearchResponse({
              id: 'release-101',
              title: 'Seed Release 00101',
              offset: 100,
            })
          : releaseSearchResponse({
              id: 'release-1',
              title: 'Seed Release 00001',
            })
      }
      if (url === '/api/catalog-graph/release/release-101') {
        return graphResponseForRelease('release-101', 'Seed Release 00101')
      }
      if (url === '/api/catalog-graph/release/release-1') {
        return graphResponseForRelease('release-1', 'Seed Release 00001')
      }

      return h.emptySearchResponse()
    })
    h.vi.stubGlobal('fetch', fetchMock)
    const user = h.userEvent.setup()

    h.render(<h.App />)

    expect(
      await h.screen.findByRole('row', { name: /Seed Release 00001/i }),
    ).toBeInTheDocument()
    await h.waitFor(() => {
      expect(requestUrls(fetchMock)).toContain(
        '/api/catalog-graph/release/release-1',
      )
    })

    await user.click(h.screen.getByRole('button', { name: 'Next page' }))

    expect(
      await h.screen.findByRole('row', { name: /Seed Release 00101/i }),
    ).toBeInTheDocument()

    const urls = searchUrls(fetchMock)
    expect(urls.at(-1)?.searchParams.get('entityType')).toBe('release')
    expect(urls.at(-1)?.searchParams.get('limit')).toBe('100')
    expect(urls.at(-1)?.searchParams.get('offset')).toBe('100')
    expect(
      requestUrls(fetchMock).some((url) => url.startsWith('/api/releases?')),
    ).toBe(false)
  })

  it('shows mutation errors in editable workspaces', async () => {
    window.history.pushState({}, '', '/artists')
    h.clearCatalogForTests()
    const fetchMock = h.mockFetch(
      h.emptyCatalogListResponse(),
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

function releaseSearchResponse({
  id,
  title,
  offset = 0,
}: {
  id: string
  title: string
  offset?: number
}) {
  return h.jsonResponse({
    items: [
      {
        id,
        type: 'release',
        title,
        subtitle: 'Various Artists',
        summary: 'Album',
        matchedFields: ['title'],
        snippets: [title],
        facets: {
          roles: [],
          media: ['digital'],
          statuses: ['owned'],
          tags: [],
          labelId: null,
          collectorSignals: [],
        },
        rank: 1,
      },
    ],
    limit: 100,
    offset,
    total: 150,
  })
}

function graphResponseForRelease(id: string, title: string) {
  return h.jsonResponse({
    entity: {
      id,
      type: 'release',
      title,
      subtitle: 'Various Artists',
      summary: 'Album',
    },
    sections: {
      artists: [],
      releases: [],
      tracks: [],
      ownedCopies: [],
      labels: [],
      playlists: [],
      credits: [],
      relations: [],
      media: [],
    },
    collectorSignals: [],
  })
}
