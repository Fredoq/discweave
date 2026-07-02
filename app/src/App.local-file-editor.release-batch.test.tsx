import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App release local file editor', () => {
  it('shows release batch local files action in desktop mode', () => {
    window.history.pushState(
      {},
      '',
      '/releases?release=selected-ambient-works-85-92',
    )
    const originalDesktopBridge = window.discweaveDesktop
    window.discweaveDesktop = {
      isDesktop: true,
      exports: { download: h.vi.fn() },
      imports: { pickAndScan: h.vi.fn() },
      localEdits: {
        inspect: h.vi.fn(),
        preview: h.vi.fn(),
        apply: h.vi.fn(),
      },
    }
    const baseTrack = h.trackRecords.find(
      (track) => track.id === 'polynomial-c',
    )
    if (!baseTrack) {
      throw new Error('Missing Polynomial-C fixture track')
    }
    h.seedCatalogForTests({
      artists: h.artistRecords,
      releases: h.releaseRecords,
      tracks: [
        ...h.trackRecords.map((track) =>
          track.id === 'polynomial-c'
            ? {
                ...track,
                release: {
                  ...track.release,
                  catalogNumber: 'WARP LP 1',
                  releaseDate: '1992-02-12',
                },
              }
            : track,
        ),
        {
          ...baseTrack,
          id: 'xtal-local-file',
          title: 'Xtal',
          trackNumber: '1',
          duration: '04:54',
          digitalFiles: [
            {
              ...baseTrack.digitalFiles[0],
              digitalTrackFileLinkId: 'link-xtal-file',
              localAudioFileId: 'local-xtal-file',
              digitalOwnedItemId: 'owned-xtal-file',
              releaseTrackId: 'release-track-xtal',
              position: '1',
              path: '/archive/aphex-twin/selected-ambient-works-85-92/01-xtal.flac',
              contentHash: 'sha256: sample-xtal',
            },
          ],
          releaseAppearances: baseTrack.releaseAppearances.map(
            (appearance) => ({
              ...appearance,
              position: '1',
              duration: '04:54',
            }),
          ),
        },
      ],
      ownedItems: h.ownedItemRecords,
      relations: h.relationRecords,
      playlists: h.playlistRecords,
    })

    h.render(<h.App />)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Selected Ambient Works 85-92',
    })
    expect(
      h.within(detailPanel).getByRole('button', { name: 'Edit local files' }),
    ).toBeVisible()

    window.discweaveDesktop = originalDesktopBridge
  })

  it('opens release batch editor with one release folder target and proposed track changes', async () => {
    window.history.pushState(
      {},
      '',
      '/releases?release=selected-ambient-works-85-92',
    )
    const user = h.userEvent.setup()
    const originalDesktopBridge = window.discweaveDesktop
    h.vi.stubGlobal(
      'fetch',
      h.vi.fn<Window['fetch']>().mockResolvedValue(
        h.jsonResponse({
          items: [
            {
              id: 'profile-default',
              name: 'DiscWeave default',
              releaseFolderTemplate:
                '[{catalogNumber}, {releaseDate}] {releaseArtists} - {title}',
              trackFileTemplate: '{position2} {title}',
              trackFileWithArtistTemplate:
                '{position2} {trackArtists} - {title}',
              sortOrder: 10,
              isDefault: true,
              isActive: true,
              isBuiltin: true,
            },
          ],
          limit: 1,
          offset: 0,
          total: 1,
        }),
      ),
    )
    const inspect = h.vi.fn().mockResolvedValue({
      path: '/music/example.flac',
      format: 'flac',
      sizeBytes: 100,
      lastModifiedAt: '2026-05-29T09:15:00.000Z',
      tags: { title: 'Embedded title', artists: ['The Orb'] },
      technical: {
        bitDepth: 24,
        durationSeconds: 284,
        sampleRate: 96000,
      },
    })
    window.discweaveDesktop = {
      isDesktop: true,
      exports: { download: h.vi.fn() },
      imports: { pickAndScan: h.vi.fn() },
      localEdits: {
        inspect,
        preview: h.vi.fn(),
        apply: h.vi.fn(),
      },
    }
    const baseTrack = h.trackRecords.find(
      (track) => track.id === 'polynomial-c',
    )
    if (!baseTrack) {
      throw new Error('Missing Polynomial-C fixture track')
    }
    h.seedCatalogForTests({
      artists: h.artistRecords,
      releases: h.releaseRecords,
      tracks: [
        ...h.trackRecords.map((track) =>
          track.id === 'polynomial-c'
            ? {
                ...track,
                release: {
                  ...track.release,
                  catalogNumber: 'WARP LP 1',
                  releaseDate: '1992-02-12',
                },
                digitalFiles: [
                  {
                    ...track.digitalFiles[0],
                    digitalTrackFileLinkId:
                      'link-polynomial-other-release-file',
                    localAudioFileId: 'local-polynomial-other-release-file',
                    digitalOwnedItemId: 'owned-polynomial-other-release-file',
                    releaseId: 'analogue-bubblebath',
                    releaseTitle: 'Analogue Bubblebath',
                    releaseTrackId: 'release-track-polynomial-other-release',
                    position: '3',
                    path: '/archive/aphex-twin/analogue-bubblebath/03-polynomial-c.flac',
                    contentHash: 'sha256: sample-polynomial-other',
                  },
                  {
                    ...track.digitalFiles[0],
                    digitalTrackFileLinkId:
                      'link-polynomial-selected-release-file',
                    localAudioFileId: 'local-polynomial-selected-release-file',
                    digitalOwnedItemId:
                      'owned-polynomial-selected-release-file',
                    releaseId: 'selected-ambient-works-85-92',
                    releaseTitle: 'Selected Ambient Works 85-92',
                    releaseTrackId: 'release-track-polynomial-c',
                    position: '3',
                    path: '/archive/aphex-twin/selected-ambient-works-85-92/03-polynomial-c.flac',
                    contentHash: 'sha256: sample-polynomial-selected',
                  },
                ],
              }
            : track,
        ),
        {
          ...baseTrack,
          id: 'xtal-local-file',
          title: 'Xtal',
          release: {
            ...baseTrack.release,
            catalogNumber: 'WARP LP 1',
            releaseDate: '1992-02-12',
          },
          trackNumber: '1',
          duration: '04:54',
          digitalFiles: [
            {
              ...baseTrack.digitalFiles[0],
              digitalTrackFileLinkId: 'link-xtal-file',
              localAudioFileId: 'local-xtal-file',
              digitalOwnedItemId: 'owned-xtal-file',
              releaseTrackId: 'release-track-xtal',
              position: '1',
              path: '/archive/aphex-twin/selected-ambient-works-85-92/01-xtal.flac',
              contentHash: 'sha256: sample-xtal',
            },
          ],
          releaseAppearances: baseTrack.releaseAppearances.map(
            (appearance) => ({
              ...appearance,
              position: '1',
              duration: '04:54',
            }),
          ),
        },
      ],
      ownedItems: h.ownedItemRecords,
      relations: h.relationRecords,
      playlists: h.playlistRecords,
    })

    h.render(<h.App />)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Selected Ambient Works 85-92',
    })
    await user.click(
      h.within(detailPanel).getByRole('button', { name: 'Edit local files' }),
    )

    const editor = h.screen.getByRole('region', { name: 'Local file editor' })
    expect(
      await h.within(editor).findByRole('combobox', { name: 'Naming profile' }),
    ).toBeVisible()
    expect(h.within(editor).getByLabelText('New release folder')).toBeVisible()
    expect(h.within(editor).getByLabelText('New release folder')).toHaveValue(
      '/archive/aphex-twin/[WARP LP 1, 1992-02-12] Aphex Twin - Selected Ambient Works 85-92',
    )
    expect(h.within(editor).getByText('Current release folder')).toBeVisible()
    expect(h.within(editor).getByText('Track file template')).toBeVisible()
    expect(h.within(editor).getByText('Metadata')).toBeVisible()
    expect(
      h.within(editor).getAllByText('Writable tags').length,
    ).toBeGreaterThan(0)
    expect(
      h.within(editor).getByText('01 Richard D. James, Aphex Twin - Xtal.flac'),
    ).toBeVisible()
    expect(
      h.within(editor).getByRole('region', { name: 'Proposed changes' }),
    ).toBeVisible()
    expect(
      h.within(editor).queryByLabelText(/target path/i),
    ).not.toBeInTheDocument()
    expect(
      h.within(editor).queryByRole('button', { name: 'Preview' }),
    ).not.toBeInTheDocument()
    await h.waitFor(() =>
      expect(inspect).toHaveBeenCalledWith(
        expect.objectContaining({
          localAudioFileId: 'local-polynomial-selected-release-file',
          path: '/archive/aphex-twin/selected-ambient-works-85-92/03-polynomial-c.flac',
        }),
      ),
    )

    window.discweaveDesktop = originalDesktopBridge
  })
})
