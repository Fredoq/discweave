import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App local track file editor', () => {
  it('hides local edit actions in browser mode', () => {
    window.history.pushState({}, '', '/tracks?track=polynomial-c')

    h.render(<h.App />)

    expect(
      h.screen.queryByRole('button', { name: /edit file for/i }),
    ).not.toBeInTheDocument()
  })

  it('validates and applies desktop track local file edits', async () => {
    window.history.pushState({}, '', '/tracks?track=polynomial-c')
    const user = h.userEvent.setup()
    const originalDesktopBridge = window.discweaveDesktop
    const targetPath =
      '/archive/aphex-twin/selected-ambient-works-85-92/03 Polynomial-C.flac'
    const validationConflict = {
      localAudioFileId: 'local-polynomial-c-file',
      currentPath:
        '/archive/aphex-twin/selected-ambient-works-85-92/03-polynomial-c.flac',
      targetPath,
      format: 'flac',
      rename: true,
      tagWritable: true,
      tagChanges: { title: 'Polynomial-C' },
      issues: [
        {
          code: 'target_exists',
          message: 'Target already exists',
          severity: 'error',
        },
      ],
    }
    const inspect = h.vi.fn().mockResolvedValue({
      path: validationConflict.currentPath,
      format: 'flac',
      sizeBytes: 100,
      lastModifiedAt: '2026-05-29T09:15:00.000Z',
      tags: { title: 'Embedded Polynomial-C', artists: ['Aphex Twin'] },
      technical: {
        bitDepth: 16,
        durationSeconds: 284,
        sampleRate: 44100,
      },
    })
    const preview = h.vi.fn()
    const apply = h.vi
      .fn()
      .mockResolvedValueOnce({
        applied: false,
        operationLogPath: null,
        changes: [validationConflict],
        files: [],
      })
      .mockResolvedValueOnce({
        applied: true,
        operationLogPath:
          '/Users/example/Library/DiscWeave/local-edit-log.json',
        files: [
          {
            localAudioFileId: 'local-polynomial-c-file',
            path: targetPath,
            format: 'flac',
            sizeBytes: 123,
            lastModifiedAt: '2026-05-29T09:16:00.000Z',
            contentHash: 'abc123',
          },
        ],
      })
    const fetchMock = h.vi.fn<Window['fetch']>().mockImplementation((input) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url
      if (url.startsWith('/api/settings/naming-profiles')) {
        return Promise.resolve(
          h.jsonResponse({
            items: [
              {
                id: 'profile-default',
                name: 'DiscWeave default',
                releaseFolderTemplate: '{releaseArtists} - {title} ({year})',
                trackFileTemplate: '{position} - {title}',
                trackFileWithArtistTemplate:
                  '{position} - {trackArtists} - {title}',
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
        )
      }

      return Promise.resolve(h.jsonResponse({ id: 'local-polynomial-c-file' }))
    })
    h.vi.stubGlobal('fetch', fetchMock)
    window.discweaveDesktop = {
      isDesktop: true,
      exports: { download: h.vi.fn() },
      imports: { pickAndScan: h.vi.fn() },
      localEdits: { inspect, preview, apply },
    }

    h.render(<h.App />)
    await user.click(
      h.screen.getByRole('button', {
        name: /edit file for selected ambient works 85-92 track 3/i,
      }),
    )

    const editor = h.screen.getByRole('region', { name: 'Local file editor' })
    expect(
      await h.within(editor).findByText('Embedded Polynomial-C'),
    ).toBeInTheDocument()
    await user.clear(h.within(editor).getByLabelText('Target path'))
    await user.type(h.within(editor).getByLabelText('Target path'), targetPath)
    await user.click(
      h.within(editor).getByRole('button', { name: 'Apply file names' }),
    )
    expect(
      await h.within(editor).findByText((_content, element) => {
        return (
          element?.tagName === 'LI' &&
          Boolean(element.textContent?.includes('Target already exists'))
        )
      }),
    ).toBeVisible()

    await user.click(
      h.within(editor).getByRole('button', { name: 'Apply file names' }),
    )

    expect(
      await h.within(editor).findByText(/local edit applied/i),
    ).toBeVisible()
    expect(apply).toHaveBeenCalledWith({
      files: [
        expect.objectContaining({
          localAudioFileId: 'local-polynomial-c-file',
          targetPath,
        }),
      ],
    })
    expect(preview).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/local-audio-files/local-polynomial-c-file',
      expect.objectContaining({
        method: 'PATCH',
      }),
    )
    const patchCall = fetchMock.mock.calls.find(
      ([url]) =>
        typeof url === 'string' &&
        url === '/api/local-audio-files/local-polynomial-c-file',
    )
    const patchBody = patchCall?.[1]?.body
    expect(typeof patchBody).toBe('string')
    expect(JSON.parse(patchBody as string)).toMatchObject({
      path: targetPath,
      format: 'flac',
      sizeBytes: 123,
      contentHash: 'abc123',
    })

    window.discweaveDesktop = originalDesktopBridge
  })

  it('opens the local file editor for the selected track file row', async () => {
    window.history.pushState({}, '', '/tracks?track=polynomial-c')
    const user = h.userEvent.setup()
    const originalDesktopBridge = window.discweaveDesktop
    const baseTrack = h.trackRecords.find(
      (track) => track.id === 'polynomial-c',
    )
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
                baseTrack.digitalFiles[0],
                {
                  ...baseTrack.digitalFiles[0],
                  digitalTrackFileLinkId: 'link-reissue-file',
                  localAudioFileId: 'local-reissue-file',
                  releaseId: 'selected-ambient-works-reissue',
                  releaseTitle: 'Selected Ambient Works 85-92 Reissue',
                  releaseTrackId: 'release-track-reissue-polynomial-c',
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
    const inspect = h.vi.fn().mockResolvedValue({
      path: '/archive/aphex-twin/reissue/disc-1-polynomial-c.flac',
      format: 'flac',
      sizeBytes: 100,
      lastModifiedAt: '2026-05-29T09:15:00.000Z',
      tags: { title: 'Embedded Polynomial-C', artists: ['Aphex Twin'] },
      technical: {
        bitDepth: 16,
        durationSeconds: 284,
        sampleRate: 44100,
      },
    })
    h.vi.stubGlobal(
      'fetch',
      h.vi.fn<Window['fetch']>().mockResolvedValue(
        h.jsonResponse({
          items: [],
          limit: 0,
          offset: 0,
          total: 0,
        }),
      ),
    )
    window.discweaveDesktop = {
      isDesktop: true,
      exports: { download: h.vi.fn() },
      imports: { pickAndScan: h.vi.fn() },
      localEdits: { inspect, preview: h.vi.fn(), apply: h.vi.fn() },
    }

    h.render(<h.App />)
    await user.click(
      h.screen.getByRole('button', {
        name: /edit file for selected ambient works 85-92 reissue track d1/i,
      }),
    )

    expect(inspect).toHaveBeenCalledWith({
      localAudioFileId: 'local-reissue-file',
      path: '/archive/aphex-twin/reissue/disc-1-polynomial-c.flac',
    })
    const editor = h.screen.getByRole('region', { name: 'Local file editor' })
    expect(
      await h.within(editor).findByText('Embedded Polynomial-C'),
    ).toBeVisible()

    window.discweaveDesktop = originalDesktopBridge
  })

  it('shows naming profile proposed rows and disables apply when paths are unchanged', async () => {
    window.history.pushState({}, '', '/tracks?track=polynomial-c')
    const user = h.userEvent.setup()
    const targetPath =
      '/archive/aphex-twin/Aphex Twin - Selected Ambient Works 85-92 (1992)/3 - Richard D. James, Aphex Twin - Polynomial-C.flac'
    const inspect = h.vi.fn().mockResolvedValue({
      path: '/archive/aphex-twin/selected-ambient-works-85-92/03-polynomial-c.flac',
      format: 'flac',
      sizeBytes: 100,
      lastModifiedAt: '2026-05-29T09:15:00.000Z',
      tags: { title: 'Embedded Polynomial-C', artists: ['Aphex Twin'] },
      technical: {
        bitDepth: 16,
        durationSeconds: 284,
        sampleRate: 44100,
      },
    })
    const preview = h.vi.fn()
    const apply = h.vi.fn()
    h.vi.stubGlobal(
      'fetch',
      h.vi.fn<Window['fetch']>().mockResolvedValue(
        h.jsonResponse({
          items: [
            {
              id: 'profile-default',
              name: 'DiscWeave default',
              releaseFolderTemplate: '{releaseArtists} - {title} ({year})',
              trackFileTemplate: '{position} - {title}',
              trackFileWithArtistTemplate:
                '{position} - {trackArtists} - {title}',
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
    window.discweaveDesktop = {
      isDesktop: true,
      exports: { download: h.vi.fn() },
      imports: { pickAndScan: h.vi.fn() },
      localEdits: { inspect, preview, apply },
    }

    h.render(<h.App />)
    await user.click(
      h.screen.getByRole('button', {
        name: /edit file for selected ambient works 85-92 track 3/i,
      }),
    )

    const editor = h.screen.getByRole('region', { name: 'Local file editor' })
    await h.within(editor).findByRole('combobox', { name: 'Naming profile' })
    expect(h.within(editor).getByLabelText('Target path')).toHaveValue(
      targetPath,
    )
    expect(await h.within(editor).findByText('Will rename')).toBeVisible()
    expect(await h.within(editor).findByText('Current file name')).toBeVisible()
    expect(await h.within(editor).findByText('New file name')).toBeVisible()

    await user.clear(h.within(editor).getByLabelText('Target path'))
    await user.type(
      h.within(editor).getByLabelText('Target path'),
      '/archive/aphex-twin/selected-ambient-works-85-92/03-polynomial-c.flac',
    )

    expect(
      await h
        .within(editor)
        .findByText('No file name changes for the selected profile.'),
    ).toBeVisible()
    expect(
      h.within(editor).getByRole('button', { name: 'Apply file names' }),
    ).toBeDisabled()
    expect(preview).not.toHaveBeenCalled()
  })
})
