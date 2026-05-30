import {
  activeTagRoleMappings,
  type TagRoleMapping,
} from '../catalog/catalogApi'
import { trackArtistDisplay } from '../tracks/trackDisplayHelpers'
import type { TrackCredit, TrackRecord } from '../tracks/tracksData'

export type LocalEditableReleaseContext = {
  title: string
  artists: string
  year: string
  releaseDate?: string
  label: string
  catalogNumber?: string
  source?: string
}

export type LocalEditTagValue = string | string[] | number | null

export type KnownLocalEditTags = {
  title?: string | null
  artists?: string[]
  album?: string | null
  albumArtists?: string[]
  trackNumber?: number | null
  date?: string | null
  year?: number | null
  genre?: string[]
  label?: string | null
  catalogNumber?: string | null
  composer?: string[]
  producer?: string[]
  remixer?: string[]
}

export type LocalEditTags = KnownLocalEditTags & {
  [customTagField: string]: LocalEditTagValue | undefined
}

export type LocalEditableFile = {
  ownedItemId: string
  title: string
  position: string
  trackArtists: string
  currentPath: string
  targetPath?: string
  release: LocalEditableReleaseContext
  tags: LocalEditTags
}

export function localEditableFileFromTrack(
  track: TrackRecord,
  tagRoleMappings: TagRoleMapping[] = activeTagRoleMappings,
  roleLabelsByCode: ReadonlyMap<string, string> = new Map(),
): LocalEditableFile | null {
  const ownedItemId = track.fileMetadata.ownedItemId
  if (!ownedItemId) {
    return null
  }

  return {
    ownedItemId,
    title: track.title,
    position: track.trackNumber,
    trackArtists: trackArtistDisplay(track),
    currentPath: track.fileMetadata.path,
    targetPath: track.fileMetadata.path,
    release: {
      title: track.release.title,
      artists: track.release.artist,
      year: track.release.year,
      releaseDate: track.release.releaseDate,
      label: releaseTagLabel(track),
      catalogNumber: track.release.catalogNumber,
    },
    tags: tagsFromTrack(track, tagRoleMappings, roleLabelsByCode),
  }
}

export function isLocalEditsAvailable() {
  return Boolean(
    window.cratebaseDesktop?.isDesktop && window.cratebaseDesktop.localEdits,
  )
}

function parseOptionalInt(value: string) {
  const parsed = Number.parseInt(value, 10)

  return Number.isFinite(parsed) ? parsed : null
}

function releaseTagDate(releaseDate: string | undefined, year: string) {
  if (releaseDate?.trim()) {
    return releaseDate.trim()
  }

  return /^\d{4}$/.test(year.trim()) ? year.trim() : null
}

function releaseTagLabel(track: TrackRecord) {
  const firstStructuredLabel = track.release.labels
    ?.map((label) => label.name.trim())
    .find(Boolean)
  if (firstStructuredLabel) {
    return firstStructuredLabel
  }

  return releaseTagLabelFromDisplay(
    track.release.label,
    track.release.catalogNumber,
  )
}

function releaseTagLabelFromDisplay(
  label: string,
  catalogNumber: string | undefined,
) {
  const trimmedLabel = label.trim()
  const trimmedCatalogNumber = catalogNumber?.trim()
  if (!trimmedCatalogNumber) {
    return trimmedLabel
  }

  return trimmedLabel
    .replace(new RegExp(`\\s+${escapeRegExp(trimmedCatalogNumber)}$`, 'i'), '')
    .trim()
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function splitArtistDisplay(value: string) {
  return value
    .split(',')
    .map((artist) => artist.trim())
    .filter(Boolean)
}

function tagsFromTrack(
  track: TrackRecord,
  tagRoleMappings: TagRoleMapping[],
  roleLabelsByCode: ReadonlyMap<string, string>,
): LocalEditTags {
  const tags: LocalEditTags = {
    title: track.title,
    artists: localTagArtists(track, roleLabelsByCode),
    album: track.release.title,
    albumArtists: splitArtistDisplay(track.release.artist),
    trackNumber: parseOptionalInt(track.trackNumber),
    date: releaseTagDate(track.release.releaseDate, track.release.year),
    year: parseOptionalInt(track.release.year),
    genre: localTagGenres(track),
    label: releaseTagLabel(track),
    catalogNumber: track.release.catalogNumber,
  }

  for (const mapping of tagRoleMappings.filter((item) => item.isActive)) {
    const artists = track.credits
      .filter((credit) =>
        roleMatches(
          credit,
          mapping.creditRoleCode,
          roleLabelsByCode.get(mapping.creditRoleCode),
        ),
      )
      .map((credit) => credit.artist.trim())
      .filter(Boolean)
    if (artists.length === 0) {
      continue
    }

    tags[mapping.tagField] = uniqueValues([
      ...tagList(tags[mapping.tagField]),
      ...artists,
    ])
  }

  return tags
}

function localTagArtists(
  track: TrackRecord,
  roleLabelsByCode: ReadonlyMap<string, string>,
) {
  const trackMainArtists = track.credits
    .filter((credit) =>
      roleMatches(credit, 'mainArtist', roleLabelsByCode.get('mainArtist')),
    )
    .map((credit) => credit.artist.trim())
    .filter(Boolean)

  if (trackMainArtists.length > 0) {
    return uniqueValues(trackMainArtists)
  }

  const releaseArtists = splitArtistDisplay(track.release.artist)
  if (releaseArtists.length > 0) {
    return releaseArtists
  }

  return splitArtistDisplay(trackArtistDisplay(track))
}

function localTagGenres(track: TrackRecord) {
  if (track.genres && track.genres.length > 0) {
    return track.genres
  }

  if (track.release.genres && track.release.genres.length > 0) {
    return track.release.genres
  }

  return track.tags
}

function roleMatches(
  credit: TrackCredit,
  creditRoleCode: string,
  creditRoleLabel?: string,
) {
  const normalizedCreditRole = normalizeRole(credit.role)

  return (
    normalizedCreditRole === normalizeRole(creditRoleCode) ||
    (creditRoleLabel
      ? normalizedCreditRole === normalizeRole(creditRoleLabel)
      : false)
  )
}

function normalizeRole(role: string) {
  return role.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function uniqueValues(values: string[]) {
  return [...new Set(values)]
}

function tagList(value: LocalEditTagValue | undefined) {
  return Array.isArray(value)
    ? value.map((item) => item.trim()).filter(Boolean)
    : []
}
