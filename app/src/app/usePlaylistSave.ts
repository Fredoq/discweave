import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from 'react'
import {
  CatalogApiError,
  loadCatalog,
  type CatalogState,
} from '../features/catalog/catalogApi'
import type { PlaylistRecord } from '../features/playlists/playlistsData'
import { catalogErrorMessage } from './catalogErrorMessage'

type Options = {
  sessionEmail: string
  onLogout: () => void
  initialCatalogState: CatalogState | null | undefined
  setCatalog: Dispatch<SetStateAction<CatalogState>>
  setCatalogSearchRefreshKey: Dispatch<SetStateAction<number>>
  setActionStatus: Dispatch<SetStateAction<string | null>>
  setCatalogError: Dispatch<SetStateAction<string | null>>
}
export function usePlaylistSave({
  sessionEmail,
  onLogout,
  initialCatalogState,
  setCatalog,
  setCatalogSearchRefreshKey,
  setActionStatus,
  setCatalogError,
}: Options) {
  const generation = useRef(0)
  useEffect(() => {
    generation.current += 1
    return () => {
      generation.current += 1
    }
  }, [sessionEmail])
  return useCallback(
    async (
      playlist: PlaylistRecord,
      persist: (record: PlaylistRecord) => Promise<PlaylistRecord>,
    ): Promise<PlaylistRecord> => {
      const captured = generation.current
      const isCurrent = () => captured === generation.current
      setActionStatus(null)
      setCatalogError(null)
      let saved: PlaylistRecord
      try {
        saved = await persist(playlist)
      } catch (error) {
        if (
          isCurrent() &&
          error instanceof CatalogApiError &&
          error.status === 401
        )
          onLogout()
        throw error
      }
      if (!isCurrent()) return saved
      // Commit only this mutation's response; a full reload snapshot could overwrite
      // unrelated edits completed while the playlist save was pending.
      setCatalog((state) => ({
        ...state,
        playlists: state.playlists.some((item) => item.id === saved.id)
          ? state.playlists.map((item) => (item.id === saved.id ? saved : item))
          : [...state.playlists, saved],
      }))
      setCatalogSearchRefreshKey((key) => key + 1)
      setActionStatus('Playlist saved.')
      try {
        if (!initialCatalogState) await loadCatalog()
      } catch (error) {
        if (isCurrent()) {
          if (error instanceof CatalogApiError && error.status === 401)
            onLogout()
          else setCatalogError(catalogErrorMessage(error))
        }
      }
      // Refresh failure is not write failure: returning the server ID prevents a
      // retry from creating the same playlist twice.
      return saved
    },
    [
      initialCatalogState,
      onLogout,
      setActionStatus,
      setCatalog,
      setCatalogError,
      setCatalogSearchRefreshKey,
    ],
  )
}
