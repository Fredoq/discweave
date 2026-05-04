import type { ArtistRecord } from '../artists/artistsData'
import type { OwnedItemRecord } from '../ownedItems/ownedItemsData'
import type { PlaylistRecord } from '../playlists/playlistsData'
import type { ReleaseRecord } from '../releases/releasesData'
import type { RelationRecord } from '../relations/relationsData'
import type { TrackRecord } from '../tracks/tracksData'

export type CatalogEntityKind =
  | 'artist'
  | 'release'
  | 'track'
  | 'ownedItem'
  | 'relation'
  | 'playlist'

export type CatalogLink = {
  kind: CatalogEntityKind
  id: string
}

export type CatalogLinkOption = CatalogLink & {
  value: string
  name: string
  label: string
  typeLabel: string
}

export type CatalogLinkData = {
  artists: ArtistRecord[]
  releases: ReleaseRecord[]
  tracks: TrackRecord[]
  ownedItems: OwnedItemRecord[]
  relations?: RelationRecord[]
  playlists?: PlaylistRecord[]
}

export function catalogLinkValue(kind: CatalogEntityKind, id: string) {
  return `${kind}:${id}`
}

export function catalogEntityHref(link: CatalogLink) {
  switch (link.kind) {
    case 'artist':
      return `/artists?artist=${encodeURIComponent(link.id)}`
    case 'release':
      return `/releases?release=${encodeURIComponent(link.id)}`
    case 'track':
      return `/tracks?track=${encodeURIComponent(link.id)}`
    case 'ownedItem':
      return `/owned-items?ownedItem=${encodeURIComponent(link.id)}`
    case 'relation':
      return `/relations?relation=${encodeURIComponent(link.id)}`
    case 'playlist':
      return `/playlists?playlist=${encodeURIComponent(link.id)}`
  }
}

export function catalogLinkOptions(data: CatalogLinkData): CatalogLinkOption[] {
  return [
    ...data.artists.map((artist) =>
      catalogOption('artist', artist.id, artist.name, 'Artist'),
    ),
    ...data.releases.map((release) =>
      catalogOption('release', release.id, release.title, 'Release'),
    ),
    ...data.tracks.map((track) =>
      catalogOption('track', track.id, track.title, 'Track'),
    ),
    ...data.ownedItems.map((item) =>
      catalogOption('ownedItem', item.id, item.title, 'Owned item'),
    ),
    ...(data.relations ?? []).map((relation) =>
      catalogOption(
        'relation',
        relation.id,
        relationDisplayName(relation),
        'Relation',
      ),
    ),
    ...(data.playlists ?? []).map((playlist) =>
      catalogOption('playlist', playlist.id, playlist.name, 'Playlist'),
    ),
  ]
}

export function findCatalogOption(options: CatalogLinkOption[], value: string) {
  return options.find((option) => option.value === value) ?? null
}

export function hasCatalogLink(data: CatalogLinkData, link: CatalogLink) {
  switch (link.kind) {
    case 'artist':
      return data.artists.some((artist) => artist.id === link.id)
    case 'release':
      return data.releases.some((release) => release.id === link.id)
    case 'track':
      return data.tracks.some((track) => track.id === link.id)
    case 'ownedItem':
      return data.ownedItems.some((item) => item.id === link.id)
    case 'relation':
      return (data.relations ?? []).some((relation) => relation.id === link.id)
    case 'playlist':
      return (data.playlists ?? []).some((playlist) => playlist.id === link.id)
  }
}

export function findCatalogTextLink(
  data: CatalogLinkData,
  text: string,
  preferredKinds: CatalogEntityKind[] = [
    'artist',
    'release',
    'track',
    'ownedItem',
    'relation',
    'playlist',
  ],
): CatalogLink | null {
  const normalizedText = normalizeCatalogText(text)

  if (!normalizedText) {
    return null
  }

  for (const kind of preferredKinds) {
    const link = findCatalogTextLinkByKind(data, normalizedText, kind)

    if (link) {
      return link
    }
  }

  return null
}

export function relationDisplayName(relation: RelationRecord) {
  return `${relation.source} to ${relation.target}`
}

function catalogOption(
  kind: CatalogEntityKind,
  id: string,
  name: string,
  typeLabel: string,
): CatalogLinkOption {
  return {
    kind,
    id,
    value: catalogLinkValue(kind, id),
    name,
    label: `${typeLabel}: ${name}`,
    typeLabel,
  }
}

function findCatalogTextLinkByKind(
  data: CatalogLinkData,
  normalizedText: string,
  kind: CatalogEntityKind,
): CatalogLink | null {
  switch (kind) {
    case 'artist': {
      const artist = data.artists.find(
        (record) => normalizeCatalogText(record.name) === normalizedText,
      )

      return artist ? { kind, id: artist.id } : null
    }
    case 'release': {
      const release = data.releases.find(
        (record) => normalizeCatalogText(record.title) === normalizedText,
      )

      return release ? { kind, id: release.id } : null
    }
    case 'track': {
      const track = data.tracks.find(
        (record) => normalizeCatalogText(record.title) === normalizedText,
      )

      return track ? { kind, id: track.id } : null
    }
    case 'ownedItem': {
      const item = data.ownedItems.find(
        (record) => normalizeCatalogText(record.title) === normalizedText,
      )

      return item ? { kind, id: item.id } : null
    }
    case 'relation': {
      const relation = (data.relations ?? []).find(
        (record) =>
          normalizeCatalogText(relationDisplayName(record)) === normalizedText,
      )

      return relation ? { kind, id: relation.id } : null
    }
    case 'playlist': {
      const playlist = (data.playlists ?? []).find(
        (record) => normalizeCatalogText(record.name) === normalizedText,
      )

      return playlist ? { kind, id: playlist.id } : null
    }
  }
}

function normalizeCatalogText(text: string) {
  return text.trim().toLowerCase()
}
