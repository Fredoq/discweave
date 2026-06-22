import { describe, expect, it, vi } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

const desktopAudioContentHash =
  '70bc8f4b72a86921468bf8e8441dce51d8c6cb7d792fa7bbcb0d4d9eba328b75'

function importSessionDetailResponse(
  status: 'needsReview' | 'confirmed',
  draftGenres: string[] = [],
  trackPatch: Record<string, unknown> = {},
) {
  return h.jsonResponse({
    id: 'import-session-1',
    sourceRoot: '/Users/example/Music',
    status: status === 'confirmed' ? 'confirmed' : 'readyForReview',
    draftCount: 1,
    trackCount: 1,
    ignoredFileCount: 0,
    createdAt: '2026-05-16T12:00:00Z',
    updatedAt: '2026-05-16T12:00:00Z',
    drafts: [
      {
        id: 'draft-1',
        sourcePath: '/Users/example/Music/Release',
        relativePath: 'Release',
        status,
        title: 'Imported Release',
        type: 'album',
        catalogNumber: null,
        labelName: null,
        releaseDate: null,
        year: 1992,
        isVariousArtists: false,
        notOnLabel: true,
        artistNames: ['Aphex Twin'],
        artistCredits: [],
        selectedArtistIds: [],
        artistSuggestions: [],
        labels: [],
        genres: draftGenres,
        tags: ['local-import'],
        externalSources: [],
        coverPath: 'Release/cover.jpg',
        issues: [],
        tracks: [
          {
            id: 'draft-track-1',
            filePath: '/Users/example/Music/Release/01 Track.flac',
            relativePath: 'Release/01 Track.flac',
            format: 'flac',
            sizeBytes: 12,
            lastModifiedAt: '2026-05-16T12:00:00Z',
            durationSeconds: null,
            position: 1,
            disc: 'CD 1',
            side: 'A',
            title: 'Track',
            artistNames: ['Aphex Twin'],
            artistCredits: [],
            artistSuggestions: [],
            trackSuggestions: [],
            isSkipped: false,
            selectedTrackId: null,
            selectedArtistIds: [],
            issues: [],
            ...trackPatch,
          },
        ],
      },
    ],
  })
}

function importSessionListResponse() {
  return h.jsonResponse({
    items: [
      {
        id: 'import-session-1',
        sourceRoot: '/Users/example/Music',
        status: 'readyForReview',
        draftCount: 1,
        trackCount: 1,
        ignoredFileCount: 0,
        createdAt: '2026-05-16T12:00:00Z',
        updatedAt: '2026-05-16T12:00:00Z',
        drafts: [],
      },
    ],
    limit: 100,
    offset: 0,
    total: 1,
  })
}

