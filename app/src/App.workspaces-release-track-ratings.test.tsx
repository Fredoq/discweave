import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App release track ratings', () => {
  it('rates tracks from the release detail tracklist', async () => {
    window.history.pushState({}, '', '/releases?release=track-rated-release')
    const user = h.userEvent.setup()
    const release = {
      id: 'track-rated-release',
      title: 'Track Rated Release',
      artist: 'Track Rating Artist',
      type: 'Album' as const,
      year: '2026',
      label: 'Rating Label',
      labels: [
        {
          name: 'Rating Label',
          catalogNumber: 'RATE-1',
          hasNoCatalogNumber: false,
        },
      ],
      genres: ['Electronic'],
      tags: [],
      releaseNotes: '',
      ownedCopies: [],
    }
    const track = {
      ...h.trackRecords[0],
      id: 'track-rated-release-track-one',
      title: 'Track Rating Target',
      artist: release.artist,
      release: {
        id: release.id,
        title: release.title,
        artist: release.artist,
        year: release.year,
        label: release.label,
      },
      trackNumber: '1',
      duration: '3:21',
      ratings: [],
      releaseAppearances: [
        {
          releaseId: release.id,
          releaseTitle: release.title,
          releaseArtist: release.artist,
          year: release.year,
          label: release.label,
          position: '1',
          duration: '3:21',
        },
      ],
    }
    h.seedCatalogForTests({
      artists: [],
      releases: [release],
      tracks: [track],
      ownedItems: [],
      relations: [],
      playlists: [],
      ratingCriteria: h.defaultRatingCriteria,
      ratings: [],
    })

    h.render(<h.App />)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Track Rated Release',
    })
    const tracksSection = h.detailSection(detailPanel, 'Tracks')
    const trackRatingGroup = h.within(tracksSection).getByRole('group', {
      name: 'Overall rating for Track Rating Target',
    })

    await user.click(
      h.within(trackRatingGroup).getByRole('button', { name: '8' }),
    )

    expect(
      h.within(trackRatingGroup).getByRole('button', { name: '8' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(h.within(tracksSection).getByText('8/10')).toBeInTheDocument()
  })
})
