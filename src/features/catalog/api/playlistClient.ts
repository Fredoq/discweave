import type { PlaylistRecord } from '../../playlists/playlistsData'
import { getAllPages, getJson, sendDelete, sendJson } from './httpClient'
import { toPlaylistRecord, toPlaylistRequest } from './playlistMappers'
import { updateTestCatalogState } from './testCatalogStore'
import type { ListResponse, PlaylistDto } from './catalogTypes'

export async function loadPlaylists(): Promise<ListResponse<PlaylistRecord>> {
  const response = await getAllPages<PlaylistDto>('/api/playlists')

  return {
    ...response,
    items: response.items.map(toPlaylistRecord),
  }
}

export async function getPlaylist(playlistId: string) {
  const playlist = await getJson<PlaylistDto>(`/api/playlists/${playlistId}`)

  return playlist ? toPlaylistRecord(playlist) : null
}

export async function createPlaylist(playlist: PlaylistRecord) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      playlists: [...state.playlists, playlist],
    }))
  ) {
    return playlist
  }

  return toPlaylistRecord(
    await sendJson<PlaylistDto>(
      '/api/playlists',
      'POST',
      toPlaylistRequest(playlist),
    ),
  )
}

export async function updatePlaylist(playlist: PlaylistRecord) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      playlists: state.playlists.map((record) =>
        record.id === playlist.id ? playlist : record,
      ),
    }))
  ) {
    return playlist
  }

  return toPlaylistRecord(
    await sendJson<PlaylistDto>(
      `/api/playlists/${playlist.id}`,
      'PUT',
      toPlaylistRequest(playlist),
    ),
  )
}

export async function deletePlaylist(playlistId: string) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      playlists: state.playlists.filter(
        (playlist) => playlist.id !== playlistId,
      ),
    }))
  ) {
    return
  }

  await sendDelete(`/api/playlists/${playlistId}`, `playlist:${playlistId}`)
}
