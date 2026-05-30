import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App owned item workspace', () => {
  it('loads owned item inventory through the paged server endpoint by default', async () => {
    window.history.pushState({}, '', '/owned-items')
    h.clearCatalogForTests()
    const fetchMock = h.mockFetch(h.emptyCatalogListResponse())

    h.render(<h.App />)

    expect(
      await h.screen.findByRole('heading', { name: 'Owned item inventory' }),
    ).toBeInTheDocument()

    const urls = requestUrls(fetchMock)
    expect(urls).toContain('/api/owned-items?limit=100&offset=0')
    expect(urls.some((url) => url.startsWith('/api/releases?'))).toBe(false)
    expect(urls.some((url) => url.startsWith('/api/tracks?'))).toBe(false)
  })

  it('renders release and track target links from owned item summaries', async () => {
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
          versionHint: 'Album version',
          relationHint: 'Appears on Movement.',
          credits: [],
          releaseAppearances: [],
          relations: [],
          tags: [],
          fileMetadata: {
            format: 'MP3',
            path: '/music/new-order/ceremony.mp3',
            bitrate: '320 kbps',
            sampleRate: '44.1 kHz',
            channels: 'Stereo',
            importedAt: '2026-05-29',
            checksum: 'abc123',
          },
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
          title: 'Ceremony',
          targetType: 'Track',
          targetId: 'track-ceremony',
          target: {
            type: 'Track',
            id: 'track-ceremony',
            title: 'Ceremony',
            subtitle: 'Movement',
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
          linkedType: 'Track',
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

    await user.click(h.screen.getByRole('button', { name: /ceremony/i }))

    const trackPanel = h.screen.getByRole('complementary', {
      name: 'Ceremony',
    })
    expect(
      h
        .within(h.detailSection(trackPanel, 'Linked catalog item'))
        .getByText('Movement'),
    ).toBeInTheDocument()
    expect(
      h
        .within(h.detailSection(trackPanel, 'Linked catalog item'))
        .getByText('Movement'),
    ).toBeInTheDocument()
  })
})

function requestUrls(fetchMock: ReturnType<typeof h.mockFetch>) {
  return fetchMock.mock.calls.map(([input]) =>
    typeof input === 'string' ? input : (input as Request).url,
  )
}
