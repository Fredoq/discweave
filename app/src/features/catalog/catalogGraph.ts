import type { ArtistRecord } from '../artists/artistsData'
import type { OwnedItemRecord } from '../ownedItems/ownedItemsData'
import type { PlaylistRecord } from '../playlists/playlistsData'
import type { ReleaseRecord } from '../releases/releasesData'
import type { RelationRecord } from '../relations/relationsData'
import type { TrackRecord } from '../tracks/tracksData'
import { catalogEntityHref, type CatalogLink } from './catalogLinks'

export type CatalogEntityType =
  | 'Artist'
  | 'Release'
  | 'Track'
  | 'Owned item'
  | 'Relation'
  | 'Playlist'

export type CatalogEntry = {
  id: string
  recordId: string
  link: CatalogLink
  href: string
  artist: string
  title: string
  type: CatalogEntityType
  year: string
  label: string
  media: string[]
  status: string
  statuses: string[]
  statusTone: 'green' | 'amber' | 'blue' | 'gray'
  relationHint: string
  credits: string[]
  tags: string[]
  storage: string
  condition: string
  summary: string
  fileFormat: string
  searchText: string
}

export type CatalogGraphData = {
  artists: ArtistRecord[]
  releases: ReleaseRecord[]
  tracks: TrackRecord[]
  ownedItems: OwnedItemRecord[]
  relations: RelationRecord[]
  playlists: PlaylistRecord[]
}

export function buildCatalogEntries(data: CatalogGraphData): CatalogEntry[] {
  return [
    ...data.artists.map((artist) => artistEntry(artist)),
    ...data.releases.map((release) => releaseEntry(release)),
    ...data.tracks.map((track) => trackEntry(track)),
    ...data.ownedItems.map((item) => ownedItemEntry(item)),
    ...data.relations.map((relation) => relationEntry(relation)),
    ...data.playlists.map((playlist) => playlistEntry(playlist)),
  ]
}

export function queryTerms(query: string) {
  return normalizeText(query).split(/\s+/).filter(Boolean)
}

export function matchesTerms(searchText: string, query: string) {
  const terms = queryTerms(query)

  return terms.every((term) => searchText.includes(term))
}

export function normalizeText(value: string) {
  return value.trim().toLowerCase()
}

