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
    const fetchMock = h.mockFetch(
      h.searchResponseWithArtist(),
      f.graphResponseForArtistNavigation(),
      ...h.emptyCatalogLoadResponses(),
    )
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
      h.screen.getByRole('heading', { name: 'Relation graph' }),
    ).toBeInTheDocument()
    expect(
      requestUrls(fetchMock).some((url) =>
        url.startsWith('/api/artist-relations?'),
      ),
    ).toBe(true)
  })
})

function requestUrls(fetchMock: ReturnType<typeof h.mockFetch>) {
  return fetchMock.mock.calls.map(([input]) =>
    typeof input === 'string' ? input : (input as Request).url,
  )
}
