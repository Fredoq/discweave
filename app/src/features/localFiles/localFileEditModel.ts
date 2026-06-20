import {
  activeTagRoleMappings,
  type TagRoleMapping,
} from '../catalog/catalogApi'
import {
  primaryTrackDigitalFile,
  trackArtistDisplay,
} from '../tracks/trackDisplayHelpers'
import type {
  TrackCredit,
  TrackDigitalFile,
  TrackRecord,
} from '../tracks/tracksData'

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
  comment?: string | null
  composer?: string[]
  producer?: string[]
  remixer?: string[]
}

export type LocalEditTags = KnownLocalEditTags & {
  [customTagField: string]: LocalEditTagValue | undefined
}

export type LocalEditableFile = {
  rowId: string
  digitalTrackFileLinkId?: string
  localAudioFileId: string
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
  const digitalFile = primaryTrackDigitalFile(track)

  return digitalFile
    ? localEditableFileFromTrackDigitalFile(
        track,
        digitalFile,
        tagRoleMappings,
        roleLabelsByCode,
      )
    : null
}

export function localEditableFileFromTrackRelease(
  track: TrackRecord,
  releaseId: string,
  tagRoleMappings: TagRoleMapping[] = activeTagRoleMappings,
  roleLabelsByCode: ReadonlyMap<string, string> = new Map(),
): LocalEditableFile | null {
  const digitalFile = track.digitalFiles.find(
    (file) => file.releaseId === releaseId,
  )

  return digitalFile
    ? localEditableFileFromTrackDigitalFile(
        track,
        digitalFile,
        tagRoleMappings,
        roleLabelsByCode,
      )
    : null
}

export function localEditableFileFromTrackDigitalFile(
  track: TrackRecord,
  digitalFile: TrackDigitalFile,
  tagRoleMappings: TagRoleMapping[] = activeTagRoleMappings,
  roleLabelsByCode: ReadonlyMap<string, string> = new Map(),
): LocalEditableFile | null {
  if (!digitalFile.localAudioFileId) {
    return null
  }

  return {
    rowId: digitalFile.digitalTrackFileLinkId || digitalFile.localAudioFileId,
    digitalTrackFileLinkId: digitalFile.digitalTrackFileLinkId,
    localAudioFileId: digitalFile.localAudioFileId,
    title: track.title,
    position: digitalFile.position || track.trackNumber,
    trackArtists: trackArtistDisplay(track),
    currentPath: digitalFile.path,
    targetPath: digitalFile.path,
    release: releaseContextFromDigitalFile(track, digitalFile),
    tags: tagsFromTrack(
      track,
      releaseContextFromDigitalFile(track, digitalFile),
      digitalFile.position || track.trackNumber,
      tagRoleMappings,
      roleLabelsByCode,
    ),
  }
}

export function isLocalEditsAvailable() {
  return Boolean(
    window.discweaveDesktop?.isDesktop && window.discweaveDesktop.localEdits,
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

function releaseContextFromDigitalFile(
  track: TrackRecord,
  digitalFile: TrackDigitalFile,
): LocalEditableReleaseContext {
  return {
    title: digitalFile.releaseTitle || track.release.title,
    artists: digitalFile.releaseArtist?.trim() || track.release.artist,
    year: digitalFile.releaseYear?.trim() || track.release.year,
    releaseDate: digitalFile.releaseDate?.trim() || track.release.releaseDate,
    label: digitalFile.releaseLabel?.trim() || releaseTagLabel(track),
    catalogNumber:
      digitalFile.releaseCatalogNumber?.trim() || track.release.catalogNumber,
  }
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
  release: LocalEditableReleaseContext,
  position: string,
  tagRoleMappings: TagRoleMapping[],
  roleLabelsByCode: ReadonlyMap<string, string>,
): LocalEditTags {
  const tags: LocalEditTags = {
    title: track.title,
    artists: localTagArtists(track, roleLabelsByCode, release.artists),
    album: release.title,
    albumArtists: splitArtistDisplay(release.artists),
    trackNumber: parseOptionalInt(position),
    date: releaseTagDate(release.releaseDate, release.year),
    year: parseOptionalInt(release.year),
    genre: localTagGenres(track),
    label: release.label,
    catalogNumber: release.catalogNumber,
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
  releaseArtistsDisplay: string,
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

  const releaseArtists = splitArtistDisplay(releaseArtistsDisplay)
  if (releaseArtists.length > 0) {
    return releaseArtists
  }

  return splitArtistDisplay(trackArtistDisplay(track))
}

function localTagGenres(track: TrackRecord) {
  if (track.genres && track.genres.length > 0) {
    return firstTagValue(track.genres)
  }

  if (track.release.genres && track.release.genres.length > 0) {
    return firstTagValue(track.release.genres)
  }

  return firstTagValue(track.tags)
}

function firstTagValue(values: string[] | undefined) {
  const firstValue = values?.map((value) => value.trim()).find(Boolean)

  return firstValue ? [firstValue] : []
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
