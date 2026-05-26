import { describe, expect, it, vi } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

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
  })

  it('loads import review sessions from the authenticated API', async () => {
    vi.stubGlobal('__cratebaseUseRealCatalogApi', true)
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

  it('shows duplicate import matches before confirmation', async () => {
    vi.stubGlobal('__cratebaseUseRealCatalogApi', true)
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
    vi.stubGlobal('__cratebaseUseRealCatalogApi', true)
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
    vi.stubGlobal('__cratebaseUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    const pickAndScan = vi.fn().mockResolvedValue({
      cancelled: false,
      scan: {
        sourceRoot: '/Users/example/Music',
        ignoredFileCount: 0,
        files: [],
      },
    })
    const originalDesktopBridge = window.cratebaseDesktop
    window.cratebaseDesktop = {
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
        name: /choose local folder/i,
      })
      await user.click(chooseFolder)

      expect(await h.screen.findByRole('alert')).toHaveTextContent(
        'Scan failed',
      )
      expect(chooseFolder).toBeEnabled()
    } finally {
      window.cratebaseDesktop = originalDesktopBridge
    }
  })

  it('shows portable export downloads for the active collection', () => {
    window.history.pushState({}, '', '/exports')

    h.render(<h.App />)

    expect(
      h.screen.getByRole('region', { name: 'Exports workspace' }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByText(`${h.releaseRecords.length} releases`),
    ).toBeVisible()
    expect(h.screen.getByText(`${h.trackRecords.length} tracks`)).toBeVisible()
    expect(
      h.screen.getByText(`${h.ownedItemRecords.length} owned items`),
    ).toBeVisible()
    expect(
      h.screen.getByRole('button', { name: /download json/i }),
    ).toBeEnabled()
    expect(
      h.screen.getByRole('button', { name: /download csv/i }),
    ).toBeEnabled()
  })

  it('starts JSON exports through authenticated direct browser downloads', async () => {
    window.history.pushState({}, '', '/exports')
    const { click, createObjectURL, download, revokeObjectURL } =
      h.stubBrowserExportDownload()
    const fetchMock = h.mockFetch(
      new Response(null, {
        headers: {
          'Content-Disposition': 'attachment; filename="cratebase.json"',
        },
        status: 200,
      }),
    )
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: /download json/i }))

    expect(fetchMock).toHaveBeenCalledWith('/api/exports/json', {
      credentials: 'include',
      method: 'HEAD',
    })
    expect(click).toHaveBeenCalledOnce()
    expect(download.href).toBe('/api/exports/json')
    expect(download.fileName).toBe('cratebase.json')
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(revokeObjectURL).not.toHaveBeenCalled()
    expect(await h.screen.findByText('JSON export started')).toBeInTheDocument()
  })

  it('shows export server failures accessibly and resets pending state', async () => {
    window.history.pushState({}, '', '/exports')
    h.mockFetch(
      h.jsonResponse(
        { code: 'exports.server_error', message: 'Export failed' },
        500,
      ),
    )
    const user = h.userEvent.setup()
    h.render(<h.App />)

    const downloadJson = h.screen.getByRole('button', {
      name: /download json/i,
    })
    await user.click(downloadJson)

    expect(await h.screen.findByRole('alert')).toHaveTextContent(
      'Export failed',
    )
    expect(downloadJson).toBeEnabled()
  })

  it('returns to sign in when export download expires the session', async () => {
    window.history.pushState({}, '', '/exports')
    h.mockFetch(
      h.jsonResponse({ code: 'auth.unauthenticated', message: 'Expired' }, 401),
      new Response(null, { status: 204 }),
    )
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: /download json/i }))

    expect(
      await h.screen.findByRole('form', { name: 'Sign in' }),
    ).toBeInTheDocument()
  })

  it('routes export downloads through the desktop bridge in desktop mode', async () => {
    window.history.pushState({}, '', '/exports')
    const downloadExport = vi.fn().mockResolvedValue({
      cancelled: false,
      path: '/tmp/cratebase-export.json',
    })
    const originalDesktopBridge = window.cratebaseDesktop
    window.cratebaseDesktop = {
      isDesktop: true,
      imports: { pickAndScan: vi.fn() },
      exports: { download: downloadExport },
    }

    try {
      const user = h.userEvent.setup()
      h.render(<h.App />)

      await user.click(h.screen.getByRole('button', { name: /download json/i }))

      expect(downloadExport).toHaveBeenCalledWith('json')
      expect(await h.screen.findByText('JSON export saved')).toBeInTheDocument()
      expect(
        h.screen.queryByRole('link', { name: /download json/i }),
      ).not.toBeInTheDocument()
    } finally {
      window.cratebaseDesktop = originalDesktopBridge
    }
  })

  it('restores JSON backups without a full catalog reload', async () => {
    window.history.pushState({}, '', '/imports')
    h.clearCatalogForTests()
    vi.stubGlobal('__cratebaseUseRealCatalogApi', true)
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
      new File([JSON.stringify({ formatVersion: 1 })], 'cratebase.json', {
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
      'X-Cratebase-Confirm-Restore': 'restore-empty-collection',
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
      new File([JSON.stringify({ formatVersion: 1 })], 'cratebase.json', {
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
      new File(['{invalid'], 'cratebase.json', { type: 'application/json' }),
    )

    expect(await h.screen.findByRole('alert')).toHaveTextContent(
      'Select a valid JSON backup.',
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('enables local folder import in desktop mode', async () => {
    window.history.pushState({}, '', '/imports')
    const pickAndScan = vi.fn().mockResolvedValue({ cancelled: true })
    const originalDesktopBridge = window.cratebaseDesktop
    window.cratebaseDesktop = {
      isDesktop: true,
      exports: { download: vi.fn() },
      imports: { pickAndScan },
    }

    try {
      const user = h.userEvent.setup()
      h.render(<h.App />)

      await user.click(
        h.screen.getByRole('button', { name: /choose local folder/i }),
      )

      expect(pickAndScan).toHaveBeenCalledOnce()
      expect(
        await h.screen.findByText('Folder selection cancelled'),
      ).toBeInTheDocument()
    } finally {
      window.cratebaseDesktop = originalDesktopBridge
    }
  })
})
