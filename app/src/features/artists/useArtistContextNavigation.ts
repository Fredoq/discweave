import { useEffect, useState } from 'react'
import type { ArtistRecord } from './artistsData'

type ArtistContext = {
  originId: string
  targetId: string
  locationSearch: string
}

export function useArtistContextNavigation(
  artists: ArtistRecord[],
  selectedId: string,
  locationSearch: string,
  select: (id: string) => void,
) {
  const [context, setContext] = useState<ArtistContext | null>(null)
  const isCurrentContext =
    context?.targetId === selectedId &&
    context.locationSearch === locationSearch
  if (context && !isCurrentContext) {
    setContext(null)
  }
  useEffect(() => {
    const clearContext = () => setContext(null)
    window.addEventListener('popstate', clearContext)
    window.addEventListener('discweave:navigation', clearContext)
    return () => {
      window.removeEventListener('popstate', clearContext)
      window.removeEventListener('discweave:navigation', clearContext)
    }
  }, [])
  return {
    originArtist: artists.find(
      (artist) =>
        artist.id === context?.originId &&
        isCurrentContext &&
        artist.id !== selectedId,
    ),
    selectArtist: (id: string) => {
      setContext(null)
      select(id)
    },
    selectRelatedArtist: (id: string, originId = selectedId) => {
      select(id)
      // Selection dispatches a navigation event synchronously. Establish the
      // relationship context after that event clears any previous context.
      setContext({
        originId,
        targetId: id,
        locationSearch: window.location.search,
      })
    },
  }
}
