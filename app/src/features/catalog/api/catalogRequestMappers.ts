import type { ArtistType } from '../../artists/artistsData'
import type {
  ReleaseArtistCredit,
  ReleaseLabel,
  ReleaseTracklistSubmissionRow,
  ReleaseType,
} from '../../releases/releasesData'
import type { TrackCredit, TrackRecord } from '../../tracks/tracksData'
import { isManualSessionRecord } from '../../manualEntry/manualEntryUtils'
import { parseDurationText } from '../durationFormat'
import { dictionaryCode, mediaEntryByLabelOrCode } from './catalogDefaults'
import { toCreditRoleCode } from './catalogValueMappers'
import type { DictionaryEntry, MediumDto } from './catalogTypes'

export function toArtistTypeCode(type: ArtistType) {
  return type === 'Band' || type === 'Collective' || type === 'Project'
    ? 'group'
    : 'person'
}

export function toReleaseTypeCode(type: ReleaseType) {
  return dictionaryCode('releaseType', type)
}

export function toReleaseArtistCreditRequest(credit: ReleaseArtistCredit) {
  const roles =
    credit.roles && credit.roles.length > 0 ? credit.roles : [credit.role]

  return {
    artistId: credit.artistId,
    name: credit.artistId ? null : credit.artist,
    role: toCreditRoleCode(roles[0]),
    roles: roles.map((role) => toCreditRoleCode(role)),
  }
}

export function toTrackCreditRequest(credit: TrackCredit) {
  const roles =
    credit.roles && credit.roles.length > 0 ? credit.roles : [credit.role]

  return {
    artistId: credit.artistId,
    name: credit.artistId ? null : credit.artist,
    role: toCreditRoleCode(roles[0]),
    roles: roles.map((role) => toCreditRoleCode(role)),
  }
}

export function toTrackAppearanceRequest(
  appearance: TrackRecord['releaseAppearances'][number],
) {
  return {
    releaseId: appearance.releaseId,
    position: parseTrackPosition(appearance.position),
    disc: textOrNull(appearance.disc),
    side: textOrNull(appearance.side),
  }
}

export function toReleaseTracklistRequest(
  track: TrackRecord,
  index: number,
  releaseId: string,
) {
  const position = parseTrackPosition(track.trackNumber, index + 1)
  const currentAppearance = releaseId
    ? track.releaseAppearances.find(
        (appearance) => appearance.releaseId === releaseId,
      )
    : undefined
  const disc = textOrNull(currentAppearance?.disc ?? track.disc)
  const side = textOrNull(currentAppearance?.side ?? track.side)

  if (isExistingTrackForReleaseRequest(track)) {
    return {
      trackId: track.id,
      title: track.title,
      position,
      disc,
      side,
      durationSeconds: parseDuration(track.duration),
      versionYear: parseYear(track.versionYear ?? ''),
      inheritReleaseArtistCredits: Boolean(track.inheritReleaseArtistCredits),
      ...(track.releaseTrackArtistCredits &&
      track.releaseTrackArtistCredits.length > 0
        ? {
            artistCredits: track.releaseTrackArtistCredits.map((credit) =>
              toReleaseArtistCreditRequest({
                artistId: credit.artistId,
                artist: credit.artist,
                role: credit.role,
                roles: credit.roles,
              }),
            ),
          }
        : {}),
    }
  }

  return {
    title: track.title,
    position,
    disc,
    side,
    durationSeconds: parseDuration(track.duration),
    versionYear: parseYear(track.versionYear ?? ''),
    inheritReleaseArtistCredits: Boolean(track.inheritReleaseArtistCredits),
    artistCredits: track.credits.map((credit) =>
      toReleaseArtistCreditRequest({
        artistId: credit.artistId,
        artist: credit.artist,
        role: credit.role,
        roles: credit.roles,
      }),
    ),
  }
}

export function toReleaseTracklistSubmissionRequest(
  track: ReleaseTracklistSubmissionRow,
  index: number,
) {
  return {
    trackMode: track.trackMode,
    trackId: track.trackId,
    title: track.title,
    position: parseTrackPosition(track.position, index + 1),
    disc: textOrNull(track.disc),
    side: textOrNull(track.side),
    durationSeconds: parseDuration(track.duration),
    versionYear: parseYear(track.versionYear ?? ''),
    inheritReleaseArtistCredits: track.inheritReleaseArtistCredits,
    artistCredits: track.artistCredits.map(toReleaseArtistCreditRequest),
  }
}

