import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { LocalOpenableFile } from './localFileOpenModel'
import { LocalFileOpenPanel } from './LocalFileOpenPanel'

describe('LocalFileOpenPanel', () => {
  it('opens individual files and never renders an Open all action', async () => {
    const user = userEvent.setup()
    const originalDesktopBridge = window.discweaveDesktop
    const open = vi.fn().mockResolvedValue({ ok: true, path: '/music/a.flac' })
    window.discweaveDesktop = {
      isDesktop: true,
      exports: { download: vi.fn() },
      imports: { pickAndScan: vi.fn() },
      localFiles: { open },
    }

    render(
      <LocalFileOpenPanel
        files={[openableFile('file-a', '/music/a.flac')]}
        title="Release local files"
        onClose={vi.fn()}
      />,
    )

    const panel = screen.getByRole('region', { name: 'Release local files' })
    expect(
      within(panel).queryByRole('button', { name: /open all/i }),
    ).not.toBeInTheDocument()

    await user.click(
      within(panel).getByRole('button', {
        name: 'Open local file Track A Selected Release Track 1',
      }),
    )

    expect(open).toHaveBeenCalledWith('/music/a.flac')
    expect(await within(panel).findByText('Opened')).toBeVisible()
    window.discweaveDesktop = originalDesktopBridge
  })

  it('shows a row-level failure without hiding other rows', async () => {
    const user = userEvent.setup()
    const originalDesktopBridge = window.discweaveDesktop
    const open = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        path: '/music/missing.flac',
        reason: 'missing',
        message: 'The local file does not exist.',
      })
      .mockResolvedValueOnce({ ok: true, path: '/music/present.flac' })
    window.discweaveDesktop = {
      isDesktop: true,
      exports: { download: vi.fn() },
      imports: { pickAndScan: vi.fn() },
      localFiles: { open },
    }

    render(
      <LocalFileOpenPanel
        files={[
          openableFile(
            'missing',
            '/music/missing.flac',
            'Missing Track',
            'Track 1',
          ),
          openableFile(
            'present',
            '/music/present.flac',
            'Present Track',
            'Track 2',
          ),
        ]}
        title="Stack local files"
        onClose={vi.fn()}
      />,
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Open local file Missing Track Selected Release Track 1',
      }),
    )
    expect(await screen.findByText('The local file does not exist.')).toBeVisible()

    await user.click(
      screen.getByRole('button', {
        name: 'Open local file Present Track Selected Release Track 2',
      }),
    )
    expect(await screen.findByText('Opened')).toBeVisible()
    window.discweaveDesktop = originalDesktopBridge
  })
})

function openableFile(
  id: string,
  path: string,
  trackTitle = 'Track A',
  position = 'Track 1',
): LocalOpenableFile {
  return {
    id,
    dedupeKey: `local:${id}`,
    trackId: 'track-a',
    trackTitle,
    localAudioFileId: id,
    digitalTrackFileLinkId: `${id}-link`,
    path,
    format: 'FLAC',
    releaseTitle: 'Selected Release',
    position,
  }
}
