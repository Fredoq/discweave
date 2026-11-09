import { useEffect, useState } from 'react'
import type { ArtistRecord } from './artistsData'

export function useArtistContextNavigation(
  artists: ArtistRecord[],
  selectedId: string,
  select: (id: string) => void,
) {
  const [originId, setOriginId] = useState('')
  useEffect(() => {
    const clearOrigin = () => setOriginId('')
    window.addEventListener('popstate', clearOrigin)
    return () => window.removeEventListener('popstate', clearOrigin)
  }, [])
  return {
    originArtist: artists.find(
      (artist) => artist.id === originId && artist.id !== selectedId,
    ),
    selectRelatedArtist: (id: string) => {
      setOriginId(selectedId)
      select(id)
    },
  }
}