function textOrNull(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ''

  return trimmed.length > 0 ? trimmed : null
}

export function toReleaseLabelRequest(label: ReleaseLabel) {
  return {
    labelId: label.labelId,
    name: label.labelId ? null : label.name,
    catalogNumber: label.catalogNumber ?? null,
    hasNoCatalogNumber: label.hasNoCatalogNumber,
  }
}

export function toOwnershipStatusCode(status: string) {
  switch (status) {
    case 'Wanted':
      return 'wanted'
    case 'Sold':
      return 'sold'
    case 'Needs digitization':
      return 'needsDigitization'
    default:
      return 'owned'
  }
}

export function toConditionCode(condition: string | null | undefined) {
  const normalized = condition?.trim().toLowerCase() ?? ''
  if (normalized.includes('mint') && normalized.includes('near')) {
    return 'nearMint'
  }
  if (normalized.includes('mint')) {
    return 'mint'
  }
  if (normalized.includes('plus')) {
    return 'veryGoodPlus'
  }
  if (normalized.includes('very')) {
    return 'veryGood'
  }
  if (normalized.includes('good')) {
    return 'good'
  }
  if (normalized.includes('fair')) {
    return 'fair'
  }
  if (normalized.includes('poor')) {
    return 'poor'
  }

  return null
}

export function toArtistRelationTypeCode(type: string) {
  return dictionaryCode('artistRelationType', type)
}

export function toTrackRelationTypeCode(type: string) {
  return dictionaryCode('trackRelationType', type)
}

export function parseYear(value: string) {
  const trimmed = value.trim()
  if (!/^\d{4}$/.test(trimmed)) {
    return null
  }

  return Number.parseInt(trimmed, 10)
}

export function parseDuration(value: string) {
  return parseDurationText(value)
}

export function toMediumRequest(value: string): MediumDto {
  const dictionaryEntry = mediaEntryByLabelOrCode(value)
  if (dictionaryEntry) {
    return mediumRequestForDictionaryEntry(dictionaryEntry, value)
  }

  const normalized = value.trim().toLowerCase()
  if (
    normalized.includes('digital') ||
    normalized.includes('flac') ||
    normalized.includes('mp3')
  ) {
    return { type: 'digital' }
  }

  if (
    normalized.includes('vinyl') ||
    normalized.includes('inch') ||
    normalized.includes('lp')
  ) {
    return { type: 'vinyl', description: value || 'Vinyl' }
  }

  if (normalized.includes('cd')) {
    return { type: 'cd', discCount: 1 }
  }

  if (normalized.includes('cassette')) {
    return { type: 'cassette', description: value || 'Cassette' }
  }

  return { type: 'other', description: value || 'Other' }
}

function mediumRequestForDictionaryEntry(
  entry: DictionaryEntry,
  value: string,
): MediumDto {
  const profile = entry.mediaProfile ?? 'other'
  switch (profile) {
    case 'digital':
      return { type: 'digital' }
    case 'cd':
      return { type: 'cd', discCount: 1 }
    case 'vinyl':
      return { type: 'vinyl', description: value || entry.name }
    case 'cassette':
      return { type: 'cassette', description: value || entry.name }
    default:
      return { type: 'other', description: value || entry.name }
  }
}

function isExistingTrackForReleaseRequest(track: TrackRecord) {
  return !isManualSessionRecord(track.id) && isUuid(track.id)
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  )
}

function parseTrackPosition(position: string, fallback?: number) {
  const trimmed = position.trim()
  if (
    fallback !== undefined &&
    (trimmed.length === 0 || trimmed === 'Unnumbered')
  ) {
    return fallback
  }

  if (!/^\d+$/.test(trimmed)) {
    throw new Error(
      'Track position must be a positive number before saving to the API.',
    )
  }

  const parsed = Number.parseInt(trimmed, 10)
  if (parsed < 1) {
    throw new Error(
      'Track position must be a positive number before saving to the API.',
    )
  }

  return parsed
}