describe('App desktop imports', () => {
  it('shows moved and renamed file hints in import review', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    h.mockFetch(
      importSessionListResponse(),
      importSessionDetailResponse('needsReview', [], {
        moveHint: {
          previousPath: '/Users/example/Music Old/Release/01 Track.flac',
          matchKind: 'contentHash',
          confidence: 'high',
        },
      }),
    )

    const user = h.userEvent.setup()
    h.render(<h.App />)
    await user.click(
      await h.screen.findByRole('button', {
        name: '/Users/example/Music',
      }),
    )

    const hint = await h.screen.findByText((_content, element) =>
      Boolean(
        element?.classList.contains('imports-move-note') &&
        element.textContent?.includes('Moved or renamed file hint') &&
        element.textContent?.includes(
          '/Users/example/Music Old/Release/01 Track.flac',
        ) &&
        element.textContent?.includes('same content hash'),
      ),
    )
    expect(hint).toBeVisible()
  })

  it('posts desktop scan results, selects the first draft, and sends no audio bytes', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    const pickAndScan = vi.fn().mockResolvedValue({
      cancelled: false,
      scan: {
        sourceRoot: '/Users/example/Music',
        ignoredFileCount: 1,
        files: [
          {
            filePath: '/Users/example/Music/Release/01 Track.flac',
            relativePath: 'Release/01 Track.flac',
            format: 'flac',
            sizeBytes: 12,
            lastModifiedAt: '2026-05-16T12:00:00Z',
            contentHash: desktopAudioContentHash,
            audioMetadata: {
              title: 'Track',
              artists: ['Aphex Twin'],
              albumTitle: 'Imported Release',
              albumArtists: ['Aphex Twin'],
              catalogNumber: null,
              releaseDate: null,
              year: 1992,
              durationSeconds: null,
              trackNumber: 1,
            },
            coverArtifact: null,
          },
          {
            filePath: '/Users/example/Music/Release/cover.jpg',
            relativePath: 'Release/cover.jpg',
            format: null,
            sizeBytes: 11,
            lastModifiedAt: '2026-05-16T12:00:00Z',
            audioMetadata: null,
            coverArtifact: {
              fileName: 'cover.jpg',
              extension: '.jpg',
              contentType: 'image/jpeg',
              sizeBytes: 11,
              contentBase64: 'Y292ZXIgYnl0ZXM=',
            },
          },
        ],
      },
    })
    const originalDesktopBridge = window.discweaveDesktop
    window.discweaveDesktop = {
      isDesktop: true,
      exports: { download: vi.fn() },
      imports: { pickAndScan },
    }
    const fetchMock = h.mockFetch(
      h.emptyImportSessionsResponse(),
      importSessionDetailResponse('needsReview'),
      importSessionListResponse(),
      importSessionDetailResponse('needsReview'),
    )

    try {
      const user = h.userEvent.setup()
      h.render(<h.App />)

      await user.click(
        await h.screen.findByRole('button', { name: /full scan/i }),
      )

      expect(await h.screen.findByText('Scan saved')).toBeInTheDocument()
      expect(h.screen.getByDisplayValue('Imported Release')).toBeVisible()
      expect(h.screen.getByLabelText('Disc')).toHaveValue('CD 1')
      expect(h.screen.getByLabelText('Side')).toHaveValue('A')
      expect(h.screen.getByText('Ready to confirm.')).toBeInTheDocument()
      const scanCall = fetchMock.mock.calls.find(
        ([url]) => url === '/api/imports/desktop-folder-scans',
      )
      expect(scanCall).toBeDefined()
      const requestBody = JSON.parse(
        ((scanCall?.[1] as RequestInit).body as string) ?? '{}',
      ) as { files: Array<Record<string, unknown>> }
      const requestJson = JSON.stringify(requestBody)
      expect(requestJson).not.toContain('collectionId')
      expect(requestBody.files[0]).toMatchObject({
        relativePath: 'Release/01 Track.flac',
        contentHash: desktopAudioContentHash,
        coverArtifact: null,
      })
      expect(requestBody.files[0]).not.toHaveProperty('contentBase64')
      expect(requestBody.files[0]).not.toHaveProperty('audioContentBase64')
      expect(JSON.stringify(requestBody.files[0])).not.toContain(
        'ZmFrZSBmbGFjIGJ5dGVz',
      )
      expect(requestBody.files[1]).toMatchObject({
        relativePath: 'Release/cover.jpg',
        coverArtifact: {
          contentBase64: 'Y292ZXIgYnl0ZXM=',
        },
      })
      await user.clear(h.screen.getByLabelText('Disc'))
      await user.type(h.screen.getByLabelText('Disc'), 'Disc 2')
      await user.clear(h.screen.getByLabelText('Side'))
      await user.type(h.screen.getByLabelText('Side'), 'B')
      await user.click(h.screen.getByRole('button', { name: /^save$/i }))
      await h.waitFor(() => {
        expect(
          fetchMock.mock.calls.some(
            ([url, init]) =>
              url === '/api/imports/import-session-1/drafts/draft-1' &&
              init?.method === 'PUT',
          ),
        ).toBe(true)
      })
      const updateCall = fetchMock.mock.calls.find(
        ([url, init]) =>
          url === '/api/imports/import-session-1/drafts/draft-1' &&
          init?.method === 'PUT',
      )
      expect(updateCall).toBeDefined()
      const updateBody = JSON.parse(
        ((updateCall?.[1] as RequestInit).body as string) ?? '{}',
      ) as { tracks: Array<Record<string, unknown>> }
      expect(updateBody.tracks[0]).toMatchObject({
        disc: 'Disc 2',
        side: 'B',
      })
      expect(pickAndScan).toHaveBeenCalledWith({ mode: 'full' })
    } finally {
      window.discweaveDesktop = originalDesktopBridge
    }
  })

  it('starts a names-only desktop scan for cloud folders', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    const pickAndScan = vi.fn().mockResolvedValue({
      cancelled: false,
      scan: {
        sourceRoot: '/Users/example/iCloud/Music',
        ignoredFileCount: 0,
        files: [
          {
            filePath: '/Users/example/iCloud/Music/1991/01 Track.flac',
            relativePath: '1991/01 Track.flac',
            format: 'flac',
            sizeBytes: 12,
            lastModifiedAt: '2026-05-16T12:00:00Z',
            contentHash: null,
            audioMetadata: null,
            coverArtifact: null,
          },
        ],
      },
    })
    const originalDesktopBridge = window.discweaveDesktop
    window.discweaveDesktop = {
      isDesktop: true,
      exports: { download: vi.fn() },
      imports: { pickAndScan },
    }
    const fetchMock = h.mockFetch(
      h.emptyImportSessionsResponse(),
      importSessionDetailResponse('needsReview'),
      importSessionListResponse(),
    )

    try {
      const user = h.userEvent.setup()
      h.render(<h.App />)

      await user.click(
        await h.screen.findByRole('button', { name: /names only/i }),
      )

      expect(await h.screen.findByText('Scan saved')).toBeInTheDocument()
      expect(pickAndScan).toHaveBeenCalledWith({ mode: 'namesOnly' })
      const scanCall = fetchMock.mock.calls.find(
        ([url]) => url === '/api/imports/desktop-folder-scans',
      )
      const requestBody = JSON.parse(
        ((scanCall?.[1] as RequestInit).body as string) ?? '{}',
      ) as { files: Array<Record<string, unknown>> }
      expect(requestBody.files[0]).toMatchObject({
        relativePath: '1991/01 Track.flac',
        contentHash: null,
        audioMetadata: null,
        coverArtifact: null,
      })
    } finally {
      window.discweaveDesktop = originalDesktopBridge
    }
  })

  it('rescans a saved import source as a new desktop scan session', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    const pickAndScan = vi.fn()
    const rescanSource = vi.fn().mockResolvedValue({
      sourceRoot: '/Users/example/Music',
      scanMode: 'full',
      ignoredFileCount: 0,
      diagnostics: [],
      files: [
        {
          filePath: '/Users/example/Music/Release/01 Track.flac',
          relativePath: 'Release/01 Track.flac',
          format: 'flac',
          sizeBytes: 12,
          lastModifiedAt: '2026-05-16T12:00:00Z',
          contentHash: desktopAudioContentHash,
          audioMetadata: {
            title: 'Track',
            artists: ['Aphex Twin'],
            albumTitle: 'Imported Release',
            albumArtists: ['Aphex Twin'],
            trackNumber: 1,
          },
          coverArtifact: null,
        },
      ],
    })
    const originalDesktopBridge = window.discweaveDesktop
    window.discweaveDesktop = {
      isDesktop: true,
      exports: { download: vi.fn() },
      imports: { pickAndScan, rescanSource },
    }
    const fetchMock = h.mockFetch(
      importSessionListResponse(),
      importSessionDetailResponse('needsReview'),
      importSessionListResponse(),
      importSessionDetailResponse('needsReview'),
    )

    try {
      const user = h.userEvent.setup()
      h.render(<h.App />)

      await user.click(
        await h.screen.findByRole('button', { name: /rescan full/i }),
      )

      expect(await h.screen.findByText('Rescan saved')).toBeInTheDocument()
      expect(rescanSource).toHaveBeenCalledWith('/Users/example/Music', {
        mode: 'full',
      })
      expect(pickAndScan).not.toHaveBeenCalled()
      const scanCall = fetchMock.mock.calls.find(
        ([url]) => url === '/api/imports/desktop-folder-scans',
      )
      expect(scanCall?.[1]?.method).toBe('POST')
      const requestBody = JSON.parse(
        ((scanCall?.[1] as RequestInit).body as string) ?? '{}',
      ) as { sourceRoot: string; scanMode: string }
      expect(requestBody).toMatchObject({
        sourceRoot: '/Users/example/Music',
        scanMode: 'full',
      })
    } finally {
      window.discweaveDesktop = originalDesktopBridge
    }
  })

  it('offers a replacement folder when a saved rescan root is unavailable', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    const rescanSource = vi
      .fn()
      .mockRejectedValue(new Error('Import folder must be a directory.'))
    const pickAndScan = vi.fn().mockResolvedValue({
      cancelled: false,
      scan: {
        sourceRoot: '/Users/example/Music Replacement',
        scanMode: 'namesOnly',
        ignoredFileCount: 0,
        diagnostics: [],
        files: [],
      },
    })
    const originalDesktopBridge = window.discweaveDesktop
    window.discweaveDesktop = {
      isDesktop: true,
      exports: { download: vi.fn() },
      imports: { pickAndScan, rescanSource },
    }
    h.mockFetch(
      importSessionListResponse(),
      importSessionDetailResponse('needsReview'),
      importSessionListResponse(),
    )

    try {
      const user = h.userEvent.setup()
      h.render(<h.App />)

      await user.click(
        await h.screen.findByRole('button', { name: /rescan names only/i }),
      )

      expect(
        await h.screen.findByText(/saved source folder is unavailable/i),
      ).toBeInTheDocument()
      await user.click(
        h.screen.getByRole('button', { name: /choose replacement folder/i }),
      )

      expect(pickAndScan).toHaveBeenCalledWith({ mode: 'namesOnly' })
      expect(await h.screen.findByText('Scan saved')).toBeInTheDocument()
    } finally {
      window.discweaveDesktop = originalDesktopBridge
    }
  })

  it('enables local folder import in desktop mode', async () => {
    window.history.pushState({}, '', '/imports')
    const pickAndScan = vi.fn().mockResolvedValue({ cancelled: true })
    const originalDesktopBridge = window.discweaveDesktop
    window.discweaveDesktop = {
      isDesktop: true,
      exports: { download: vi.fn() },
      imports: { pickAndScan },
    }

    try {
      const user = h.userEvent.setup()
      h.render(<h.App />)

      await user.click(h.screen.getByRole('button', { name: /full scan/i }))

      expect(pickAndScan).toHaveBeenCalledWith({ mode: 'full' })
      expect(
        await h.screen.findByText('Folder selection cancelled'),
      ).toBeInTheDocument()
    } finally {
      window.discweaveDesktop = originalDesktopBridge
    }
  })
})
