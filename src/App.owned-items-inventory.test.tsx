import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App owned item inventory workspace', () => {
  it('loads server-backed inventory from owned items API instead of search', async () => {
    window.history.pushState({}, '', '/owned-items')
    h.clearCatalogForTests()
    const fetchMock = h.mockFetch(inventoryResponse())

    h.render(<h.App />)

    expect(
      await h.screen.findByRole('row', { name: /blue monday/i }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('complementary', { name: 'Blue Monday' }),
    ).toBeInTheDocument()

    const urls = requestUrls(fetchMock)
    expect(urls).toContain('/api/owned-items?limit=100&offset=0')
    expect(urls.some((url) => url.startsWith('/api/search?'))).toBe(false)
  })

  it('loads only the first server page for the inventory workspace', async () => {
    window.history.pushState({}, '', '/owned-items')
    h.clearCatalogForTests()
    const fetchMock = h.mockFetch(inventoryResponse({ total: 250 }))

    h.render(<h.App />)

    expect(
      await h.screen.findByRole('row', { name: /blue monday/i }),
    ).toBeInTheDocument()

    const urls = requestUrls(fetchMock).filter((url) =>
      url.startsWith('/api/owned-items?'),
    )
    expect(urls).toEqual(['/api/owned-items?limit=100&offset=0'])
    expect(h.screen.getByText('2 shown · 250 total')).toBeInTheDocument()
  })

  it('sends URL-backed inventory filters to the owned items API', async () => {
    window.history.pushState(
      {},
      '',
      '/owned-items?status=owned&medium=vinyl&condition=veryGood&storageLocation=shelf&inventoryView=physicalWithoutDigital',
    )
    h.clearCatalogForTests()
    const fetchMock = h.mockFetch(inventoryResponse())

    h.render(<h.App />)

    await h.screen.findByRole('row', { name: /blue monday/i })

    const ownedItemsUrl = new URL(
      requestUrls(fetchMock).find((url) =>
        url.startsWith('/api/owned-items?'),
      ) ?? '',
      window.location.origin,
    )

    expect(ownedItemsUrl.searchParams.get('status')).toBe('owned')
    expect(ownedItemsUrl.searchParams.get('medium')).toBe('vinyl')
    expect(ownedItemsUrl.searchParams.get('condition')).toBe('veryGood')
    expect(ownedItemsUrl.searchParams.get('storageLocation')).toBe('shelf')
    expect(ownedItemsUrl.searchParams.get('inventoryView')).toBe(
      'physicalWithoutDigital',
    )
  })

  it('lets users request each inventory view from the filter controls', async () => {
    window.history.pushState({}, '', '/owned-items')
    h.clearCatalogForTests()
    const fetchMock = h.mockFetch(
      inventoryResponse(),
      inventoryResponse(),
      inventoryResponse(),
      inventoryResponse(),
      inventoryResponse(),
    )
    const user = h.userEvent.setup()

    h.render(<h.App />)

    await h.screen.findByRole('row', { name: /blue monday/i })

    for (const [label, value] of [
      ['Physical without digital', 'physicalWithoutDigital'],
      ['Lossy without lossless', 'lossyWithoutLossless'],
      ['Wanted not owned', 'wantedNotOwned'],
      ['Needs digitization', 'needsDigitization'],
    ] as const) {
      await user.selectOptions(h.screen.getByLabelText('Inventory view'), label)

      await h.waitFor(() => {
        expect(
          ownedItemsRequestUrls(fetchMock).some(
            (url) => url.searchParams.get('inventoryView') === value,
          ),
        ).toBe(true)
      })
    }
  })

  it('renders release and track target links from owned item summaries', async () => {
    window.history.pushState({}, '', '/owned-items')
    h.clearCatalogForTests()
    h.mockFetch(inventoryResponse())
    const user = h.userEvent.setup()

    h.render(<h.App />)

    const releasePanel = await h.screen.findByRole('complementary', {
      name: 'Blue Monday',
    })
    expect(
      h
        .within(h.detailSection(releasePanel, 'Linked catalog item'))
        .getByRole('link', { name: 'Blue Monday' }),
    ).toHaveAttribute('href', '/releases?release=release-blue-monday')

    await user.click(h.screen.getByRole('button', { name: /ceremony/i }))

    const trackPanel = h.screen.getByRole('complementary', {
      name: 'Ceremony',
    })
    expect(
      h
        .within(h.detailSection(trackPanel, 'Linked catalog item'))
        .getByRole('link', { name: 'Ceremony' }),
    ).toHaveAttribute('href', '/tracks?track=track-ceremony')
    expect(
      h
        .within(h.detailSection(trackPanel, 'Linked catalog item'))
        .getByRole('link', { name: 'Movement' }),
    ).toHaveAttribute('href', '/releases?release=release-movement')
  })
})

function requestUrls(fetchMock: ReturnType<typeof h.mockFetch>) {
  return fetchMock.mock.calls.map(([input]) =>
    typeof input === 'string' ? input : (input as Request).url,
  )
}

function ownedItemsRequestUrls(fetchMock: ReturnType<typeof h.mockFetch>) {
  return requestUrls(fetchMock)
    .filter((url) => url.startsWith('/api/owned-items?'))
    .map((url) => new URL(url, window.location.origin))
}

function inventoryResponse({ total = 2 }: { total?: number } = {}) {
  return h.jsonResponse({
    items: [
      {
        id: 'owned-blue-monday-vinyl',
        targetType: 'release',
        targetId: 'release-blue-monday',
        target: {
          type: 'release',
          id: 'release-blue-monday',
          title: 'Blue Monday',
          subtitle: 'Release',
          releaseId: 'release-blue-monday',
          releaseTitle: 'Blue Monday',
        },
        status: 'needsDigitization',
        medium: {
          type: 'vinyl',
          description: '12-inch vinyl',
          path: null,
          format: null,
          discCount: null,
        },
        condition: 'veryGood',
        storageLocation: 'Shelf A3',
        inventorySignals: ['physicalWithoutDigital', 'needsDigitization'],
      },
      {
        id: 'owned-ceremony-file',
        targetType: 'track',
        targetId: 'track-ceremony',
        target: {
          type: 'track',
          id: 'track-ceremony',
          title: 'Ceremony',
          subtitle: 'Movement',
          releaseId: 'release-movement',
          releaseTitle: 'Movement',
        },
        status: 'owned',
        medium: {
          type: 'digital',
          description: null,
          path: '/music/new-order/ceremony.mp3',
          format: 'mp3',
          discCount: null,
        },
        condition: null,
        storageLocation: 'Digital library',
        inventorySignals: ['lossyWithoutLossless', 'owned'],
      },
    ],
    limit: 100,
    offset: 0,
    total,
  })
}