export function uniqueValues(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

export function relationTouchesLink(
  relation: RelationRecord,
  link: CatalogLink,
) {
  return (
    linkMatches(relation.sourceLink, link) ||
    linkMatches(relation.targetLink, link) ||
    linkMatches(relation.linkedEntityLink, link)
  )
}

export function playlistTouchesRelease(
  playlist: PlaylistRecord,
  release: ReleaseRecord,
) {
  return (
    playlist.linkedReleases.some(
      (linkedRelease) => linkedRelease.releaseId === release.id,
    ) ||
    playlist.tracks.some((track) => track.release.id === release.id) ||
    includesText(playlistSearchText(playlist), release.title) ||
    includesText(playlistSearchText(playlist), release.artist)
  )
}

export function playlistTouchesTrack(
  playlist: PlaylistRecord,
  track: TrackRecord,
) {
  return (
    playlist.tracks.some((playlistTrack) => playlistTrack.id === track.id) ||
    includesText(playlistSearchText(playlist), track.title)
  )
}

export function playlistTouchesArtist(
  playlist: PlaylistRecord,
  artist: ArtistRecord,
) {
  return (
    playlist.curator.toLowerCase() === artist.name.toLowerCase() ||
    playlist.tracks.some(
      (track) =>
        track.artist.toLowerCase() === artist.name.toLowerCase() ||
        track.release.artist.toLowerCase() === artist.name.toLowerCase(),
    ) ||
    playlist.linkedReleases.some(
      (release) => release.artist.toLowerCase() === artist.name.toLowerCase(),
    ) ||
    phraseAppearsInText(playlistFreeText(playlist), artist.name)
  )
}

export function relationDisplayTitle(relation: RelationRecord) {
  return `${relation.source} to ${relation.target}`
}

function artistEntry(artist: ArtistRecord): CatalogEntry {
  const credits = uniqueValues([
    artist.creditHint,
    ...artist.credits.map((credit) => credit.role),
    ...artist.relations.map((relation) => relation.type),
  ])
  const link = { kind: 'artist', id: artist.id } as const

  return makeEntry({
    id: `artist:${artist.id}`,
    recordId: artist.id,
    link,
    artist: artist.name,
    title: artist.name,
    type: 'Artist',
    year: 'Not recorded',
    label: 'Not recorded',
    media: [],
    status: 'Reference',
    statusTone: 'gray',
    relationHint: artist.relationHint,
    credits,
    tags: artist.tags,
    storage: 'Artist graph',
    condition: artist.type,
    summary: artist.summary,
    fileFormat: 'Not recorded',
    searchParts: [
      artist.name,
      artist.type,
      artist.relationHint,
      artist.creditHint,
      artist.summary,
      ...artist.aliases,
      ...artist.members,
      ...artist.tags,
      ...artist.relations.flatMap((relation) => [
        relation.type,
        relation.target,
        relation.detail,
      ]),
      ...artist.credits.flatMap((credit) => [
        credit.role,
        credit.target,
        credit.scope,
      ]),
    ],
  })
}

function releaseEntry(release: ReleaseRecord): CatalogEntry {
  const media = uniqueValues(release.ownedCopies.map((copy) => copy.medium))
  const statuses = uniqueValues(release.ownedCopies.map((copy) => copy.status))
  const status = summarizeReleaseStatuses(statuses)
  const link = { kind: 'release', id: release.id } as const

  return makeEntry({
    id: `release:${release.id}`,
    recordId: release.id,
    link,
    artist: release.artist,
    title: release.title,
    type: 'Release',
    year: release.year,
    label: release.label,
    media,
    status,
    statuses,
    statusTone: aggregateStatusTone(statuses),
    relationHint: release.releaseNotes,
    credits: ['Main artist'],
    tags: [...release.genres, ...release.tags],
    storage: uniqueValues(release.ownedCopies.map((copy) => copy.storage)).join(
      ', ',
    ),
    condition: uniqueValues(
      release.ownedCopies.map((copy) => copy.condition),
    ).join(', '),
    summary: release.releaseNotes,
    fileFormat: 'Not recorded',
    searchParts: [
      release.title,
      release.artist,
      release.type,
      release.year,
      release.label,
      release.releaseNotes,
      ...release.genres,
      ...release.tags,
      ...release.ownedCopies.flatMap((copy) => [
        copy.medium,
        copy.status,
        copy.storage,
        copy.condition,
        copy.note,
      ]),
    ],
  })
}

function trackEntry(track: TrackRecord): CatalogEntry {
  const link = { kind: 'track', id: track.id } as const

  return makeEntry({
    id: `track:${track.id}`,
    recordId: track.id,
    link,
    artist: track.artist,
    title: track.title,
    type: 'Track',
    year: track.release.year,
    label: track.release.label,
    media: [],
    status:
      track.fileMetadata.format === 'FLAC' ? 'Lossless file' : 'File metadata',
    statusTone: track.fileMetadata.format === 'FLAC' ? 'blue' : 'gray',
    relationHint: track.relationHint,
    credits: uniqueValues(track.credits.map((credit) => credit.role)),
    tags: track.tags,
    storage: track.fileMetadata.path,
    condition: track.fileMetadata.bitrate,
    summary: `${track.release.title} · ${track.duration}`,
    fileFormat: track.fileMetadata.format,
    searchParts: [
      track.title,
      track.artist,
      track.release.title,
      track.release.artist,
      track.release.year,
      track.release.label,
      track.trackNumber,
      track.duration,
      track.relationHint,
      track.fileMetadata.format,
      track.fileMetadata.path,
      track.fileMetadata.bitrate,
      track.fileMetadata.sampleRate,
      track.fileMetadata.channels,
      ...track.tags,
      ...track.credits.flatMap((credit) => [
        credit.role,
        credit.artist,
        credit.scope,
      ]),
      ...track.relations.flatMap((relation) => [
        relation.type,
        relation.target,
        relation.detail,
      ]),
    ],
  })
}

function ownedItemEntry(item: OwnedItemRecord): CatalogEntry {
  const link = { kind: 'ownedItem', id: item.id } as const

  return makeEntry({
    id: `ownedItem:${item.id}`,
    recordId: item.id,
    link,
    artist: item.artist,
    title: item.releaseTitle,
    type: 'Owned item',
    year: 'Not recorded',
    label: item.linkedType,
    media: [item.medium],
    status: item.status,
    statusTone: item.statusTone,
    relationHint: item.title,
    credits: [],
    tags: item.tags,
    storage: item.storage,
    condition: item.condition,
    summary: item.copyNotes,
    fileFormat: item.fileFormat,
    searchParts: [
      item.title,
      item.releaseTitle,
      item.artist,
      item.medium,
      item.status,
      item.storage,
      item.condition,
      item.acquisition,
      item.copyNotes,
      item.linkedType,
      item.fileFormat,
      item.digitalState,
      item.digitizationState,
      ...item.tags,
    ],
  })
}

function relationEntry(relation: RelationRecord): CatalogEntry {
  const link = { kind: 'relation', id: relation.id } as const

  return makeEntry({
    id: `relation:${relation.id}`,
    recordId: relation.id,
    link,
    artist: relation.source,
    title: relationDisplayTitle(relation),
    type: 'Relation',
    year: 'Not recorded',
    label: relation.linkedEntityType,
    media: [],
    status: relation.relationType,
    statusTone: 'gray',
    relationHint: relation.context,
    credits: uniqueValues([relation.role, relation.relationType]),
    tags: relation.searchHints,
    storage: relation.linkedEntity,
    condition: relation.direction,
    summary: relation.evidence,
    fileFormat: 'Not recorded',
    searchParts: [
      relation.source,
      relation.sourceType,
      relation.target,
      relation.targetType,
      relation.relationType,
      relation.role,
      relation.context,
      relation.evidence,
      relation.linkedEntity,
      relation.linkedEntityType,
      relation.direction,
      ...relation.searchHints,
    ],
  })
}

function playlistEntry(playlist: PlaylistRecord): CatalogEntry {
  const selectionText =
    playlist.type === 'Manual'
      ? [playlist.manualSelection.source, playlist.manualSelection.note]
      : [playlist.smartRules.summary, ...playlist.smartRules.criteria]
  const link = { kind: 'playlist', id: playlist.id } as const

  return makeEntry({
    id: `playlist:${playlist.id}`,
    recordId: playlist.id,
    link,
    artist: playlist.curator,
    title: playlist.name,
    type: 'Playlist',
    year: playlist.yearRange,
    label: playlist.type,
    media: uniqueValues([
      ...playlist.tracks.flatMap((track) => track.media),
      ...playlist.linkedReleases.flatMap((release) => release.media),
    ]),
    status: playlist.type,
    statusTone: playlist.type === 'Smart' ? 'blue' : 'gray',
    relationHint: selectionText.join(' '),
    credits: [],
    tags: playlist.ruleHints,
    storage: playlist.updatedAt,
    condition: `${playlist.tracks.length} tracks`,
    summary: playlist.description,
    fileFormat: uniqueValues(
      playlist.tracks.map((track) => track.fileFormat),
    ).join(', '),
    searchParts: [playlistSearchText(playlist)],
  })
}

function makeEntry(
  entry: Omit<CatalogEntry, 'href' | 'searchText' | 'statuses'> & {
    statuses?: string[]
    searchParts: string[]
  },
): CatalogEntry {
  const { searchParts, ...baseEntry } = entry

  return {
    ...baseEntry,
    href: catalogEntityHref(entry.link),
    statuses: entry.statuses ?? [entry.status],
    searchText: searchParts.join(' ').toLowerCase(),
  }
}

function playlistSearchText(playlist: PlaylistRecord) {
  const selectionText =
    playlist.type === 'Manual'
      ? [playlist.manualSelection.source, playlist.manualSelection.note]
      : [playlist.smartRules.summary, ...playlist.smartRules.criteria]

  return [
    playlist.name,
    playlist.type,
    playlist.description,
    playlist.curator,
    playlist.updatedAt,
    playlist.yearRange,
    ...selectionText,
    ...playlist.ruleHints,
    ...playlist.tracks.flatMap((track) => [
      track.title,
      track.artist,
      track.release.title,
      track.release.artist,
      track.release.year,
      track.release.label,
      track.trackNumber,
      track.duration,
      track.fileFormat,
      track.availability,
      ...track.tags,
      ...track.media,
      ...track.ownershipStatus,
    ]),
    ...playlist.linkedReleases.flatMap((release) => [
      release.title,
      release.artist,
      release.year,
      release.availability,
      ...release.media,
      ...release.ownershipStatus,
    ]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function includesText(searchText: string, value: string) {
  return searchText.includes(normalizeText(value))
}

function playlistFreeText(playlist: PlaylistRecord) {
  const selectionText =
    playlist.type === 'Manual'
      ? [playlist.manualSelection.source, playlist.manualSelection.note]
      : [playlist.smartRules.summary, ...playlist.smartRules.criteria]

  return [
    playlist.name,
    playlist.description,
    playlist.curator,
    playlist.yearRange,
    ...selectionText,
    ...playlist.ruleHints,
  ].join(' ')
}

function phraseAppearsInText(searchText: string, phrase: string) {
  const normalizedText = normalizeText(searchText)
  const normalizedPhrase = normalizeText(phrase)

  if (!normalizedPhrase) {
    return false
  }

  return new RegExp(`(^|\\W)${escapeRegExp(normalizedPhrase)}($|\\W)`).test(
    normalizedText,
  )
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function linkMatches(left: CatalogLink | undefined, right: CatalogLink) {
  return left?.kind === right.kind && left.id === right.id
}

function summarizeReleaseStatuses(statuses: string[]) {
  return statuses.length > 0 ? statuses.join(', ') : 'Not recorded'
}

function aggregateStatusTone(statuses: string[]): CatalogEntry['statusTone'] {
  if (statuses.includes('Needs digitization')) {
    return 'amber'
  }

  if (statuses.includes('Owned')) {
    return 'green'
  }

  if (statuses.includes('Wanted')) {
    return 'blue'
  }

  return 'gray'
}
