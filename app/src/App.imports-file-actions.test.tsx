import { describe, expect, it, vi } from 'vitest'
import * as h from './test/appTestHarness'
import {
  importSessionDetailResponse,
  importSessionListResponse,
} from './test/importsDesktopFixtures'

type DesktopBridge = NonNullable<Window['discweaveDesktop']>

const trackPath = '/Users/example/Music/Release/01 Track.flac'
const releasePath = '/Users/example/Music/Release'

h.setupAppTestHooks()

describe('App import file actions', () => {
  async function withDesktopImports(
    imports: Partial<DesktopBridge['imports']>,
    run: () => Promise<void>,
  ) {
    const originalDesktopBridge = window.discweaveDesktop
    window.discweaveDesktop = {
      isDesktop: true,
      exports: { download: vi.fn() },
      imports: { pickAndScan: vi.fn(), ...imports },
    }
    try {
      await run()
    } finally {
      window.discweaveDesktop = originalDesktopBridge
    }
  }

  async function openImportDraft() {
    const user = h.userEvent.setup()
    h.render(<h.App />)
    await user.click(
      await h.screen.findByRole('button', { name: '/Users/example/Music' }),
    )
    await h.screen.findByLabelText('Track year')
    return user
  }

  it('plays import tracks in the default player from the list and the details', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    h.mockFetch(
      importSessionListResponse(),
      importSessionDetailResponse('needsReview'),
    )
    const openFile = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, path: trackPath })
      .mockResolvedValueOnce({
        ok: false,
        path: trackPath,
        reason: 'missing',
        message: 'The file does not exist.',
      })

    await withDesktopImports({ openFile }, async () => {
      const user = await openImportDraft()

      await user.click(
        h.screen.getByRole('button', { name: 'Play Track in default player' }),
      )
      expect(openFile).toHaveBeenCalledWith({ path: trackPath })

      await user.click(
        h.screen.getByRole('button', { name: 'Play in default player' }),
      )
      expect(await h.screen.findByRole('alert')).toHaveTextContent(
        'File not found on disk.',
      )
      expect(openFile).toHaveBeenCalledTimes(2)
    })
  })

  it('hides playback and Trash actions outside the desktop app', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    h.mockFetch(
      importSessionListResponse(),
      importSessionDetailResponse('needsReview'),
    )

    await openImportDraft()

    expect(
      h.screen.queryByRole('button', { name: /default player/i }),
    ).not.toBeInTheDocument()
    expect(
      h.screen.queryByRole('button', { name: /move to trash/i }),
    ).not.toBeInTheDocument()
  })

  it('moves the release folder to Trash after confirmation and skips the draft', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    const fetchMock = h.mockFetch(
      importSessionListResponse(),
      importSessionDetailResponse('needsReview'),
      importSessionDetailResponse('needsReview'),
      importSessionListResponse(),
    )
    const plan = {
      mode: 'folder',
      folderPath: releasePath,
      audioFiles: [trackPath],
      missingFiles: [],
      otherFileCount: 2,
      otherFileSamples: ['cover.jpg', 'rip.log'],
      foreignAudioFileCount: 0,
    }
    const planReleaseTrash = vi.fn().mockResolvedValue(plan)
    const trashRelease = vi.fn().mockResolvedValue({
      ok: true,
      mode: 'folder',
      trashedPaths: [releasePath],
      failedPath: null,
    })

    await withDesktopImports({ planReleaseTrash, trashRelease }, async () => {
      const user = await openImportDraft()

      await user.click(
        h.screen.getByRole('button', { name: /^move to trash$/i }),
      )
      const dialog = await h.screen.findByRole('dialog', {
        name: 'Move release to Trash?',
      })
      const request = { sourcePath: releasePath, filePaths: [trackPath] }
      expect(planReleaseTrash).toHaveBeenCalledWith(request)
      expect(
        await h
          .within(dialog)
          .findByText('The whole release folder goes to Trash'),
      ).toBeVisible()
      expect(h.within(dialog).getByText('Release')).toBeVisible()
      expect(h.within(dialog).getByText('/Users/example/Music')).toBeVisible()
      expect(
        h.within(dialog).getByText('2 other files (cover.jpg, rip.log)'),
      ).toBeVisible()

      await user.click(
        h.within(dialog).getByRole('button', { name: 'Move to Trash' }),
      )

      await h.waitFor(() => {
        expect(trashRelease).toHaveBeenCalledWith(request)
        expect(
          fetchMock.mock.calls.some(
            ([url, init]) =>
              url === '/api/imports/import-session-1/drafts/draft-1/skip' &&
              init?.method === 'POST',
          ),
        ).toBe(true)
      })
      await h.waitFor(() => {
        expect(h.screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })
  })

  it('keeps the draft when moving files to Trash fails', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    const fetchMock = h.mockFetch(
      importSessionListResponse(),
      importSessionDetailResponse('needsReview'),
    )
    const planReleaseTrash = vi.fn().mockResolvedValue({
      mode: 'files',
      folderPath: releasePath,
      audioFiles: [trackPath],
      missingFiles: [],
      otherFileCount: 0,
      otherFileSamples: [],
      foreignAudioFileCount: 3,
    })
    const trashRelease = vi.fn().mockResolvedValue({
      ok: false,
      mode: 'files',
      trashedPaths: [],
      failedPath: trackPath,
      message: 'Permission denied.',
    })

    await withDesktopImports({ planReleaseTrash, trashRelease }, async () => {
      const user = await openImportDraft()

      await user.click(
        h.screen.getByRole('button', { name: /^move to trash$/i }),
      )
      const dialog = await h.screen.findByRole('dialog')
      expect(
        await h
          .within(dialog)
          .findByText(
            /3 audio files from other releases, so the folder itself stays/,
          ),
      ).toBeVisible()

      await user.click(
        h.within(dialog).getByRole('button', { name: 'Move to Trash' }),
      )

      expect(await h.within(dialog).findByRole('alert')).toHaveTextContent(
        'Permission denied.',
      )
      expect(
        fetchMock.mock.calls.some(
          ([url]) => typeof url === 'string' && url.endsWith('/skip'),
        ),
      ).toBe(false)
    })
  })

  it('opens the Trash confirmation from the draft list row', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    h.mockFetch(
      importSessionListResponse(),
      importSessionDetailResponse('needsReview'),
    )
    const planReleaseTrash = vi.fn().mockResolvedValue({
      mode: 'folder',
      folderPath: releasePath,
      audioFiles: [trackPath],
      missingFiles: [],
      otherFileCount: 0,
      otherFileSamples: [],
      foreignAudioFileCount: 0,
    })
    const trashRelease = vi.fn()

    await withDesktopImports({ planReleaseTrash, trashRelease }, async () => {
      const user = await openImportDraft()

      await user.click(
        h.screen.getByRole('button', {
          name: 'Move Imported Release to Trash',
        }),
      )
      const dialog = await h.screen.findByRole('dialog', {
        name: 'Move release to Trash?',
      })
      expect(
        await h
          .within(dialog)
          .findByText('The whole release folder goes to Trash'),
      ).toBeVisible()

      await user.click(h.within(dialog).getByRole('button', { name: 'Cancel' }))
      expect(h.screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(trashRelease).not.toHaveBeenCalled()
    })
  })

  it('does not offer Trash for a draft that is already in the catalog', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    h.mockFetch(
      importSessionListResponse(),
      importSessionDetailResponse('confirmed'),
    )
    const planReleaseTrash = vi.fn()

    await withDesktopImports(
      { planReleaseTrash, trashRelease: vi.fn() },
      async () => {
        await openImportDraft()

        expect(
          h.screen.getByRole('button', { name: /^move to trash$/i }),
        ).toBeDisabled()
        expect(
          h.screen.queryByRole('button', {
            name: 'Move Imported Release to Trash',
          }),
        ).not.toBeInTheDocument()
        expect(planReleaseTrash).not.toHaveBeenCalled()
      },
    )
  })
})
