import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'
import {
  graphResponseForReleaseWithDuplicateArtists,
  releaseDetailWithoutCover,
  searchResponseWithRelease,
} from './test/catalogActionFixtures'

h.setupAppTestHooks()

describe('App catalog server detail panel', () => {
  it('renders release details with readable roles, merged artists, and cover actions', async () => {
    window.history.pushState({}, '', '/catalog')
    h.clearCatalogForTests()
    h.mockFetch(
      searchResponseWithRelease(),
      graphResponseForReleaseWithDuplicateArtists(),
      releaseDetailWithoutCover(),
    )

    h.render(<h.App />)

    const detailPanel = await h.screen.findByRole('complementary', {
      name: 'Stripped',
    })
    const artistsSection = h.detailSection(detailPanel, 'Artists')

    expect(
      h.within(artistsSection).getByRole('link', { name: 'Depeche Mode' }),
    ).toHaveAttribute('href', '/artists?artist=artist-depeche-mode')
    expect(
      h.within(artistsSection).getByText('Main artist'),
    ).toBeInTheDocument()
    expect(
      h.within(artistsSection).getAllByRole('link', {
        name: 'Depeche Mode',
      }),
    ).toHaveLength(1)
    expect(
      h.within(detailPanel).queryByRole('heading', { name: 'Credits' }),
    ).not.toBeInTheDocument()
    expect(
      h.within(detailPanel).queryByRole('heading', { name: 'TRACKLIST' }),
    ).not.toBeInTheDocument()
    expect(
      h.within(detailPanel).queryByRole('heading', { name: 'LABEL' }),
    ).not.toBeInTheDocument()
    expect(
      h.within(detailPanel).getByLabelText('Upload cover'),
    ).toBeInTheDocument()
    expect(
      h.within(detailPanel).queryByRole('button', {
        name: 'Load editable view',
      }),
    ).not.toBeInTheDocument()
  })
})
