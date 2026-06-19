import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App owned item workspace', () => {
  it('loads owned items into the editable workspace by default', async () => {
    window.history.pushState({}, '', '/owned-items')
    h.clearCatalogForTests()
    const fetchMock = h.vi.fn<Window['fetch']>(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      await Promise.resolve()

      if (url.startsWith('/api/releases?')) {
        return h.jsonResponse({
          items: [
            {
              id: 'release-blue-monday',
              title: 'Blue Monday',
              type: 'single',
              year: 1983,
              releaseDate: null,
              genres: [],
              tags: [],
              artistCredits: [],
              labels: [],
              tracklist: [],
            },
          ],
          limit: 100,
          offset: 0,
          total: 1,
        })
      }
      if (url.startsWith('/api/owned-items?')) {
        return h.jsonResponse({
          items: [
            {
              id: 'owned-blue-monday-vinyl',
              releaseId: 'release-blue-monday',
              release: {
                id: 'release-blue-monday',
                title: 'Blue Monday',
              },
              status: 'owned',
              medium: {
                type: 'vinyl',
                description: 'Vinyl',
                discCount: null,
              },
              details: {
                vinyl: {
                  formatDescription: 'Vinyl',
                  condition: 'veryGood',
                  storageLocation: 'Shelf A3',
                },
              },
              inventorySignals: ['physicalWithoutDigital'],
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

    h.render(<h.App />)

    expect(
      await h.screen.findByRole('heading', { name: 'Owned item records' }),
    ).toBeInTheDocument()
    expect(
      await h.screen.findByRole('complementary', { name: 'Blue Monday' }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('button', { name: 'Edit record' }),
    ).toBeInTheDocument()

    const urls = requestUrls(fetchMock)
    expect(urls).toContain('/api/owned-items?limit=100&offset=0')
    expect(urls.some((url) => url.startsWith('/api/releases?'))).toBe(true)
    expect(urls.some((url) => url.startsWith('/api/tracks?'))).toBe(true)
  })

  it('renders release target links and related tracks from owned item summaries', async () => {
    window.history.pushState({}, '', '/owned-items')
    h.seedCatalogForTests({
      artists: [],
      labels: [],
      releases: [
        {
          id: 'release-blue-monday',
          title: 'Blue Monday',
          artist: 'New Order',
          type: 'Single',
          year: '1983',
          label: 'Factory',
          labels: [],
          genres: [],
          tags: [],
          releaseNotes: 'Test release.',
          ownedCopies: [],
        },
        {
          id: 'release-movement',
          title: 'Movement',
          artist: 'New Order',
          type: 'Album',
          year: '1981',
          label: 'Factory',
          labels: [],
          genres: [],
          tags: [],
          releaseNotes: 'Test release.',
          ownedCopies: [],
        },
      ],
      tracks: [
        {
          id: 'track-ceremony',
          title: 'Ceremony',
          artist: 'New Order',
          release: {
            id: 'release-movement',
            title: 'Movement',
            artist: 'New Order',
            year: '1981',
            label: 'Factory',
          },
          trackNumber: 'A1',
          duration: '4:23',
          relationHint: 'Appears on Movement.',
          credits: [],
          releaseAppearances: [],
          relations: [],
          tags: [],
          digitalFiles: [
            {
              digitalTrackFileLinkId: 'link-ceremony-file',
              localAudioFileId: 'local-ceremony-file',
              digitalOwnedItemId: 'owned-ceremony-file',
              releaseId: 'release-movement',
              releaseTitle: 'Movement',
              releaseTrackId: 'release-track-ceremony',
              position: 'A1',
              path: '/music/new-order/ceremony.mp3',
              format: 'MP3',
              codec: 'MP3',
              quality: 'Lossy',
              contentHash: 'abc123',
              duration: '4:23',
              bitrate: '320 kbps',
              sampleRate: '44.1 kHz',
              channels: 'Stereo',
            },
          ],
        },
      ],
      ownedItems: [
        {
          id: 'owned-blue-monday-vinyl',
          title: 'Blue Monday',
          releaseId: 'release-blue-monday',
          releaseTitle: 'Blue Monday',
          artist: 'New Order',
          medium: 'Vinyl',
          status: 'Needs digitization',
          statusTone: 'amber',
          storage: 'Shelf A3',
          condition: 'Very Good',
          acquisition: 'Personal collection',
          copyNotes: '12-inch copy.',
          linkedType: 'Release',
          fileFormat: 'None recorded',
          digitalState: 'No verified local file',
          digitizationState: 'Needs digitization',
          tags: [],
        },
        {
          id: 'owned-ceremony-file',
          title: 'Movement digital files',
          targetType: 'Release',
          targetId: 'release-movement',
          target: {
            type: 'Release',
            id: 'release-movement',
            title: 'Movement',
            subtitle: 'New Order',
            releaseId: 'release-movement',
            releaseTitle: 'Movement',
          },
          releaseId: 'release-movement',
          releaseTitle: 'Movement',
          artist: 'New Order',
          medium: 'Digital',
          status: 'Owned',
          statusTone: 'green',
          storage: 'Digital library',
          condition: 'Digital file',
          acquisition: 'Personal collection',
          copyNotes: 'MP3 copy.',
          linkedType: 'Release',
          fileFormat: 'MP3',
          digitalState: 'Verified local file',
          digitizationState: 'Digital copy',
          tags: [],
        },
      ],
      relations: [],
      playlists: [],
    })
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

    await user.click(
      h.screen.getByRole('button', { name: /movement digital files/i }),
    )

    const digitalPanel = h.screen.getByRole('complementary', {
      name: 'Movement digital files',
    })
    expect(
      h
        .within(h.detailSection(digitalPanel, 'Linked catalog item'))
        .getByRole('link', { name: 'Movement' }),
    ).toHaveAttribute('href', '/releases?release=release-movement')
    expect(
      h
        .within(h.detailSection(digitalPanel, 'Related tracks'))
        .getByRole('link', { name: 'Ceremony' }),
    ).toHaveAttribute('href', '/tracks?track=track-ceremony')
  })
})

function requestUrls(fetchMock: ReturnType<typeof h.mockFetch>) {
  return fetchMock.mock.calls.map(([input]) =>
    typeof input === 'string' ? input : (input as Request).url,
  )
}
