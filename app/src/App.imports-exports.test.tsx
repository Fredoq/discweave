import { describe, expect, it, vi } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

function importSessionDetailResponse(
  status: 'needsReview' | 'confirmed',
  draftGenres: string[] = [],
  options: {
    trackArtistCredits?: Array<{
      artistId: string | null
      name: string
      role: string
    }>
  } = {},
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
            artistCredits: options.trackArtistCredits ?? [],
            inheritReleaseArtistCredits: true,
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

function confirmationPreflightResponse(trackCount = 1) {
  return h.jsonResponse({
    sessionId: 'import-session-1',
    draftId: 'draft-1',
    draftStatus: 'ready',
    canConfirm: true,
    outcome: 'newRelease',
    summary: {
      includedTrackCount: trackCount,
      skippedTrackCount: 0,
      duplicateTrackCount: 0,
      newReleases: 1,
      reusedReleases: 0,
      updatedReleases: 0,
      newTracks: trackCount,
      reusedTracks: 0,
      newDigitalOwnedItems: 1,
      reusedDigitalOwnedItems: 0,
      newLocalAudioFiles: trackCount,
      updatedLocalAudioFiles: 0,
      newDigitalTrackFileLinks: trackCount,
      relinkedDigitalTrackFileLinks: 0,
      unchangedDigitalTrackFileLinks: 0,
    },
    actions: [
      { kind: 'release', action: 'create', count: 1, label: 'Create release' },
      {
        kind: 'track',
        action: 'create',
        count: trackCount,
        label: 'Create tracks',
      },
      {
        kind: 'digitalOwnedItem',
        action: 'create',
        count: 1,
        label: 'Create digital owned item',
      },
      {
        kind: 'localAudioFile',
        action: 'create',
        count: trackCount,
        label: 'Create local audio file rows',
      },
      {
        kind: 'digitalTrackFileLink',
        action: 'create',
        count: trackCount,
        label: 'Create file links',
      },
    ],
    tracks: Array.from({ length: trackCount }, (_, index) => ({
      draftTrackId: `draft-track-${index + 1}`,
      title: `Track ${index + 1}`,
      position: index + 1,
      isSkipped: false,
      selectedTrackId: null,
      trackAction: 'create',
      localFileAction: 'create',
      fileLinkAction: 'create',
    })),
    issues: [],
    blockingErrors: [],
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

  it('shows import confirmation failures next to the draft actions', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    const fetchMock = h.mockFetch(
      importSessionListResponse(),
      importSessionDetailResponse('needsReview'),
      confirmationPreflightResponse(),
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
    const dialog = await h.screen.findByRole('dialog', {
      name: /confirm import draft/i,
    })
    expect(dialog).toHaveTextContent('Create release')
    await user.click(
      h.within(dialog).getByRole('button', { name: /confirm import/i }),
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
          url ===
            '/api/imports/import-session-1/drafts/draft-1/confirmation-preflight',
      ),
    ).toBe(true)
    expect(
      fetchMock.mock.calls.some(
        ([url]) =>
          typeof url === 'string' &&
          url === '/api/imports/import-session-1/drafts/draft-1/confirm',
      ),
    ).toBe(true)
  })

  it('marks imported credit roles that will be added on confirm', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    h.mockFetch(
      importSessionListResponse(),
      importSessionDetailResponse('needsReview', [], {
        trackArtistCredits: [
          {
            artistId: null,
            name: 'Alex Paterson',
            role: 'Mixed By',
          },
        ],
      }),
    )
    const user = h.userEvent.setup()

    h.render(<h.App />)

    await user.click(
      await h.screen.findByRole('button', { name: /\/Users\/example\/Music/i }),
    )

    expect(await h.screen.findByText('Mixed By')).toBeInTheDocument()
    expect(
      await h.screen.findByText(
        'Will be added to Settings > Credit roles on confirm.',
      ),
    ).toBeInTheDocument()
  })

  it('shows import confirmation preflight summary before confirming a draft', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    const fetchMock = h.mockFetch(
      importSessionListResponse(),
      importSessionDetailResponse('needsReview'),
      confirmationPreflightResponse(),
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
    const dialog = await h.screen.findByRole('dialog', {
      name: /confirm import draft/i,
    })

    expect(dialog).toHaveTextContent('Imported Release')
    expect(dialog).toHaveTextContent('1 included track')
    expect(dialog).toHaveTextContent('Create release')
    expect(dialog).toHaveTextContent('Create local audio file rows')
    expect(
      fetchMock.mock.calls.some(
        ([url]) => typeof url === 'string' && url.endsWith('/confirm'),
      ),
    ).toBe(false)

    await user.click(
      h.within(dialog).getByRole('button', { name: /confirm import/i }),
    )

    expect(await h.screen.findByText('Release confirmed')).toBeVisible()
    expect(
      fetchMock.mock.calls.some(
        ([url]) =>
          typeof url === 'string' &&
          url === '/api/imports/import-session-1/drafts/draft-1/confirm',
      ),
    ).toBe(true)
  })

  it('shows every track in a long import confirmation track plan', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    h.mockFetch(
      importSessionListResponse(),
      importSessionDetailResponse('needsReview'),
      confirmationPreflightResponse(7),
    )
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(
      await h.screen.findByRole('button', { name: /\/Users\/example\/Music/i }),
    )
    await h.screen.findByText('Ready to confirm.')
    await user.click(h.screen.getByRole('button', { name: /^confirm$/i }))
    const dialog = await h.screen.findByRole('dialog', {
      name: /confirm import draft/i,
    })

    expect(dialog).toHaveTextContent('7 draft tracks reviewed')
    expect(dialog).toHaveTextContent('Track 7')
  })

  it('cancels import confirmation before save or catalog writes when not confirmed', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    const fetchMock = h.mockFetch(
      importSessionListResponse(),
      importSessionDetailResponse('needsReview'),
      confirmationPreflightResponse(),
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
    const dialog = await h.screen.findByRole('dialog', {
      name: /confirm import draft/i,
    })
    await user.click(h.within(dialog).getByRole('button', { name: /cancel/i }))

    expect(await h.screen.findByText('Confirmation cancelled')).toBeVisible()
    expect(
      fetchMock.mock.calls.some(
        ([url]) =>
          typeof url === 'string' &&
          url.includes('/drafts/') &&
          !url.includes('/confirmation-preflight'),
      ),
    ).toBe(false)
    expect(
      fetchMock.mock.calls.some(
        ([url]) => typeof url === 'string' && url.endsWith('/confirm'),
      ),
    ).toBe(false)
  })
})
