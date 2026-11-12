import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PlaylistEntryForm } from './PlaylistEntryForm'
import type { PlaylistRecord } from './playlistsData'
import type { TrackRecord } from '../tracks/tracksData'

function track(id: string): TrackRecord {
  return {
    id,
    title: id,
    artist: 'Demo artist',
    release: {
      title: 'Night album',
      artist: 'Demo artist',
      year: '',
      label: '',
    },
    trackNumber: '',
    duration: '3:00',
    relationHint: '',
    tags: [],
    credits: [],
    releaseAppearances: [],
    relations: [],
    digitalFiles: [],
  }
}
const tracks = [track('A'), track('B')]
function manual(): PlaylistRecord {
  return {
    id: 'original',
    name: 'Evening',
    description: 'Demo selection',
    type: 'Manual',
    curator: '',
    updatedAt: '',
    yearRange: '',
    ruleHints: [],
    linkedReleases: [],
    tracks: [],
    serverEntries: ['A', 'B', 'A'].map((id) => ({
      kind: 'track' as const,
      id,
    })),
    manualSelection: { source: '', note: '' },
  }
}

describe('manual playlist builder', () => {
  it('preserves the draft after a failed save and retries the same track order', async () => {
    const user = userEvent.setup()
    const submit = vi
      .fn()
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce(undefined)
    render(
      <PlaylistEntryForm
        initialPlaylist={manual()}
        tracks={tracks}
        onCancel={vi.fn()}
        onSubmit={submit}
      />,
    )
    await user.type(screen.getByLabelText('Name'), ' edited')
    await user.click(screen.getByRole('button', { name: 'Save playlist' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Offline')
    expect(screen.getByLabelText('Name')).toHaveValue('Evening edited')
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(submit).toHaveBeenCalledTimes(2)
    expect(submit.mock.calls[1][0]).toMatchObject({
      name: 'Evening edited',
      serverEntries: [
        { kind: 'track', id: 'A' },
        { kind: 'track', id: 'B' },
        { kind: 'track', id: 'A' },
      ],
    })
  })
  it('submits only once while pending and disables cancellation and mutations', async () => {
    const user = userEvent.setup()
    let finish!: () => void
    const submit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    render(
      <PlaylistEntryForm
        initialPlaylist={manual()}
        tracks={tracks}
        onCancel={vi.fn()}
        onSubmit={submit}
      />,
    )
    await user.type(screen.getByLabelText('Name'), ' changed')
    const form = screen.getByRole('form')
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(submit).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByLabelText('Name')).toBeDisabled()
    finish()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled(),
    )
  })
  it('reorders A B A and removes only the chosen occurrence', async () => {
    const user = userEvent.setup()
    const submit = vi.fn<(record: PlaylistRecord) => void>()
    render(
      <PlaylistEntryForm
        initialPlaylist={manual()}
        tracks={tracks}
        onCancel={vi.fn()}
        onSubmit={submit}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Move track 1 down' }))
    await user.click(screen.getByRole('button', { name: 'Remove track 2' }))
    await user.click(screen.getByRole('button', { name: 'Save playlist' }))
    expect(
      submit.mock.calls[0][0].serverEntries?.map(
        (entry: { id: string }) => entry.id,
      ),
    ).toEqual(['B', 'A'])
  })
  it('shows immediate feedback and prevents repeat additions without collapsing existing copies', async () => {
    const user = userEvent.setup()
    const submit = vi.fn<(record: PlaylistRecord) => void>()
    render(
      <PlaylistEntryForm
        initialPlaylist={manual()}
        tracks={[...tracks, track('C')]}
        onCancel={vi.fn()}
        onSubmit={submit}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Add tracks' }))
    await user.type(screen.getByRole('searchbox'), 'Night album')
    expect(
      screen.getByRole('button', { name: 'In playlist: A' }),
    ).toBeDisabled()
    expect(
      screen.getByText('2 existing copies. Manage each one in the playlist.'),
    ).toBeVisible()
    await user.dblClick(screen.getByRole('button', { name: 'Add C' }))
    expect(
      screen.getByRole('button', { name: 'In playlist: C' }),
    ).toBeDisabled()
    expect(screen.getByText('Added “C” · 4 tracks in playlist')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'View playlist' }))
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Selected tracks' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Save playlist' }))
    expect(
      submit.mock.calls[0][0].serverEntries?.map((entry) => entry.id),
    ).toEqual(['A', 'B', 'A', 'C'])
  })

  it('permits re-adding only after all existing occurrences have been removed', async () => {
    const user = userEvent.setup()
    render(
      <PlaylistEntryForm
        initialPlaylist={manual()}
        tracks={tracks}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Add tracks' }))
    await user.click(screen.getByRole('button', { name: 'Remove track 1' }))
    expect(
      screen.getByRole('button', { name: 'In playlist: A' }),
    ).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Remove track 2' }))
    await user.click(screen.getByRole('button', { name: 'Add A' }))
    expect(screen.getByText('Added “A” · 2 tracks in playlist')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'In playlist: A' }),
    ).toBeDisabled()
  })
  it('requires explicit discard after editing and can keep editing', async () => {
    const user = userEvent.setup()
    const cancel = vi.fn()
    render(
      <PlaylistEntryForm
        initialPlaylist={manual()}
        tracks={tracks}
        onCancel={cancel}
        onSubmit={vi.fn()}
      />,
    )
    await user.type(screen.getByLabelText('Name'), ' draft')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(cancel).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(cancel).toHaveBeenCalledOnce()
  })
  it('bounds picker rows while searching the entire collection', async () => {
    const user = userEvent.setup()
    const manyTracks = Array.from({ length: 51 }, (_, index) =>
      track(`Track ${index + 1}`),
    )
    render(
      <PlaylistEntryForm
        tracks={manyTracks}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Add tracks' }))
    expect(screen.getByRole('button', { name: 'Add Track 50' })).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Add Track 51' }),
    ).not.toBeInTheDocument()
    await user.type(screen.getByRole('searchbox'), 'Track 51')
    expect(screen.getByRole('button', { name: 'Add Track 51' })).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /Show more tracks/ }),
    ).not.toBeInTheDocument()
    await user.clear(screen.getByRole('searchbox'))
    expect(
      screen.queryByRole('button', { name: 'Add Track 51' }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Show more tracks/ }))
    expect(screen.getByRole('button', { name: 'Add Track 51' })).toBeVisible()
  })
})
