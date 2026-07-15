import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

const releaseUrl = '/releases?release=selected-ambient-works-85-92'
const filePath =
  '/archive/aphex-twin/selected-ambient-works-85-92/03-polynomial-c.flac'

describe('App release Track quick open', () => {
  it('opens one Release-scoped file directly without navigating', async () => {
    window.history.pushState({}, '', releaseUrl)
    const user = h.userEvent.setup()
    let resolveOpen: ((result: { ok: true; path: string }) => void) | undefined
    const open = h.vi.fn(
      () =>
        new Promise<{ ok: true; path: string }>((resolve) => {
          resolveOpen = resolve
        }),
    )
    window.discweaveDesktop = desktopBridge(open)

    h.render(<h.App />)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Selected Ambient Works 85-92',
    })
    const button = h.within(detailPanel).getByRole('button', {
      name: 'Open Polynomial-C in default player',
    })

    await user.click(button)

    await user.click(button)

    expect(open).toHaveBeenCalledWith({
      digitalTrackFileLinkId: 'link-polynomial-c-file',
      localAudioFileId: 'local-polynomial-c-file',
      path: filePath,
    })
    expect(open).toHaveBeenCalledTimes(1)
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(window.location.pathname).toBe('/releases')
    expect(window.location.search).toBe('?release=selected-ambient-works-85-92')

    const completeOpen = resolveOpen
    if (!completeOpen) {
      throw new Error('The quick-open promise was not created')
    }
    await h.act(() => {
      completeOpen({ ok: true, path: filePath })
      return Promise.resolve()
    })

    expect(button).toBeEnabled()
    expect(
      h.screen.queryByRole('region', {
        name: 'Local files — Polynomial-C',
      }),
    ).not.toBeInTheDocument()
  })

  it('shows a scoped chooser when the selected Release has multiple files', async () => {
    window.history.pushState({}, '', releaseUrl)
    const user = h.userEvent.setup()
    const open = h.vi.fn()
    window.discweaveDesktop = desktopBridge(open)
    const secondPath =
      '/archive/aphex-twin/selected-ambient-works-85-92/03-polynomial-c.aiff'

    seedPolynomialFiles([
      h.trackRecords[0].digitalFiles[0],
      {
        ...h.trackRecords[0].digitalFiles[0],
        digitalTrackFileLinkId: 'link-polynomial-c-aiff',
        localAudioFileId: 'local-polynomial-c-aiff',
        path: secondPath,
        format: 'AIFF',
      },
    ])

    h.render(<h.App />)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Selected Ambient Works 85-92',
    })
    await user.click(
      h.within(detailPanel).getByRole('button', {
        name: 'Open Polynomial-C in default player',
      }),
    )

    expect(open).not.toHaveBeenCalled()
    const panel = h.screen.getByRole('region', {
      name: 'Local files — Polynomial-C',
    })
    expect(h.within(panel).getByText(filePath)).toBeVisible()
    expect(h.within(panel).getByText(secondPath)).toBeVisible()
  })

  it('does not use a file from another Release appearance', () => {
    window.history.pushState({}, '', releaseUrl)
    window.discweaveDesktop = desktopBridge(h.vi.fn())
    seedPolynomialFiles(
      h.trackRecords[0].digitalFiles.map((file) => ({
        ...file,
        releaseId: 'selected-ambient-works-reissue',
        releaseTitle: 'Selected Ambient Works 85-92 Reissue',
      })),
    )

    h.render(<h.App />)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Selected Ambient Works 85-92',
    })
    expect(
      h.within(detailPanel).queryByRole('button', {
        name: 'Open Polynomial-C in default player',
      }),
    ).not.toBeInTheDocument()
    expect(
      h.within(detailPanel).getByRole('link', { name: 'Polynomial-C' }),
    ).toHaveAttribute('href', '/tracks?track=polynomial-c')
  })

  it('hands a direct-open failure to the existing retry panel', async () => {
    window.history.pushState({}, '', releaseUrl)
    const user = h.userEvent.setup()
    const open = h.vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        path: filePath,
        reason: 'missing',
        message: 'The local file does not exist.',
      })
      .mockResolvedValueOnce({ ok: true, path: filePath })
    window.discweaveDesktop = desktopBridge(open)

    h.render(<h.App />)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Selected Ambient Works 85-92',
    })
    await user.click(
      h.within(detailPanel).getByRole('button', {
        name: 'Open Polynomial-C in default player',
      }),
    )

    const panel = await h.screen.findByRole('region', {
      name: 'Local files — Polynomial-C',
    })
    expect(h.within(panel).getByRole('alert')).toHaveTextContent(
      'The local file does not exist.',
    )

    await user.click(
      h.within(panel).getByRole('button', {
        name: 'Open local file Polynomial-C Selected Ambient Works 85-92 Track 3',
      }),
    )

    expect(open).toHaveBeenCalledTimes(2)
    expect(await h.within(panel).findByText('Opened')).toBeVisible()
  })

  it('hides the action when the desktop bridge is unavailable', () => {
    window.history.pushState({}, '', releaseUrl)

    h.render(<h.App />)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Selected Ambient Works 85-92',
    })
    expect(
      h.within(detailPanel).queryByRole('button', {
        name: 'Open Polynomial-C in default player',
      }),
    ).not.toBeInTheDocument()
  })
})

function seedPolynomialFiles(
  digitalFiles: (typeof h.trackRecords)[number]['digitalFiles'],
) {
  h.seedCatalogForTests({
    artists: h.artistRecords,
    releases: h.releaseRecords,
    tracks: h.trackRecords.map((track) =>
      track.id === 'polynomial-c' ? { ...track, digitalFiles } : track,
    ),
    ownedItems: h.ownedItemRecords,
    relations: h.relationRecords,
    playlists: h.playlistRecords,
  })
}

function desktopBridge(
  open: ReturnType<typeof h.vi.fn>,
): Window['discweaveDesktop'] {
  return {
    isDesktop: true,
    exports: { download: h.vi.fn() },
    imports: { pickAndScan: h.vi.fn() },
    localFiles: { open },
  }
}
