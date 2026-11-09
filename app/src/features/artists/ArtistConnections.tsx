import {
  artistConnectionGroups,
  uniqueArtists,
  type ArtistGraph,
} from './artistConnectionGroups'

export function ArtistConnections({
  artistId,
  graph,
  selectedArtistId,
  onSelect,
  compact = false,
}: Readonly<{
  artistId: string
  graph: ArtistGraph
  selectedArtistId: string
  onSelect: (id: string) => void
  compact?: boolean
}>) {
  const groups = artistConnectionGroups(artistId, graph)
  if (!groups.length)
    return <p className="detail-empty">No recorded artist connections.</p>
  return (
    <div
      className={
        compact ? 'artist-connections is-compact' : 'artist-connections'
      }
    >
      {groups.map((group) => (
        <section
          className="artist-connection-group"
          key={group.title}
          aria-label={group.title}
        >
          <h3>{group.title}</h3>
          <ul>
            {group.artists.map((artist) => {
              const relationshipNotes = [
                ...new Set(
                  (graph.connections.get(artistId) ?? [])
                    .filter(
                      (item) =>
                        item.artist.id === artist.id &&
                        connectionBelongsToGroup(item.label, group.title),
                    )
                    .map((item) =>
                      [item.label, item.context].filter(Boolean).join(' · '),
                    ),
                ),
              ]
              const family = graph.familyById.get(artist.id)
              const names = (family?.artists ?? []).filter(
                (member) => member.id !== artist.id,
              )
              const otherGroups = (
                graph.connections.get(artist.id) ?? []
              ).filter(
                (item) =>
                  item.label === 'Member of' && item.artist.id !== artistId,
              )
              return (
                <li key={artist.id}>
                  <button
                    type="button"
                    className="artist-connection-button"
                    aria-label={`Open artist ${artist.name}`}
                    aria-pressed={artist.id === selectedArtistId}
                    onClick={() => onSelect(artist.id)}
                  >
                    <span className="artist-connection-title">
                      <strong>{artist.name}</strong>
                      <span className="badge badge-tag">{artist.type}</span>
                      <span aria-hidden="true">›</span>
                    </span>
                    {relationshipNotes.length > 0 ? (
                      <span className="artist-connection-notes">
                        {relationshipNotes.join('; ')}
                      </span>
                    ) : null}
                    {compact && names.length > 0 ? (
                      <span className="artist-connection-context">
                        <span>Aliases:</span>
                        <span>
                          {names.map((name) => (
                            <span className="artist-name-chip" key={name.id}>
                              {name.name}
                            </span>
                          ))}
                        </span>
                      </span>
                    ) : null}
                    {compact && otherGroups.length > 0 ? (
                      <span className="artist-connection-context">
                        <span>Also in:</span>
                        <span>
                          {uniqueArtists(otherGroups.map((item) => item.artist))
                            .map((groupArtist) => groupArtist.name)
                            .join(', ')}
                        </span>
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

function connectionBelongsToGroup(label: string, title: string) {
  if (title === 'Identities & Aliases')
    return label === 'Aliases' || label === 'Alias of'
  if (title === 'Groups & Projects') return label === 'Member of'
  if (title === 'Members') return label === 'Members'
  return !['Alias of', 'Aliases', 'Member of', 'Members'].includes(label)
}
