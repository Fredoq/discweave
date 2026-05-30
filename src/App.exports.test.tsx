import { describe, expect, it, vi } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App exports', () => {
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
    expect(
      h.screen.getByText(
        /User exports are portable snapshots for personal backup and spreadsheet work/i,
      ),
    ).toBeVisible()
    expect(
      h.screen.getByText(
        /Hosted service backups are operated separately from these JSON and CSV downloads/i,
      ),
    ).toBeVisible()
    expect(
      h.screen.getByText(
        /Export v1 includes confirmed catalog data and omits audio bytes, raw cover bytes, import review drafts and account data/i,
      ),
    ).toBeVisible()
    expect(
      h.screen.getByText(
        /JSON restore is available only for an empty active collection/i,
      ),
    ).toBeVisible()
  })

  it('starts JSON exports through authenticated direct browser downloads', async () => {
    window.history.pushState({}, '', '/exports')
    const { click, createObjectURL, download, revokeObjectURL } =
      h.stubBrowserExportDownload()
    const fetchMock = h.mockFetch(
      new Response(null, {
        headers: {
          'Content-Disposition': 'attachment; filename="discweave.json"',
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
    expect(download.fileName).toBe('discweave.json')
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(revokeObjectURL).not.toHaveBeenCalled()
    expect(await h.screen.findByText('JSON export started')).toBeInTheDocument()
  })

  it('starts CSV exports through authenticated direct browser downloads', async () => {
    window.history.pushState({}, '', '/exports')
    const { click, createObjectURL, download, revokeObjectURL } =
      h.stubBrowserExportDownload()
    const fetchMock = h.mockFetch(
      new Response(null, {
        headers: {
          'Content-Disposition': 'attachment; filename="discweave.zip"',
        },
        status: 200,
      }),
    )
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: /download csv/i }))

    expect(fetchMock).toHaveBeenCalledWith('/api/exports/csv', {
      credentials: 'include',
      method: 'HEAD',
    })
    expect(click).toHaveBeenCalledOnce()
    expect(download.href).toBe('/api/exports/csv')
    expect(download.fileName).toBe('discweave.zip')
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(revokeObjectURL).not.toHaveBeenCalled()
    expect(await h.screen.findByText('CSV export started')).toBeInTheDocument()
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
      path: '/tmp/discweave-export.json',
    })
    const originalDesktopBridge = window.discweaveDesktop
    window.discweaveDesktop = {
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
      await user.click(h.screen.getByRole('button', { name: /download csv/i }))

      expect(downloadExport).toHaveBeenCalledWith('csv')
      expect(await h.screen.findByText('CSV export saved')).toBeInTheDocument()
      expect(
        h.screen.queryByRole('link', { name: /download json/i }),
      ).not.toBeInTheDocument()
    } finally {
      window.discweaveDesktop = originalDesktopBridge
    }
  })
})
