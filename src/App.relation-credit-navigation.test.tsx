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
      h.within(appearances).getByRole('heading', { name: 'producer' }),
    ).toBeInTheDocument()
    expect(
      h.within(appearances).getByRole('link', { name: 'Confusion' }),
    ).toHaveAttribute('href', '/releases?release=release-1')
    expect(
      h.within(appearances).getByRole('heading', { name: 'remixer' }),
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

  it('groups server-backed track graph links by appearance and version relation type', async () => {
    window.history.pushState({}, '', '/tracks?track=track-1')
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
      h.within(tracks).getByRole('heading', { name: 'remixOf' }),
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

  it('opens server-backed relation details from graph links without loading the full catalog', async () => {
    h.clearCatalogForTests()
    const fetchMock = h.mockFetch(
      h.searchResponseWithArtist(),
      f.graphResponseForArtistNavigation(),
      h.emptySearchResponse(),
      f.artistRelationDetailResponse(),
    )
    const user = h.userEvent.setup()

    h.render(<h.App />)

    await user.click(
      await h.screen.findByRole('link', {
        name: 'Arthur Baker to New Order',
      }),
    )

    const detailPanel = await h.screen.findByRole('complementary', {
      name: 'Arthur Baker to New Order',
    })
    expect(window.location.pathname).toBe('/relations')
    expect(window.location.search).toBe('?relation=artist-relation-1')
    expect(
      h
        .within(h.detailSection(detailPanel, 'Endpoints'))
        .getByRole('link', { name: 'Arthur Baker' }),
    ).toHaveAttribute('href', '/artists?artist=artist-1')
    expect(
      h
        .within(h.detailSection(detailPanel, 'Endpoints'))
        .getByRole('link', { name: 'New Order' }),
    ).toHaveAttribute('href', '/artists?artist=artist-2')
    expect(
      fetchMock.mock.calls.some(
        ([input]) =>
          typeof input === 'string' && input.startsWith('/api/artists?limit='),
      ),
    ).toBe(false)
  })

  it('falls back to track relation details when the artist relation endpoint returns 404', async () => {
    window.history.pushState({}, '', '/relations?relation=track-relation-1')
    h.clearCatalogForTests()
    h.mockFetch(
      h.emptySearchResponse(),
      h.jsonResponse({ code: 'artist_relation.not_found' }, 404),
      f.trackRelationDetailResponse(),
    )

    h.render(<h.App />)

    const detailPanel = await h.screen.findByRole('complementary', {
      name: 'Blue Monday (Hardfloor Mix) to Blue Monday',
    })
    expect(
      h
        .within(h.detailSection(detailPanel, 'Endpoints'))
        .getByRole('link', { name: 'Blue Monday (Hardfloor Mix)' }),
    ).toHaveAttribute('href', '/tracks?track=track-1')
    expect(
      h
        .within(h.detailSection(detailPanel, 'Endpoints'))
        .getByRole('link', { name: 'Blue Monday' }),
    ).toHaveAttribute('href', '/tracks?track=track-2')
  })

  it('replaces a stale relation deep link when relation search returns matches', async () => {
    window.history.pushState(
      {},
      '',
      '/relations?relation=artist-relation-1&query=blue',
    )
    h.clearCatalogForTests()
    h.mockFetch(
      f.searchResponseWithTrack(),
      f.artistRelationDetailResponse(),
      f.graphResponseForTrackNavigation(),
    )

    h.render(<h.App />)

    const detailPanel = await h.screen.findByRole('complementary', {
      name: 'Blue Monday (Hardfloor Mix)',
    })

    expect(window.location.pathname).toBe('/relations')
    expect(window.location.search).toBe('?relation=track-1&query=blue')
    expect(
      h
        .within(h.detailSection(detailPanel, 'Tracks'))
        .getByRole('link', { name: 'Blue Monday' }),
    ).toHaveAttribute('href', '/tracks?track=track-2')
    expect(
      h.screen.queryByRole('heading', { name: 'Arthur Baker to New Order' }),
    ).not.toBeInTheDocument()
  })
})
