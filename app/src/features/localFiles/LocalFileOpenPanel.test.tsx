import { act, render, screen, within } from '@testing-library/react'
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

    expect(open).toHaveBeenCalledWith({
      digitalTrackFileLinkId: 'file-a-link',
      localAudioFileId: 'file-a',
      path: '/music/a.flac',
    })
    expect(await within(panel).findByRole('status')).toHaveTextContent('Opened')
    window.discweaveDesktop = originalDesktopBridge
  })

  it('keeps each row pending until its own open request finishes', async () => {
    const user = userEvent.setup()
    const originalDesktopBridge = window.discweaveDesktop
    let resolveFirst: (value: { ok: true; path: string }) => void = () => {}
    let resolveSecond: (value: { ok: true; path: string }) => void = () => {}
    const open = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<{ ok: true; path: string }>((resolve) => {
            resolveFirst = resolve
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<{ ok: true; path: string }>((resolve) => {
            resolveSecond = resolve
          }),
      )
    window.discweaveDesktop = {
      isDesktop: true,
      exports: { download: vi.fn() },
      imports: { pickAndScan: vi.fn() },
      localFiles: { open },
    }

    render(
      <LocalFileOpenPanel
        files={[
          openableFile('first', '/music/first.flac', 'First Track'),
          openableFile('second', '/music/second.flac', 'Second Track'),
        ]}
        title="Stack local files"
        onClose={vi.fn()}
      />,
    )

    const firstButton = screen.getByRole('button', {
      name: 'Open local file First Track Selected Release Track 1',
    })
    const secondButton = screen.getByRole('button', {
      name: 'Open local file Second Track Selected Release Track 1',
    })

    await user.click(firstButton)
    expect(firstButton).toBeDisabled()

    await user.click(secondButton)
    expect(firstButton).toBeDisabled()
    expect(secondButton).toBeDisabled()

    await act(async () => {
      resolveFirst({ ok: true, path: '/music/first.flac' })
      await Promise.resolve()
    })
    expect(firstButton).not.toBeDisabled()
    expect(secondButton).toBeDisabled()

    await act(async () => {
      resolveSecond({ ok: true, path: '/music/second.flac' })
      await Promise.resolve()
    })
    expect(secondButton).not.toBeDisabled()
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
    expect(
      await screen.findByText('The local file does not exist.'),
    ).toBeVisible()

    await user.click(
      screen.getByRole('button', {
        name: 'Open local file Present Track Selected Release Track 2',
      }),
    )
    expect(await screen.findByText('Opened')).toBeVisible()
    window.discweaveDesktop = originalDesktopBridge
  })

  it('resets row results when the parent replaces the file list', () => {
    const failure = {
      ok: false as const,
      path: '/music/replacement.flac',
      reason: 'missing' as const,
      message: 'The replacement file does not exist.',
    }
    const { rerender } = render(
      <LocalFileOpenPanel
        files={[openableFile('first', '/music/first.flac', 'First Track')]}
        title="Track local files"
        onClose={vi.fn()}
      />,
    )

    expect(
      screen.queryByText('The replacement file does not exist.'),
    ).not.toBeInTheDocument()

    rerender(
      <LocalFileOpenPanel
        files={[
          openableFile('replacement', '/music/replacement.flac', 'Replacement'),
        ]}
        initialResults={{ replacement: failure }}
        title="Track local files"
        onClose={vi.fn()}
      />,
    )

    expect(
      screen.getByText('The replacement file does not exist.'),
    ).toBeVisible()
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
