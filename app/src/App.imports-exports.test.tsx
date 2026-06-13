import { describe, expect, it, vi } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

const desktopAudioContentHash =
  '70bc8f4b72a86921468bf8e8441dce51d8c6cb7d792fa7bbcb0d4d9eba328b75'

function requestUrl(input: RequestInfo | URL) {
  const url =
    input instanceof Request
      ? input.url
      : input instanceof URL
        ? input.href
        : input
  return new URL(url, window.location.origin)
}

function importSessionDetailResponse(
  status: 'needsReview' | 'confirmed',
  draftGenres: string[] = [],
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

describe('App imports and exports', () => {
  it('shows the desktop download CTA for local imports in web mode', () => {
    window.history.pushState({}, '', '/imports')

    h.render(<h.App />)

    expect(
      h.screen.getAllByRole('link', { name: /download macos app/i })[0],
    ).toHaveAttribute('href', '/api/imports/desktop-downloads/macos')
    expect(
      h.screen.getAllByRole('link', { name: /download macos app/i }),
    ).toHaveLength(1)
    expect(
      h.screen.queryByRole('button', { name: /choose local folder/i }),
    ).not.toBeInTheDocument()
    expect(
      h.screen.getByText(
        /Desktop import sends metadata, hashes, paths and cover artifacts, not audio files/i,
      ),
    ).toBeVisible()
  })

  it('loads import review sessions from the authenticated API', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    const fetchMock = h.mockFetch(h.importSessionResponse())

    h.render(<h.App />)

    expect(
      await h.screen.findByText('/Users/example/Music'),
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/imports?limit=100&offset=0', {
      credentials: 'include',
      method: 'GET',
    })
  })

  it('shows imported draft genres that are not in the current dictionary', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    h.mockFetch(
      importSessionListResponse(),
      importSessionDetailResponse('needsReview', ['Electronic', 'Downtempo']),
    )
    const user = h.userEvent.setup()

    h.render(<h.App />)

    await user.click(
      await h.screen.findByRole('button', { name: /\/Users\/example\/Music/i }),
    )
    const editor = await h.screen.findByRole('region', {
      name: /import draft editor/i,
    })

    expect(
      h.within(editor).getByRole('checkbox', { name: 'Electronic' }),
    ).toBeChecked()
    expect(
      h.within(editor).getByRole('checkbox', { name: 'Downtempo' }),
    ).toBeChecked()
  })

  it('shows duplicate import matches before confirmation', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    const fetchMock = h.mockFetch(
      h.importSessionResponse(),
      h.importSessionDetailWithDuplicateTrack(),
    )
    const user = h.userEvent.setup()

    h.render(<h.App />)

    await user.click(
      await h.screen.findByRole('button', { name: /\/Users\/example\/Music/i }),
    )

    expect(
      await h.screen.findByText('Existing track selected: Polynomial-C'),
    ).toBeInTheDocument()
    expect(
      h.screen.getByText('Duplicate file matched an existing track.'),
    ).toBeInTheDocument()
    expect(h.screen.getByText('Matched')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/imports/import-session-1', {
      credentials: 'include',
      method: 'GET',
    })
  })

  it('returns to sign in when import sessions expire the session', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    h.mockFetch(
      h.jsonResponse({ code: 'auth.unauthenticated', message: 'Expired' }, 401),
      new Response(null, { status: 204 }),
    )

    h.render(<h.App />)

    expect(
      await h.screen.findByRole('form', { name: 'Sign in' }),
    ).toBeInTheDocument()
  })

  it('resets local import scan status after a server failure', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    const pickAndScan = vi.fn().mockResolvedValue({
      cancelled: false,
      scan: {
        sourceRoot: '/Users/example/Music',
        ignoredFileCount: 0,
        files: [],
      },
    })
    const originalDesktopBridge = window.discweaveDesktop
    window.discweaveDesktop = {
      isDesktop: true,
      exports: { download: vi.fn() },
      imports: { pickAndScan },
    }
    h.mockFetch(
      h.emptyImportSessionsResponse(),
      h.jsonResponse(
        { code: 'imports.server_error', message: 'Scan failed' },
        500,
      ),
    )

    try {
      const user = h.userEvent.setup()
      h.render(<h.App />)

      const chooseFolder = await h.screen.findByRole('button', {
        name: /full scan/i,
      })
      await user.click(chooseFolder)

      expect(await h.screen.findByRole('alert')).toHaveTextContent(
        'Scan failed',
      )
      expect(chooseFolder).toBeEnabled()
    } finally {
      window.discweaveDesktop = originalDesktopBridge
    }
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

  it('applies a reviewed Discogs release to an import draft before saving', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    const fetchMock = h.vi
      .fn<Window['fetch']>()
      .mockImplementation((input, init) => {
        const url = requestUrl(input)

        if (
          url.pathname === '/api/imports' &&
          url.searchParams.get('limit') === '100'
        ) {
          return Promise.resolve(importSessionListResponse())
        }

        if (
          url.pathname === '/api/imports/import-session-1' &&
          (!init?.method || init.method === 'GET')
        ) {
          return Promise.resolve(importSessionDetailResponse('needsReview'))
        }

        if (url.pathname === '/api/external-metadata/discogs/releases') {
          return Promise.resolve(
            h.jsonResponse({
              items: [
                {
                  source: discogsSource('orb-1991'),
                  title: "The Orb's Adventures Beyond The Ultraworld",
                  artists: ['The Orb'],
                  year: 1991,
                  trackCount: 2,
                  labels: ['Big Life'],
                  formats: ['FLAC', 'Album'],
                  catalogNumber: 'BLRCD 5',
                  barcodes: [],
                },
              ],
              limit: 25,
              total: 1,
            }),
          )
        }

        if (
          url.pathname === '/api/external-metadata/discogs/releases/orb-1991'
        ) {
          return Promise.resolve(h.jsonResponse(discogsReleaseDetail()))
        }

        if (
          url.pathname === '/api/imports/import-session-1/drafts/draft-1' &&
          init?.method === 'PUT'
        ) {
          return Promise.resolve(importSessionDetailResponse('needsReview'))
        }

        throw new Error(`Unexpected request: ${url.pathname}`)
      })
    h.vi.stubGlobal('fetch', fetchMock)
    const user = h.userEvent.setup()

    h.render(<h.App />)

    await user.click(
      await h.screen.findByRole('button', { name: /\/Users\/example\/Music/i }),
    )
    const detail = await h.screen.findByRole('region', {
      name: /discogs release lookup/i,
    })

    await user.click(
      h.within(detail).getByRole('button', { name: 'Search Discogs' }),
    )
    await user.click(
      h.within(detail).getByRole('button', { name: 'Search Discogs releases' }),
    )
    await user.click(
      await h.within(detail).findByRole('button', {
        name: /review the orb's adventures/i,
      }),
    )
    expect(
      h
        .within(detail)
        .getAllByText((_, element) =>
          Boolean(element?.textContent?.includes('1991 · 2 tracks')),
        ).length,
    ).toBeGreaterThan(0)
    expect(
      h.within(detail).getAllByText(/updates imported file rows/i).length,
    ).toBeGreaterThan(0)

    await user.click(
      h.within(detail).getByRole('button', {
        name: 'Apply selected Discogs fields',
      }),
    )

    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/imports/import-session-1/drafts/draft-1',
      expect.objectContaining({ method: 'PUT' }),
    )
    expect(
      h.screen.getByDisplayValue("The Orb's Adventures Beyond The Ultraworld"),
    ).toBeVisible()
    expect(h.screen.getByLabelText('Electronic')).toBeChecked()
    expect(h.screen.queryByText('Genre Electronic')).not.toBeInTheDocument()
    expect(h.screen.getByText('Big Life')).toBeInTheDocument()
    expect(
      h.screen.getByDisplayValue('A Huge Ever Growing Pulsating Brain'),
    ).toBeVisible()
    expect(h.screen.getByLabelText('Disc')).toHaveValue('CD 1')
    expect(h.screen.getByLabelText('Side')).toHaveValue('A')
    expect(h.screen.getByDisplayValue('Release/cover.jpg')).toBeVisible()

    await user.click(h.screen.getByRole('button', { name: /^save$/i }))

    await h.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/imports/import-session-1/drafts/draft-1',
        expect.objectContaining({ method: 'PUT' }),
      )
    })
    const updateCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === '/api/imports/import-session-1/drafts/draft-1' &&
        init?.method === 'PUT',
    )
    const updateBody = JSON.parse(
      ((updateCall?.[1] as RequestInit).body as string) ?? '{}',
    ) as {
      externalSources: Array<Record<string, string>>
      tags: string[]
      tracks: Array<Record<string, unknown>>
    }
    expect(updateBody.tags).toEqual(['local-import'])
    expect(updateBody.externalSources[0]).toMatchObject({
      providerName: 'discogs',
      resourceType: 'release',
      externalId: 'orb-1991',
      sourceUrl: 'https://www.discogs.com/release/orb-1991',
    })
    expect(updateBody.externalSources[0].appliedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T/,
    )
    expect(updateBody.tracks[0]).toMatchObject({
      id: 'draft-track-1',
      title: 'A Huge Ever Growing Pulsating Brain',
      durationSeconds: 1128,
      disc: 'CD 1',
      side: 'A',
      isSkipped: false,
    })
  })

  it('shows import confirmation failures next to the draft actions', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const fetchMock = h.mockFetch(
      importSessionListResponse(),
      importSessionDetailResponse('needsReview'),
      importSessionDetailResponse('needsReview'),
      h.jsonResponse(
        { code: 'credit.role_invalid', message: 'Credit role is invalid' },
        400,
      ),
    )
    const user = h.userEvent.setup()

    h.render(<h.App />)

    await user.click(
      await h.screen.findByRole('button', { name: /\/Users\/example\/Music/i }),
    )
    const editor = await h.screen.findByRole('region', {
      name: /import draft editor/i,
    })
    await user.click(
      h.within(editor).getByRole('button', { name: /^confirm$/i }),
    )

    expect(
      await h.within(editor).findByRole('alert', {
        name: /import draft action error/i,
      }),
    ).toHaveTextContent('Credit role is invalid')
    expect(
      fetchMock.mock.calls.some(
        ([url]) =>
          typeof url === 'string' &&
          url === '/api/imports/import-session-1/drafts/draft-1/confirm',
      ),
    ).toBe(true)
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

  it('cancels import confirmation before save or catalog writes when not confirmed', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const fetchMock = h.mockFetch(
      importSessionListResponse(),
      importSessionDetailResponse('needsReview'),
      importSessionDetailResponse('needsReview'),
      importSessionDetailResponse('confirmed'),
      importSessionListResponse(),
    )
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(
      await h.screen.findByRole('button', { name: /\/Users\/example\/Music/i }),
    )
    await h.screen.findByText('Ready to confirm.')
    await user.click(h.screen.getByRole('button', { name: /^confirm$/i }))

    await h.waitFor(() =>
      expect(confirm).toHaveBeenCalledWith(
        'Confirm this import draft and create catalog records?',
      ),
    )
    expect(await h.screen.findByText('Confirmation cancelled')).toBeVisible()
    expect(
      fetchMock.mock.calls.some(
        ([url]) => typeof url === 'string' && url.includes('/drafts/'),
      ),
    ).toBe(false)
    expect(
      fetchMock.mock.calls.some(
        ([url]) => typeof url === 'string' && url.includes('/confirm'),
      ),
    ).toBe(false)
  })

  it('restores JSON backups without a full catalog reload', async () => {
    window.history.pushState({}, '', '/imports')
    h.clearCatalogForTests()
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    const fetchMock = h.mockFetch(
      h.emptyImportSessionsResponse(),
      h.jsonResponse({
        restored: true,
        formatVersion: 1,
        artists: 1,
        labels: 1,
        releases: 1,
        tracks: 1,
        ownedItems: 1,
        playlists: 0,
        credits: 1,
        artistRelations: 0,
        trackRelations: 0,
        dictionaries: 10,
        importPatterns: 2,
        ratingCriteria: 1,
        ratings: 0,
      }),
    )
    const user = h.userEvent.setup()
    h.render(<h.App />)
    const restoreInput = await h.screen.findByLabelText(/restore json backup/i)
    await h.waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url]) => url === '/api/imports?limit=100&offset=0',
        ),
      ).toBe(true),
    )

    await user.upload(
      restoreInput,
      new File([JSON.stringify({ formatVersion: 1 })], 'discweave.json', {
        type: 'application/json',
      }),
    )

    await h.waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url]) => url === '/api/exports/json/restore',
        ),
      ).toBe(true),
    )
    const restoreCall = fetchMock.mock.calls.find(
      ([url]) => url === '/api/exports/json/restore',
    )
    expect(restoreCall).toBeDefined()
    expect(restoreCall?.[1]).toMatchObject({
      body: JSON.stringify({ formatVersion: 1 }),
      credentials: 'include',
      method: 'POST',
    })
    expect((restoreCall?.[1] as RequestInit).headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-DiscWeave-Confirm-Restore': 'restore-empty-collection',
    })
    expect(
      await h.screen.findByText(
        'JSON restore completed: 1 artists, 1 releases, 1 tracks, 1 owned items.',
      ),
    ).toBeInTheDocument()
  })

  it('shows the empty collection restore requirement from the API', async () => {
    window.history.pushState({}, '', '/imports')
    h.mockFetch(
      h.jsonResponse(
        {
          code: 'export_restore.collection_not_empty',
          message: 'Collection is not empty',
        },
        409,
      ),
    )
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.upload(
      h.screen.getByLabelText(/restore json backup/i),
      new File([JSON.stringify({ formatVersion: 1 })], 'discweave.json', {
        type: 'application/json',
      }),
    )

    expect(await h.screen.findByRole('alert')).toHaveTextContent(
      'Restore requires an empty collection.',
    )
  })

  it('rejects invalid JSON restore files before calling the API', async () => {
    window.history.pushState({}, '', '/imports')
    const fetchMock = h.mockFetch()
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.upload(
      h.screen.getByLabelText(/restore json backup/i),
      new File(['{invalid'], 'discweave.json', { type: 'application/json' }),
    )

    expect(await h.screen.findByRole('alert')).toHaveTextContent(
      'Select a valid JSON backup.',
    )
    expect(fetchMock).not.toHaveBeenCalled()
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

function discogsSource(externalId: string) {
  return {
    providerName: 'discogs',
    resourceType: 'release',
    externalId,
    sourceUrl: `https://www.discogs.com/release/${externalId}`,
    attribution: 'Data provided by Discogs.',
  }
}

function discogsReleaseDetail() {
  return {
    source: discogsSource('orb-1991'),
    title: "The Orb's Adventures Beyond The Ultraworld",
    artists: ['The Orb'],
    year: 1991,
    labels: ['Big Life'],
    formats: ['FLAC', 'Album'],
    catalogNumber: 'BLRCD 5',
    barcodes: [],
    identifiers: [],
    credits: [],
    tracklist: [
      {
        title: 'A Huge Ever Growing Pulsating Brain',
        position: '1',
        disc: 'CD 1',
        side: 'A',
        durationSeconds: 1128,
        artists: ['The Orb'],
      },
      {
        title: 'Back Side Of The Moon',
        position: '2',
        disc: 'CD 1',
        side: 'A',
        durationSeconds: 855,
        artists: ['The Orb'],
      },
    ],
    draft: {
      title: "The Orb's Adventures Beyond The Ultraworld",
      type: 'album',
      genres: ['Electronic'],
      year: 1991,
      releaseDate: null,
      artistCredits: [{ name: 'The Orb', role: 'mainArtist' }],
      labels: [
        {
          name: 'Big Life',
          catalogNumber: 'BLRCD 5',
          hasNoCatalogNumber: false,
        },
      ],
      tracklist: [
        {
          title: 'A Huge Ever Growing Pulsating Brain',
          position: 1,
          disc: 'CD 1',
          side: 'A',
          durationSeconds: 1128,
          artistCredits: [],
        },
        {
          title: 'Back Side Of The Moon',
          position: 2,
          disc: 'CD 1',
          side: 'A',
          durationSeconds: 855,
          artistCredits: [],
        },
      ],
      externalSources: [
        {
          providerName: 'discogs',
          resourceType: 'release',
          externalId: 'orb-1991',
          sourceUrl: 'https://www.discogs.com/release/orb-1991',
        },
      ],
    },
  }
}
