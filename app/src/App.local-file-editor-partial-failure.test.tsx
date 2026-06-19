import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App local file editor partial failures', () => {
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
          localAudioFileId: 'local-polynomial-c-file',
          currentPath,
          targetPath,
          format: 'flac',
          rename: true,
          tagWritable: true,
          tagChanges: {},
          issues: [],
        },
        {
          localAudioFileId: 'local-failed-file',
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
          localAudioFileId: 'local-polynomial-c-file',
          path: targetPath,
          format: 'flac',
          sizeBytes: 123,
          lastModifiedAt: '2026-05-29T09:16:00.000Z',
          contentHash: 'abc123',
        },
      ],
      failedFile: {
        localAudioFileId: 'local-failed-file',
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

      return Promise.resolve(h.jsonResponse({ id: 'local-polynomial-c-file' }))
    })
    h.vi.stubGlobal('fetch', fetchMock)
    window.discweaveDesktop = {
      isDesktop: true,
      exports: { download: h.vi.fn() },
      imports: { pickAndScan: h.vi.fn() },
      localEdits: { inspect, preview: h.vi.fn(), apply },
    }

    h.render(<h.App />)
    await user.click(
      h.screen.getByRole('button', {
        name: /edit file for selected ambient works 85-92 track 3/i,
      }),
    )

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
      '/api/local-audio-files/local-polynomial-c-file',
      expect.objectContaining({
        method: 'PATCH',
      }),
    )
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/owned-items/local-failed-file/digital-file',
      expect.anything(),
    )

    window.discweaveDesktop = originalDesktopBridge
  })
})
