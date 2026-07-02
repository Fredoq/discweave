import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'
import {
  listResponse,
  requestUrls,
  trackResponse,
} from './test/trackStacksTestFixtures'

h.setupAppTestHooks()

describe('App local file open', () => {
  it('opens a selected track single local file from the detail action and double-click', async () => {
    window.history.pushState({}, '', '/tracks?track=polynomial-c')
    const user = h.userEvent.setup()
    const originalDesktopBridge = window.discweaveDesktop
    const open = h.vi.fn().mockResolvedValue({
      ok: true,
      path: '/archive/aphex-twin/selected-ambient-works-85-92/03-polynomial-c.flac',
    })
    window.discweaveDesktop = desktopBridge(open)

    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Open local file' }))
    expect(open).toHaveBeenCalledWith(
      '/archive/aphex-twin/selected-ambient-works-85-92/03-polynomial-c.flac',
    )

    await user.dblClick(
      h.screen.getByRole('button', { name: /Polynomial-C.*Aphex Twin/i }),
    )
    expect(open).toHaveBeenCalledTimes(2)

    window.discweaveDesktop = originalDesktopBridge
  })

  it('shows a per-file list for a track with multiple files', async () => {
    window.history.pushState({}, '', '/tracks?track=polynomial-c')
    const user = h.userEvent.setup()
    const originalDesktopBridge = window.discweaveDesktop
    window.discweaveDesktop = desktopBridge(h.vi.fn())
    const baseTrack = h.trackRecords.find((track) => track.id === 'polynomial-c')
    if (!baseTrack) {
      throw new Error('Missing Polynomial-C fixture track')
    }
    h.seedCatalogForTests({
      artists: h.artistRecords,
      releases: h.releaseRecords,
      tracks: h.trackRecords.map((track) =>
        track.id === 'polynomial-c'
          ? {
              ...track,
              digitalFiles: [
                track.digitalFiles[0],
                {
                  ...track.digitalFiles[0],
                  digitalTrackFileLinkId: 'link-polynomial-c-reissue',
                  localAudioFileId: 'local-polynomial-c-reissue',
                  releaseId: 'selected-ambient-works-reissue',
                  releaseTitle: 'Selected Ambient Works 85-92 Reissue',
                  releaseTrackId: 'release-track-polynomial-c-reissue',
                  position: 'D1',
                  path: '/archive/aphex-twin/reissue/disc-1-polynomial-c.flac',
                },
              ],
            }
          : track,
      ),
      ownedItems: h.ownedItemRecords,
      relations: h.relationRecords,
      playlists: h.playlistRecords,
    })

    h.render(<h.App />)
    await user.click(h.screen.getByRole('button', { name: 'Open local files' }))

    const panel = h.screen.getByRole('region', { name: 'Track local files' })
    expect(
      h.within(panel).getByText(/Selected Ambient Works 85-92 · Track 3/),
    ).toBeVisible()
    expect(
      h
        .within(panel)
        .getByText(/Selected Ambient Works 85-92 Reissue · Track D1/),
    ).toBeVisible()
    expect(
      h.within(panel).queryByRole('button', { name: /open all/i }),
    ).not.toBeInTheDocument()
    expect(baseTrack.title).toBe('Polynomial-C')

    window.discweaveDesktop = originalDesktopBridge
  })

  it('opens the full stack file list even when filters hide a member', async () => {
    window.history.pushState({}, '', '/tracks')
    const user = h.userEvent.setup()
    const originalDesktopBridge = window.discweaveDesktop
    window.discweaveDesktop = desktopBridge(h.vi.fn())
    h.clearCatalogForTests()
    const fetchMock = h.vi.fn<Window['fetch']>(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      await Promise.resolve()

      if (url.startsWith('/api/tracks/stacks')) {
        return listResponse([
          {
            originalTrackId: 'track-original',
            originalTitle: 'Original Mix',
            originalVersionYear: 1992,
            memberCount: 1,
            hasCycleIssue: false,
            members: [
              {
                trackId: 'track-member',
                title: 'Hidden Dub',
                versionYear: 1993,
                relationType: 'versionOf',
                depth: 1,
                isDirect: true,
              },
            ],
            issues: [],
          },
        ])
      }

      if (url.startsWith('/api/tracks?')) {
        return listResponse([
          {
            ...trackResponse('track-original', 'Original Mix', true),
            digitalFiles: [
              apiDigitalFile(
                'original',
                'track-original',
                'Original Release',
                1,
                '/music/original.flac',
              ),
            ],
          },
          {
            ...trackResponse('track-member', 'Hidden Dub'),
            digitalFiles: [
              apiDigitalFile(
                'member',
                'track-member',
                'Member Release',
                2,
                '/music/hidden-dub.flac',
              ),
            ],
          },
        ])
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
      await h.screen.findByRole('heading', { name: 'Track records' }),
    ).toBeInTheDocument()
    await h.waitFor(() => {
      expect(
        requestUrls(fetchMock).some((url) =>
          url.startsWith('/api/tracks/stacks'),
        ),
      ).toBe(true)
    })
    await user.type(h.screen.getByPlaceholderText(/Title, artist/i), 'Original')
    await user.click(
      h.screen.getByRole('button', {
        name: 'Open stack files for Original Mix',
      }),
    )

    const panel = h.screen.getByRole('region', { name: 'Stack local files' })
    expect(h.within(panel).getByText('Original Mix')).toBeVisible()
    expect(h.within(panel).getByText('Hidden Dub')).toBeVisible()
    expect(
      h.within(panel).queryByRole('button', { name: /open all/i }),
    ).not.toBeInTheDocument()

    window.discweaveDesktop = originalDesktopBridge
  })
})

function apiDigitalFile(
  id: string,
  trackId: string,
  releaseTitle: string,
  position: number,
  path: string,
) {
  return {
    digitalTrackFileLinkId: `link-${id}`,
    localAudioFileId: `local-${id}`,
    digitalOwnedItemId: `owned-${id}`,
    releaseId: `release-${id}`,
    releaseTitle,
    releaseArtist: 'Fixture Artist',
    releaseYear: 1993,
    releaseDate: null,
    releaseLabel: 'Fixture Label',
    releaseCatalogNumber: null,
    releaseTrackId: `release-track-${trackId}`,
    position,
    disc: null,
    side: null,
    path,
    format: 'flac',
    codec: 'FLAC',
    quality: null,
    sizeBytes: null,
    modifiedAt: null,
    contentHash: null,
    durationSeconds: 240,
    bitrateKbps: null,
    sampleRateHz: null,
    channels: null,
  }
}

function desktopBridge(open: ReturnType<typeof h.vi.fn>): Window['discweaveDesktop'] {
  return {
    isDesktop: true,
    exports: { download: h.vi.fn() },
    imports: { pickAndScan: h.vi.fn() },
    localFiles: { open },
  }
}
