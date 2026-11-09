import { useState } from 'react'
import type { ArtistConnection } from './artistStacks'

export function ArtistConnections({
  artistId,
  selectedArtistId,
  connections,
  onSelect,
  path = [],
}: Readonly<{
  artistId: string
  selectedArtistId: string
  connections: Map<string, ArtistConnection[]>
  onSelect: (id: string) => void
  path?: string[]
}>) {
  const visited = [...path, artistId]
  const items = connections.get(artistId) ?? []
  if (!items.length) return <p>No recorded artist connections.</p>
  return (
    <ul className="artist-connections">
      {items.map(({ artist, label }) => {
        const repeated = visited.includes(artist.id)
        return (
          <li key={`${label}:${artist.id}`}>
            <span>{label}: </span>
            <button
              type="button"
              className={
                artist.id === selectedArtistId
                  ? 'row-title is-selected'
                  : 'row-title'
              }
              aria-pressed={artist.id === selectedArtistId}
              onClick={() => onSelect(artist.id)}
            >
              {artist.name}
            </button>
            <span className="badge badge-tag">{artist.type}</span>
            {repeated ? (
              <span className="artist-connection-note">
                Already shown in this branch
              </span>
            ) : (
              <ConnectionBranch
                artistId={artist.id}
                selectedArtistId={selectedArtistId}
                name={artist.name}
                connections={connections}
                onSelect={onSelect}
                path={visited}
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}

function ConnectionBranch(
  props: Readonly<{
    artistId: string
    selectedArtistId: string
    name: string
    connections: Map<string, ArtistConnection[]>
    onSelect: (id: string) => void
    path: string[]
  }>,
) {
  const [open, setOpen] = useState(false)
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Connections of {props.name}</summary>
      {open ? <ArtistConnections {...props} /> : null}
    </details>
  )
}
