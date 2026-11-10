import { useState } from 'react'
import { ArtistConnections } from './ArtistConnections'
import type { ArtistGraph } from './artistConnectionGroups'
import type { ArtistRecord } from './artistsData'

export function ArtistStackDetails({
  artist,
  artistCount,
  selectedArtistId,
  graph,
  onSelect,
}: Readonly<{
  artist: ArtistRecord
  artistCount: number
  selectedArtistId: string
  graph: ArtistGraph
  onSelect: (artistId: string, originArtistId: string) => void
}>) {
  const [open, setOpen] = useState(false)
  return (
    <details
      className="artist-stack-details"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        Explore {artist.name} · {artistCount}{' '}
        {artistCount === 1 ? 'name' : 'names'}
      </summary>
      {open ? (
        <ArtistConnections
          artistId={artist.id}
          selectedArtistId={selectedArtistId}
          graph={graph}
          compact
          onSelect={(id) => onSelect(id, artist.id)}
        />
      ) : null}
    </details>
  )
}
