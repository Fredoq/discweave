import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PlaylistsWorkspace } from './PlaylistsWorkspace'
import type { PlaylistRecord } from './playlistsData'

describe('PlaylistsWorkspace', () => {
  it('preserves server playlist rules and entries when saving an edit', async () => {
    const smartPlaylist: PlaylistRecord = {
      id: 'playlist-smart-rules',
      name: 'Smart rules playlist',
      type: 'Smart',
      description: 'Server-backed smart playlist.',
      curator: 'Default collection',
      updatedAt: '2026-05-24',
      yearRange: '1992-1999',
      ruleHints: ['idm', 'lossless'],
      tracks: [],
      linkedReleases: [],
      serverEntries: [
        {
          kind: 'track',
          id: '00000000-0000-7000-8000-000000000333',
          title: 'Polynomial-C',
        },
      ],
      serverRules: {
        tags: ['idm'],
        genres: ['Electronic'],
        media: ['Digital'],
        ownershipStatuses: ['Owned'],
        yearFrom: 1992,
        yearTo: 1999,
      },
      smartRules: {
        summary: 'Server rules select owned digital IDM tracks.',
        criteria: ['Tag is idm.', 'Media is Digital.'],
      },
    }
    const onUpdatePlaylist = vi.fn()
    const user = userEvent.setup()

    render(
      <PlaylistsWorkspace
        locationSearch="?playlist=playlist-smart-rules"
        onUpdatePlaylist={onUpdatePlaylist}
        playlists={[smartPlaylist]}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Edit record' }))
    const form = screen.getByRole('form', { name: 'Edit playlist' })
    await user.clear(within(form).getByLabelText('Name'))
    await user.type(within(form).getByLabelText('Name'), 'Edited smart rules')
    await user.click(within(form).getByRole('button', { name: 'Save record' }))

    expect(onUpdatePlaylist).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Edited smart rules',
        serverEntries: smartPlaylist.serverEntries,
        serverRules: smartPlaylist.serverRules,
      }),
    )
  })
})
