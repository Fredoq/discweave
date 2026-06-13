import { describe, expect, it, vi } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

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
})
