import type { ArtistRecord } from './artistsData'
import type { buildArtistGraph } from './artistStacks'

export type ArtistGraph = ReturnType<typeof buildArtistGraph>

export function artistConnectionGroups(artistId: string, graph: ArtistGraph) {
  const family = graph.familyById.get(artistId)
  const aliases = (family?.artists ?? []).filter(
    (artist) => artist.id !== artistId,
  )
  const direct = graph.connections.get(artistId) ?? []
  return [
    { title: 'Identities & Aliases', artists: aliases },
    {
      title: 'Groups & Projects',
      artists: uniqueArtists(
        direct
          .filter((item) => item.label === 'Member of')
          .map((item) => item.artist),
      ),
    },
    {
      title: 'Members',
      artists: uniqueArtists(
        direct
          .filter((item) => item.label === 'Members')
          .map((item) => item.artist),
      ),
    },
    {
      title: 'Other connections',
      artists: uniqueArtists(
        direct
          .filter(
            (item) =>
              !['Alias of', 'Aliases', 'Member of', 'Members'].includes(
                item.label,
              ),
          )
          .map((item) => item.artist),
      ),
    },
  ].filter((group) => group.artists.length > 0)
}

export function uniqueArtists(artists: ArtistRecord[]) {
  return [...new Map(artists.map((artist) => [artist.id, artist])).values()]
}
