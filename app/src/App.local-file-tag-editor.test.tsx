import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

type LocalEditsBridge = NonNullable<
  NonNullable<Window['discweaveDesktop']>['localEdits']
>

describe('App local track tag editor', () => {
  it('edits desktop track tags without renaming the local file', async () => {
    window.history.pushState({}, '', '/tracks?track=polynomial-c')
    const user = h.userEvent.setup()
    const originalDesktopBridge = window.discweaveDesktop
    const currentPath =
      '/archive/aphex-twin/selected-ambient-works-85-92/03-polynomial-c.flac'
    const inspect = h.vi.fn<LocalEditsBridge['inspect']>().mockResolvedValue({
      path: currentPath,
      format: 'flac',
      sizeBytes: 100,
      lastModifiedAt: '2026-05-29T09:15:00.000Z',
      tags: {
        title: 'Embedded Polynomial-C',
        artists: ['Aphex Twin'],
        album: 'Old album',
        comment: 'Original comment',
      },
      technical: {
        bitDepth: 16,
        durationSeconds: 284,
        sampleRate: 44100,
      },
    })
    const apply = h.vi.fn<LocalEditsBridge['apply']>().mockResolvedValue({
      applied: true,
      operationLogPath: '/Users/example/Library/DiscWeave/local-edit-log.json',
      files: [
        {
          ownedItemId: 'owned-polynomial-c-file',
          path: currentPath,
          format: 'flac',
          sizeBytes: 125,
          lastModifiedAt: '2026-05-29T09:17:00.000Z',
          contentHash: 'taghash',
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

      if (url.startsWith('/api/settings/tag-role-mappings')) {
        return Promise.resolve(
          h.jsonResponse({
            items: [
              {
                id: 'tag-role-mapping:composer',
                creditRoleCode: 'composer',
                tagField: 'composer',
                sortOrder: 50,
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
    await user.click(h.within(editor).getByRole('tab', { name: 'Tags' }))
    expect(
      await h.within(editor).findByRole('region', {
        name: 'Current embedded tags',
      }),
    ).toBeVisible()
    expect(
      h.within(editor).getByRole('region', { name: 'New file tags' }),
    ).toBeVisible()

    await user.clear(h.within(editor).getByLabelText('New Title'))
    await user.type(
      h.within(editor).getByLabelText('New Title'),
      'Polynomial-C (Edited)',
    )
    await user.clear(h.within(editor).getByLabelText('New Comment'))
    await user.type(
      h.within(editor).getByLabelText('New Comment'),
      'Reviewed local file',
    )
    await user.click(
      h.within(editor).getByRole('button', { name: 'Apply tags' }),
    )

    expect(apply).toHaveBeenCalledTimes(1)
    const applyRequest = apply.mock.calls[0]?.[0]
    expect(applyRequest?.files[0]).toMatchObject({
      ownedItemId: 'owned-polynomial-c-file',
      currentPath,
      targetPath: currentPath,
    })
    expect(applyRequest?.files[0]?.tags?.title).toBe('Polynomial-C (Edited)')
    expect(applyRequest?.files[0]?.tags?.comment).toBe('Reviewed local file')
    await h.waitFor(() =>
      expect(
        h.within(editor).getByRole('button', { name: 'Apply tags' }),
      ).toBeDisabled(),
    )
    expect(
      h
        .within(
          h
            .within(editor)
            .getByRole('region', { name: 'Current embedded tags' }),
        )
        .getByText('Polynomial-C (Edited)'),
    ).toBeVisible()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/owned-items/owned-polynomial-c-file/digital-file',
      expect.objectContaining({
        method: 'PATCH',
      }),
    )

    window.discweaveDesktop = originalDesktopBridge
  })

  it('shows read-only tag editing state for unsupported local formats', async () => {
    window.history.pushState({}, '', '/tracks?track=polynomial-c')
    const user = h.userEvent.setup()
    const originalDesktopBridge = window.discweaveDesktop
    const wavPath =
      '/archive/aphex-twin/selected-ambient-works-85-92/03-polynomial-c.wav'
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
              fileMetadata: {
                ...baseTrack.fileMetadata,
                path: wavPath,
              },
            }
          : track,
      ),
      ownedItems: h.ownedItemRecords,
      relations: h.relationRecords,
      playlists: h.playlistRecords,
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
      localEdits: {
        inspect: h.vi.fn().mockResolvedValue({
          path: wavPath,
          format: 'wav',
          sizeBytes: 100,
          lastModifiedAt: '2026-05-29T09:15:00.000Z',
          tags: { title: 'Embedded Polynomial-C', artists: ['Aphex Twin'] },
          technical: {
            bitDepth: 16,
            durationSeconds: 284,
            sampleRate: 44100,
          },
        }),
        preview: h.vi.fn(),
        apply: h.vi.fn(),
      },
    }

    h.render(<h.App />)
    await user.click(h.screen.getByRole('button', { name: 'Edit local file' }))

    const editor = h.screen.getByRole('region', { name: 'Local file editor' })
    await user.click(h.within(editor).getByRole('tab', { name: 'Tags' }))

    expect(await h.within(editor).findByText('Read-only tags')).toBeVisible()
    expect(h.within(editor).getByLabelText('New Title')).toBeDisabled()
    expect(
      h.within(editor).getByRole('button', { name: 'Apply tags' }),
    ).toBeDisabled()

    window.discweaveDesktop = originalDesktopBridge
  })

  it('opens release batch tag editing with a per-track editor', async () => {
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
      localEdits: {
        inspect: h.vi.fn().mockResolvedValue({
          path: '/music/example.flac',
          format: 'flac',
          sizeBytes: 100,
          lastModifiedAt: '2026-05-29T09:15:00.000Z',
          tags: { title: 'Embedded title', artists: ['Aphex Twin'] },
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
                  label: 'Warp WARP LP6',
                  catalogNumber: 'WARP LP6',
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
          release: {
            ...baseTrack.release,
            releaseDate: '1992-02-12',
          },
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
    await user.click(h.within(editor).getByRole('tab', { name: 'Tags' }))

    expect(
      await h.within(editor).findByRole('region', { name: 'Tag changes' }),
    ).toBeVisible()
    expect(
      h.within(editor).getByRole('button', {
        name: 'Autofill all from DiscWeave',
      }),
    ).toBeVisible()
    expect(
      h.within(editor).queryByRole('columnheader', { name: 'Tags' }),
    ).not.toBeInTheDocument()
    expect(
      h.within(editor).getAllByRole('button', { name: 'Edit tags' }).length,
    ).toBeGreaterThan(0)
    await user.click(
      h.within(editor).getByRole('button', {
        name: 'Autofill all from DiscWeave',
      }),
    )
    await user.click(
      h.within(editor).getAllByRole('button', { name: 'Edit tags' })[1],
    )
    const expandedEditor = h.within(editor).getByRole('region', {
      name: /Tag editor for Polynomial-C/i,
    })
    expect(expandedEditor).toBeVisible()
    expect(
      expandedEditor.closest('tr')?.previousElementSibling?.textContent,
    ).toContain('Polynomial-C')

    expect(h.within(editor).getByLabelText('New Date')).toHaveValue(
      '1992-02-12',
    )
    expect(h.within(editor).getByLabelText('New Label')).toHaveValue('Warp')
    expect(h.within(editor).getByLabelText('New Catalog number')).toHaveValue(
      'WARP LP6',
    )

    window.discweaveDesktop = originalDesktopBridge
  })
})
