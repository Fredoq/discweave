import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PlaylistsWorkspace } from './PlaylistsWorkspace'
import type { PlaylistRecord } from './playlistsData'
import type { TrackRecord } from '../tracks/tracksData'
import type { ReleaseRecord } from '../releases/releasesData'

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

function legacy(): PlaylistRecord {
  return {
    ...manual(),
    serverEntries: [
      { kind: 'track', id: 'A' },
      { kind: 'release', id: 'R' },
      { kind: 'track', id: 'A' },
    ],
  }
}
function release(): ReleaseRecord {
  return {
    id: 'R',
    title: 'Album',
    artist: 'Demo',
    type: 'Album',
    year: '',
    label: '',
    genres: [],
    tags: [],
    releaseNotes: '',
    ownedCopies: [],
    tracklist: [
      {
        trackId: 'B',
        title: 'B',
        position: '1',
        isReleaseOnly: false,
        artistCredits: [],
      },
    ],
  }
}
describe('tracks-only playlist workspace', () => {
  it('does not write on opening a legacy playlist and preserves mixed projected order', () => {
    const update = vi.fn(),
      add = vi.fn<(record: PlaylistRecord) => void>()
    const original = legacy()
    const snapshot = structuredClone(original)
    render(
      <PlaylistsWorkspace
        playlists={[original]}
        tracks={tracks}
        releases={[release()]}
        onUpdatePlaylist={update}
        onAddPlaylist={add}
        locationSearch=""
      />,
    )
    expect(
      screen.queryByRole('button', { name: 'Edit playlist' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Original playlist preserved')).toBeInTheDocument()
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(
      ['A', 'B', 'A'],
    )
    expect(update).not.toHaveBeenCalled()
    expect(add).not.toHaveBeenCalled()
    expect(original).toEqual(snapshot)
  })
  it('creates a reviewed copy only after explicit save and never updates the original', async () => {
    const user = userEvent.setup()
    const update = vi.fn(),
      add = vi.fn<(record: PlaylistRecord) => void>()
    render(
      <PlaylistsWorkspace
        playlists={[legacy()]}
        tracks={tracks}
        releases={[release()]}
        onUpdatePlaylist={update}
        onAddPlaylist={add}
        locationSearch=""
      />,
    )
    await user.click(
      screen.getByRole('button', { name: 'Create a track-only copy' }),
    )
    expect(add).not.toHaveBeenCalled()
    const save = screen.getByRole('button', { name: 'Save playlist' })
    expect(save).toBeEnabled()
    await user.click(save)
    expect(add).toHaveBeenCalledOnce()
    expect(update).not.toHaveBeenCalled()
    expect(
      add.mock.calls[0][0].serverEntries?.map(
        (entry: { id: string }) => entry.id,
      ),
    ).toEqual(['A', 'B', 'A'])
    expect(add.mock.calls[0][0].id).not.toBe('original')
  })
  it('blocks lossy copies when release tracks lack catalog track identities', () => {
    const album = release()
    if (!album.tracklist) throw new Error('Expected demo tracklist')
    album.tracklist[0] = {
      ...album.tracklist[0],
      trackId: undefined,
      isReleaseOnly: true,
    }
    render(
      <PlaylistsWorkspace
        playlists={[legacy()]}
        tracks={tracks}
        releases={[album]}
        locationSearch=""
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Create a track-only copy' }),
    ).toBeDisabled()
    expect(
      screen.getByText('Some tracks could not be resolved'),
    ).toBeInTheDocument()
  })
  it('keeps Smart playlists read-only without changing their rules', () => {
    const base = manual()
    const smart: PlaylistRecord = {
      ...base,
      type: 'Smart',
      serverRules: {
        tags: ['Ambient'],
        genres: [],
        media: [],
        ownershipStatuses: [],
      },
      smartRules: {
        summary: 'Ambient selection',
        criteria: ['Tag is Ambient'],
      },
    }
    const snapshot = structuredClone(smart)
    const update = vi.fn()
    render(
      <PlaylistsWorkspace
        playlists={[smart]}
        tracks={tracks}
        onUpdatePlaylist={update}
        locationSearch=""
      />,
    )
    expect(screen.getByText('Tag is Ambient')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Edit playlist' }),
    ).not.toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
    expect(smart).toEqual(snapshot)
  })
  it('uses the persisted server ID after creating a new playlist', async () => {
    const user = userEvent.setup()
    const add = vi.fn((record: PlaylistRecord) =>
      Promise.resolve({
        ...record,
        id: 'server-playlist',
      }),
    )
    render(
      <PlaylistsWorkspace
        tracks={tracks}
        onAddPlaylist={add}
        locationSearch=""
      />,
    )
    await user.click(screen.getByRole('button', { name: 'New playlist' }))
    const form = screen.getByRole('form')
    await user.type(within(form).getByLabelText('Name'), 'Saved selection')
    await user.click(screen.getByRole('button', { name: 'Save playlist' }))
    expect(
      await screen.findByRole('heading', { name: 'Saved selection' }),
    ).toBeInTheDocument()
    expect(window.location.search).toBe('?playlist=server-playlist')
  })
  it('deletes only the selected manual playlist after explicit confirmation', async () => {
    const user = userEvent.setup()
    const original = manual()
    const snapshot = structuredClone({ original, tracks })
    const remove = vi.fn<(id: string) => void>()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(
      <PlaylistsWorkspace
        playlists={[original]}
        tracks={tracks}
        onDeletePlaylist={remove}
      />,
    )
    const button = screen.getByRole('button', { name: 'Delete playlist' })
    await user.click(button)
    expect(remove).not.toHaveBeenCalled()
    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining(
        'Tracks and releases in your collection will not be deleted',
      ),
    )
    confirm.mockReturnValue(true)
    await user.click(button)
    expect(remove).toHaveBeenCalledExactlyOnceWith('original')
    expect({ original, tracks }).toEqual(snapshot)
    confirm.mockRestore()
  })

  it('does not expose deletion for a read-only Smart playlist', () => {
    const base = manual()
    const smart: PlaylistRecord = {
      ...base,
      type: 'Smart',
      smartRules: { summary: 'Ambient', criteria: ['Genre: Ambient'] },
    }
    render(
      <PlaylistsWorkspace
        playlists={[smart]}
        tracks={tracks}
        onDeletePlaylist={vi.fn()}
      />,
    )
    expect(
      screen.queryByRole('button', { name: 'Delete playlist' }),
    ).not.toBeInTheDocument()
  })
})
