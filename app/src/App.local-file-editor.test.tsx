import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App local track file editor', () => {
  it('hides local edit actions in browser mode', () => {
    window.history.pushState({}, '', '/tracks?track=polynomial-c')

    h.render(<h.App />)

    expect(
      h.screen.queryByRole('button', { name: 'Edit local file' }),
    ).not.toBeInTheDocument()
  })

  it('validates and applies desktop track local file edits', async () => {
    window.history.pushState({}, '', '/tracks?track=polynomial-c')
    const user = h.userEvent.setup()
    const originalDesktopBridge = window.discweaveDesktop
    const targetPath =
      '/archive/aphex-twin/selected-ambient-works-85-92/03 Polynomial-C.flac'
    const validationConflict = {
      ownedItemId: 'owned-polynomial-c-file',
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
            ownedItemId: 'owned-polynomial-c-file',
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

      return Promise.resolve(h.jsonResponse({ id: 'owned-polynomial-c-file' }))
    })
    h.vi.stubGlobal('fetch', fetchMock)
    window.discweaveDesktop = {
      isDesktop: true,
      exports: { download: h.vi.fn() },
      imports: { pickAndScan: h.vi.fn() },
      localEdits: { inspect, preview, apply },
    }

    h.render(<h.App />)
    await user.click(h.screen.getByRole('button', { name: 'Edit local file' }))

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
          ownedItemId: 'owned-polynomial-c-file',
          targetPath,
        }),
      ],
    })
    expect(preview).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/owned-items/owned-polynomial-c-file/digital-file',
      expect.objectContaining({
        method: 'PATCH',
      }),
    )
    const patchCall = fetchMock.mock.calls.find(
      ([url]) =>
        typeof url === 'string' &&
        url === '/api/owned-items/owned-polynomial-c-file/digital-file',
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

  it('reconciles catalog metadata for files updated before a local edit failure', async () => {
    window.history.pushState({}, '', '/tracks?track=polynomial-c')
    const user = h.userEvent.setup()
    const originalDesktopBridge = window.discweaveDesktop
    const currentPath =
      '/archive/aphex-twin/selected-ambient-works-85-92/03-polynomial-c.flac'
    const targetPath =
      '/archive/aphex-twin/selected-ambient-works-85-92/03 Polynomial-C.flac'
    const inspect = h.vi.fn().mockResolvedValue({
      path: currentPath,
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
    const apply = h.vi.fn().mockResolvedValue({
      applied: false,
      operationLogPath: '/Users/example/Library/DiscWeave/partial-log.json',
      changes: [
        {
          ownedItemId: 'owned-polynomial-c-file',
          currentPath,
          targetPath,
          format: 'flac',
          rename: true,
          tagWritable: true,
          tagChanges: {},
          issues: [],
        },
        {
          ownedItemId: 'owned-failed-file',
          currentPath: '/archive/aphex-twin/failing.flac',
          targetPath: '/archive/aphex-twin/blocked/failing.flac',
          format: 'flac',
          rename: true,
          tagWritable: true,
          tagChanges: {},
          issues: [
            {
              code: 'local_edit_failed',
              message: 'Local edit failed',
              severity: 'error',
            },
          ],
        },
      ],
      files: [
        {
          ownedItemId: 'owned-polynomial-c-file',
          path: targetPath,
          format: 'flac',
          sizeBytes: 123,
          lastModifiedAt: '2026-05-29T09:16:00.000Z',
          contentHash: 'abc123',
        },
      ],
      failedFile: {
        ownedItemId: 'owned-failed-file',
      },
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

      return Promise.resolve(h.jsonResponse({ id: 'owned-polynomial-c-file' }))
    })
    h.vi.stubGlobal('fetch', fetchMock)
    window.discweaveDesktop = {
      isDesktop: true,
      exports: { download: h.vi.fn() },
      imports: { pickAndScan: h.vi.fn() },
      localEdits: { inspect, preview: h.vi.fn(), apply },
    }

    h.render(<h.App />)
    await user.click(h.screen.getByRole('button', { name: 'Edit local file' }))

    const editor = h.screen.getByRole('region', { name: 'Local file editor' })
    await h.within(editor).findByText('Embedded Polynomial-C')
    await user.clear(h.within(editor).getByLabelText('Target path'))
    await user.type(h.within(editor).getByLabelText('Target path'), targetPath)
    await user.click(
      h.within(editor).getByRole('button', { name: 'Apply file names' }),
    )

    expect(
      await h.within(editor).findByText(/1 file updated, 1 failed/i),
    ).toBeVisible()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/owned-items/owned-polynomial-c-file/digital-file',
      expect.objectContaining({
        method: 'PATCH',
      }),
    )

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
    await user.click(h.screen.getByRole('button', { name: 'Edit local file' }))

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
          fileMetadata: {
            ...baseTrack.fileMetadata,
            ownedItemId: 'owned-xtal-file',
            path: '/archive/aphex-twin/selected-ambient-works-85-92/01-xtal.flac',
            checksum: 'sha256: sample-xtal',
          },
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
      h.within(detailPanel).getByRole('button', { name: 'Local files' }),
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
    window.discweaveDesktop = {
      isDesktop: true,
      exports: { download: h.vi.fn() },
      imports: { pickAndScan: h.vi.fn() },
      localEdits: {
        inspect: h.vi.fn().mockResolvedValue({
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
        }),
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
          release: {
            ...baseTrack.release,
            catalogNumber: 'WARP LP 1',
            releaseDate: '1992-02-12',
          },
          trackNumber: '1',
          duration: '04:54',
          fileMetadata: {
            ...baseTrack.fileMetadata,
            ownedItemId: 'owned-xtal-file',
            path: '/archive/aphex-twin/selected-ambient-works-85-92/01-xtal.flac',
            checksum: 'sha256: sample-xtal',
          },
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
      h.within(detailPanel).getByRole('button', { name: 'Local files' }),
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

    window.discweaveDesktop = originalDesktopBridge
  })
})
