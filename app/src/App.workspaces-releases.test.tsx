import { describe, expect, it, vi } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App release workspace', () => {
  it('renders the releases workspace with release rows and selected detail', () => {
    window.history.pushState({}, '', '/releases')

    h.render(<h.App />)

    expect(
      h.screen.getByRole('region', { name: 'Releases workspace' }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('searchbox', { name: 'Search releases' }),
    ).toBeVisible()
    expect(
      h.screen.getByRole('row', { name: /selected ambient works 85-92/i }),
    ).toBeVisible()
    expect(
      h.screen.getByRole('complementary', {
        name: 'Selected Ambient Works 85-92',
      }),
    ).toBeInTheDocument()
  })

  it('uploads and removes a release cover from the release detail panel', async () => {
    window.history.pushState({}, '', '/releases')
    const user = h.userEvent.setup()

    h.render(<h.App />)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Selected Ambient Works 85-92',
    })
    expect(
      h.within(detailPanel).getByText('No cover image recorded'),
    ).toBeVisible()
    const uploadInput = h.within(detailPanel).getByLabelText('Upload cover')
    expect(uploadInput).toHaveAttribute(
      'accept',
      'image/png,image/jpeg,image/webp',
    )

    const coverFile = new File(['cover-bytes'], 'front.png', {
      type: 'image/png',
    })
    await user.upload(uploadInput, coverFile)

    expect(
      await h.within(detailPanel).findByRole('img', {
        name: 'Selected Ambient Works 85-92 cover',
      }),
    ).toHaveAttribute(
      'src',
      '/api/releases/selected-ambient-works-85-92/cover-image',
    )
    expect(
      h.within(detailPanel).getByLabelText('Replace cover'),
    ).toHaveAttribute('accept', 'image/png,image/jpeg,image/webp')

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await user.click(
      h.within(detailPanel).getByRole('button', { name: 'Remove cover' }),
    )

    expect(confirmSpy).toHaveBeenCalledWith('Remove this cover image?')
    expect(
      await h.within(detailPanel).findByText('No cover image recorded'),
    ).toBeVisible()
  })

  it('filters releases by title, artist, label, year, media and ownership status', async () => {
    window.history.pushState({}, '', '/releases')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.type(
      h.screen.getByRole('searchbox', { name: 'Search releases' }),
      'factory needs digitization',
    )

    expect(h.screen.getByRole('row', { name: /blue monday/i })).toBeVisible()
    expect(
      h.screen.queryByRole('row', { name: /selected ambient works/i }),
    ).not.toBeInTheDocument()
  })

  it('separates release metadata from collection items in release detail', () => {
    window.history.pushState({}, '', '/releases')

    h.render(<h.App />)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Selected Ambient Works 85-92',
    })

    expect(
      h.within(detailPanel).getByRole('heading', { name: 'Release metadata' }),
    ).toBeInTheDocument()
    expect(
      h.within(detailPanel).getByRole('heading', { name: 'Collection items' }),
    ).toBeInTheDocument()
    expect(h.within(detailPanel).getByText('Warp')).toBeInTheDocument()
    expect(
      h.within(detailPanel).getByText('Digital library'),
    ).toBeInTheDocument()
  })

  it('shows release artist credits as navigable artist links', () => {
    window.history.pushState({}, '', '/releases?release=credited-release')
    h.seedCatalogForTests({
      artists: [
        {
          ...h.artistRecords[0],
          id: 'credited-main-artist',
          name: 'Credited Main Artist',
        },
        {
          ...h.artistRecords[1],
          id: 'credited-producer',
          name: 'Credited Producer',
        },
      ],
      releases: [
        {
          ...h.releaseRecords[0],
          id: 'credited-release',
          title: 'Credited Release',
          artist: 'Credited Main Artist',
          artistCredits: [
            {
              artistId: 'credited-main-artist',
              artist: 'Credited Main Artist',
              role: 'Main artist',
            },
            {
              artistId: 'credited-producer',
              artist: 'Credited Producer',
              role: 'Producer',
            },
          ],
        },
      ],
      tracks: [],
      ownedItems: [],
      relations: [],
      playlists: [],
    })

    h.render(<h.App />)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Credited Release',
    })
    const credits = h.detailSection(detailPanel, 'Release credits')

    expect(
      h.within(credits).getByRole('link', { name: 'Credited Main Artist' }),
    ).toHaveAttribute('href', '/artists?artist=credited-main-artist')
    expect(
      h.within(credits).getByRole('link', { name: 'Credited Producer' }),
    ).toHaveAttribute('href', '/artists?artist=credited-producer')
  })

  it('does not show technical API source notes in release detail', () => {
    window.history.pushState({}, '', '/releases?release=api-source-release')
    const technicalApiNote = [
      'Release loaded from the authenticated',
      'collection',
      'API.',
    ].join(' ')
    h.seedCatalogForTests({
      artists: [],
      releases: [
        {
          id: 'api-source-release',
          title: 'API Source Release',
          artist: 'Source Artist',
          type: 'EP',
          year: '2026',
          label: 'Source Label',
          labels: [
            {
              name: 'Source Label',
              catalogNumber: 'SOURCE-1',
              hasNoCatalogNumber: false,
            },
          ],
          genres: ['Electronic'],
          tags: [],
          releaseNotes: technicalApiNote,
          ownedCopies: [],
        },
      ],
      tracks: [],
      ownedItems: [],
      relations: [],
      playlists: [],
    })

    h.render(<h.App />)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'API Source Release',
    })

    expect(
      h.within(detailPanel).queryByText(technicalApiNote),
    ).not.toBeInTheDocument()
    expect(
      h.within(detailPanel).getByRole('heading', { name: 'Release metadata' }),
    ).toBeInTheDocument()
  })

  it('shows label ratings in rating showcases', async () => {
    window.history.pushState({}, '', '/playlists')
    const user = h.userEvent.setup()
    h.seedCatalogForTests({
      artists: [],
      releases: [
        {
          id: 'label-rated-release',
          title: 'Label Rated Release',
          artist: 'Archive Artist',
          type: 'Album',
          year: '2026',
          label: 'Rated Label',
          labels: [
            {
              labelId: 'rated-label',
              name: 'Rated Label',
              catalogNumber: 'RL-1',
              hasNoCatalogNumber: false,
            },
          ],
          genres: [],
          tags: [],
          releaseNotes: '',
          ownedCopies: [],
        },
      ],
      tracks: [],
      ownedItems: [],
      relations: [],
      playlists: [],
      ratingCriteria: [
        {
          id: 'rating-criterion:label-impact',
          code: 'labelImpact',
          name: 'Label impact',
          targetTypes: ['label'],
          sortOrder: 10,
          isActive: true,
          isBuiltin: false,
          isProtected: false,
        },
      ],
      ratings: [
        {
          id: 'rating:label-impact:rated-label',
          criterionId: 'rating-criterion:label-impact',
          targetType: 'label',
          targetId: 'rated-label',
          value: 8,
        },
      ],
    })

    h.render(<h.App />)
    await user.click(h.screen.getByRole('button', { name: 'Rating showcases' }))

    expect(
      h.screen.getByRole('link', { name: /Rated Label/ }),
    ).toBeInTheDocument()
    expect(h.screen.getByRole('cell', { name: 'Label' })).toBeInTheDocument()
    expect(h.screen.getByRole('cell', { name: '8/10' })).toBeInTheDocument()
  })

  it('sorts release detail tracks by their release track number', () => {
    window.history.pushState({}, '', '/releases?release=ordered-release')
    const release = {
      id: 'ordered-release',
      title: 'Ordered Release',
      artist: 'Order Artist',
      type: 'EP' as const,
      year: '2026',
      label: 'Order Label',
      labels: [
        {
          name: 'Order Label',
          catalogNumber: 'ORDER-1',
          hasNoCatalogNumber: false,
        },
      ],
      genres: ['Electronic'],
      tags: [],
      releaseNotes: 'Release used to verify track ordering.',
      ownedCopies: [],
    }
    const releaseTrack = (trackNumber: string, title: string) => ({
      ...h.trackRecords[0],
      id: `ordered-release-track-${trackNumber}`,
      title,
      artist: 'Order Artist',
      release: {
        id: release.id,
        title: release.title,
        artist: release.artist,
        year: release.year,
        label: release.label,
      },
      trackNumber,
      duration: 'Unknown duration',
      releaseAppearances: [
        {
          releaseId: release.id,
          releaseTitle: release.title,
          releaseArtist: release.artist,
          year: release.year,
          label: release.label,
          position: trackNumber,
          duration: 'Unknown duration',
        },
      ],
    })
    h.seedCatalogForTests({
      artists: [],
      releases: [release],
      tracks: [
        releaseTrack('4', 'Track Four'),
        releaseTrack('3', 'Track Three'),
        releaseTrack('1', 'Track One'),
        releaseTrack('2', 'Track Two'),
      ],
      ownedItems: [],
      relations: [],
      playlists: [],
    })

    h.render(<h.App />)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Ordered Release',
    })
    const trackLinks = h
      .within(h.detailSection(detailPanel, 'Tracks'))
      .getAllByRole('link')

    expect(trackLinks.map((link) => link.textContent)).toEqual([
      'Track One',
      'Track Two',
      'Track Three',
      'Track Four',
    ])
  })

  it('preserves edited release track positions when saving without tracklist changes', async () => {
    window.history.pushState({}, '', '/releases?release=non-contiguous-release')
    const user = h.userEvent.setup()
    const release = {
      id: 'non-contiguous-release',
      title: 'Non-contiguous Release',
      artist: 'Position Artist',
      artistCredits: [
        {
          artist: 'Position Artist',
          role: 'Main artist' as const,
        },
      ],
      type: 'EP' as const,
      year: '2026',
      label: 'Position Label',
      labels: [
        {
          name: 'Position Label',
          catalogNumber: 'POS-1',
          hasNoCatalogNumber: false,
        },
      ],
      genres: ['Electronic'],
      tags: [],
      releaseNotes: 'Keep these release notes.',
      ownedCopies: [],
    }
    const releaseTrack = (trackNumber: string, title: string) => ({
      ...h.trackRecords[0],
      id: `non-contiguous-release-track-${trackNumber}`,
      title,
      artist: release.artist,
      release: {
        id: release.id,
        title: release.title,
        artist: release.artist,
        year: release.year,
        label: release.label,
      },
      trackNumber,
      duration: 'Unknown duration',
      relationHint: '',
      tags: [],
      credits: [
        {
          artist: release.artist,
          role: 'Main artist' as const,
          scope: '',
        },
      ],
      releaseAppearances: [
        {
          releaseId: release.id,
          releaseTitle: release.title,
          releaseArtist: release.artist,
          year: release.year,
          label: release.label,
          position: trackNumber,
          duration: 'Unknown duration',
        },
      ],
      relations: [],
    })
    h.seedCatalogForTests({
      artists: [],
      releases: [release],
      tracks: [
        releaseTrack('1', 'Position One'),
        releaseTrack('4', 'Position Four'),
      ],
      ownedItems: [],
      relations: [],
      playlists: [],
    })

    h.render(<h.App />)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Non-contiguous Release',
    })
    await user.click(
      h.within(detailPanel).getByRole('button', { name: 'Edit record' }),
    )
    await user.click(h.screen.getByRole('button', { name: 'Save record' }))

    const savedPanel = h.screen.getByRole('complementary', {
      name: 'Non-contiguous Release',
    })
    expect(
      h.within(savedPanel).getByText('Keep these release notes.'),
    ).toBeInTheDocument()
    const savedTrackCards = h
      .within(h.detailSection(savedPanel, 'Tracks'))
      .getAllByRole('article')
    expect(savedTrackCards).toHaveLength(2)
    expect(
      h.within(savedTrackCards[0]).getByRole('link', { name: 'Position One' }),
    ).toBeInTheDocument()
    expect(savedTrackCards[0]).toHaveTextContent(
      '1 · Position Artist · Unknown duration',
    )
    expect(
      h.within(savedTrackCards[1]).getByRole('link', { name: 'Position Four' }),
    ).toBeInTheDocument()
    expect(savedTrackCards[1]).toHaveTextContent(
      '4 · Position Artist · Unknown duration',
    )
  })

  it('selects a release from the release query parameter', () => {
    window.history.pushState({}, '', '/releases?release=blue-monday')

    h.render(<h.App />)

    expect(
      h.screen.getByRole('complementary', { name: 'Blue Monday' }),
    ).toBeInTheDocument()
    expect(h.screen.getByRole('row', { name: /blue monday/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it.each([
    ['/artists?artist=the-dfa', 'The DFA', /the dfa/i],
    ['/tracks?track=blue-monday', 'Blue Monday', /blue monday/i],
    [
      '/owned-items?ownedItem=blue-monday-vinyl',
      'Blue Monday vinyl',
      /blue monday vinyl/i,
    ],
    [
      '/relations?relation=the-dfa-lcd-soundsystem',
      'The DFA to LCD Soundsystem',
      /the dfa lcd soundsystem/i,
    ],
    [
      '/playlists?playlist=needs-digitization-physical',
      'Needs digitization physical',
      /needs digitization physical/i,
    ],
  ])('selects catalog detail from %s', (path, detailName, rowName) => {
    window.history.pushState({}, '', path)

    h.render(<h.App />)
    const selectedRecordRole = path.startsWith('/artists')
      ? 'button'
      : path.startsWith('/tracks')
        ? 'listitem'
        : 'row'
    const selectedAttribute = path.startsWith('/artists')
      ? 'aria-pressed'
      : path.startsWith('/tracks')
        ? 'aria-current'
        : 'aria-selected'

    expect(
      h.screen.getByRole('complementary', { name: detailName }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole(selectedRecordRole, { name: rowName }),
    ).toHaveAttribute(selectedAttribute, 'true')
  })

  it.each([
    ['/artists?artist=missing', 'Aphex Twin'],
    ['/releases?release=missing', 'Selected Ambient Works 85-92'],
    ['/tracks?track=missing', 'Polynomial-C'],
    ['/owned-items?ownedItem=missing', 'Selected Ambient Works CD'],
    ['/relations?relation=missing', 'Richard D. James to Aphex Twin'],
    ['/playlists?playlist=missing', 'Late night lossless shelf'],
  ])('falls back safely for invalid deep links at %s', (path, detailName) => {
    window.history.pushState({}, '', path)

    h.render(<h.App />)

    expect(
      h.screen.getByRole('complementary', { name: detailName }),
    ).toBeInTheDocument()
  })

  it.each([
    ['/artists', /the dfa/i, 'artist', 'the-dfa'],
    ['/releases', /blue monday/i, 'release', 'blue-monday'],
    ['/tracks', /blue monday/i, 'track', 'blue-monday'],
    ['/owned-items', /blue monday vinyl/i, 'ownedItem', 'blue-monday-vinyl'],
    [
      '/relations',
      /the dfa lcd soundsystem/i,
      'relation',
      'the-dfa-lcd-soundsystem',
    ],
    [
      '/playlists',
      /needs digitization physical/i,
      'playlist',
      'needs-digitization-physical',
    ],
  ])(
    'updates the URL query when selecting a row in %s',
    async (path, rowName, queryParam, id) => {
      window.history.pushState({}, '', path)
      const user = h.userEvent.setup()
      h.render(<h.App />)

      await user.click(h.screen.getByRole('button', { name: rowName }))

      expect(window.location.pathname).toBe(path)
      expect(new URLSearchParams(window.location.search).get(queryParam)).toBe(
        id,
      )
    },
  )
})
