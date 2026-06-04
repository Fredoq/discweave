import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'
import * as f from './test/roadmap09ServerFixtures'

h.setupAppTestHooks()

describe('App relation and credit navigation', () => {
  it('groups server-backed artist graph links by credit role and relation type', async () => {
    h.clearCatalogForTests()
    h.mockFetch(
      h.searchResponseWithArtist(),
      f.graphResponseForArtistNavigation(),
    )

    h.render(<h.App />)

    const detailPanel = await h.screen.findByRole('complementary', {
      name: 'Arthur Baker',
    })
    const appearances = h.detailSection(detailPanel, 'Appearances')
    expect(
      h.within(appearances).getByRole('heading', { name: 'Producer' }),
    ).toBeInTheDocument()
    expect(
      h.within(appearances).getByRole('link', { name: 'Confusion' }),
    ).toHaveAttribute('href', '/releases?release=release-1')
    expect(
      h.within(appearances).getByRole('heading', { name: 'Remixer' }),
    ).toBeInTheDocument()
    expect(
      h
        .within(appearances)
        .getByRole('link', { name: 'Confusion (Instrumental)' }),
    ).toHaveAttribute('href', '/tracks?track=track-1')
    expect(
      h
        .within(h.detailSection(detailPanel, 'Relations'))
        .getByRole('link', { name: 'Arthur Baker to New Order' }),
    ).toHaveAttribute('href', '/relations?relation=artist-relation-1')
  })

  it('groups catalog track graph links by appearance and version relation type', async () => {
    window.history.pushState({}, '', '/catalog?query=blue')
    h.clearCatalogForTests()
    h.mockFetch(
      f.searchResponseWithTrack(),
      f.graphResponseForTrackNavigation(),
    )

    h.render(<h.App />)

    const detailPanel = await h.screen.findByRole('complementary', {
      name: 'Blue Monday (Hardfloor Mix)',
    })
    expect(
      h
        .within(h.detailSection(detailPanel, 'Appearances'))
        .getByRole('link', { name: 'Blue Monday Remixes' }),
    ).toHaveAttribute('href', '/releases?release=release-1')
    const tracks = h.detailSection(detailPanel, 'Tracks')
    expect(
      h.within(tracks).getByRole('heading', { name: 'Remix of' }),
    ).toBeInTheDocument()
    expect(
      h.within(tracks).getByRole('link', { name: 'Blue Monday' }),
    ).toHaveAttribute('href', '/tracks?track=track-2')
    expect(
      h.within(h.detailSection(detailPanel, 'Relations')).getByRole('link', {
        name: 'Blue Monday (Hardfloor Mix) to Blue Monday',
      }),
    ).toHaveAttribute('href', '/relations?relation=track-relation-1')
  })

  it('opens editable relation records from catalog graph links', async () => {
    h.clearCatalogForTests()
    const fetchMock = h.vi.fn<Window['fetch']>(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      await Promise.resolve()

      if (url.startsWith('/api/search?')) {
        const params = new URL(url, window.location.origin).searchParams

        return params.get('savedView') === 'credits'
          ? h.emptySearchResponse()
          : h.searchResponseWithArtist()
      }
      if (url === '/api/catalog-graph/artist/artist-1') {
        return f.graphResponseForArtistNavigation()
      }
      if (url.startsWith('/api/artists?')) {
        return h.jsonResponse({
          items: [
            { id: 'artist-1', name: 'Arthur Baker', type: 'person' },
            { id: 'artist-2', name: 'New Order', type: 'group' },
          ],
          limit: 100,
          offset: 0,
          total: 2,
        })
      }
      if (url.startsWith('/api/artist-relations?')) {
        return h.jsonResponse({
          items: [
            {
              id: 'artist-relation-1',
              sourceArtistId: 'artist-1',
              targetArtistId: 'artist-2',
              type: 'collaboration',
              startYear: 1983,
              endYear: null,
              sourceArtistName: 'Arthur Baker',
              targetArtistName: 'New Order',
            },
          ],
          limit: 100,
          offset: 0,
          total: 1,
        })
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
      await h.screen.findByRole('link', {
        name: 'Arthur Baker to New Order',
      }),
    )

    await h.screen.findByRole('heading', { name: 'Relations' })

    expect(window.location.pathname).toBe('/relations')
    expect(
      await h.screen.findByRole('heading', {
        name: 'Arthur Baker to New Order',
      }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('button', { name: 'Edit record' }),
    ).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.some(
        ([input]) =>
          typeof input === 'string' &&
          input.startsWith('/api/artist-relations?'),
      ),
    ).toBe(true)
    expect(
      fetchMock.mock.calls.some(
        ([input]) =>
          typeof input === 'string' &&
          input === '/api/artist-relations/artist-relation-1',
      ),
    ).toBe(false)
  })
})
