import type { ArtistRecord } from '../artists/artistsData'
import type { OwnedItemRecord } from '../ownedItems/ownedItemsData'
import type { ReleaseRecord } from '../releases/releasesData'
import type { TrackRecord } from '../tracks/tracksData'

export type CatalogEntityKind = 'artist' | 'release' | 'track' | 'ownedItem'

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
  }
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
