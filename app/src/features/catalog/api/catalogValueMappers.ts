import type { ArtistType } from '../../artists/artistsData'
import type {
  OwnedItemRecord,
  OwnedItemStatus,
} from '../../ownedItems/ownedItemsData'
import type {
  ReleaseArtistCredit,
  ReleaseCoverImage,
  ReleaseLabel,
  ReleaseRecord,
  ReleaseType,
} from '../../releases/releasesData'
import type { TrackCredit } from '../../tracks/tracksData'
import { toCreditRole } from '../creditRoles'
import { formatDurationSeconds } from '../durationFormat'
import {
  activeDictionaries,
  dictionaryCode,
  dictionaryLabel,
  mainArtistRoleCode,
} from './catalogDefaults'
import type {
  ArtistRelationDto,
  CreditDto,
  EntityRating,
  MediumDto,
  RatingTargetType,
  ReleaseArtistCreditDto,
  ReleaseCoverImageDto,
  ReleaseDto,
  ReleaseLabelDto,
  TrackCreditDto,
} from './catalogTypes'

export function groupCreditsByTarget(credits: CreditDto[]) {
  const result = new Map<string, CreditDto[]>()

  for (const credit of credits) {
    const key = `${credit.targetType}:${credit.targetId}`
    result.set(key, [...(result.get(key) ?? []), credit])
  }

  return result
}

export function targetCredits(
  creditsByTarget: Map<string, CreditDto[]>,
  targetType: string,
  targetId: string,
) {
  return creditsByTarget.get(`${targetType}:${targetId}`) ?? []
}

export function groupRatingsByTarget(ratings: EntityRating[]) {
  const result = new Map<string, EntityRating[]>()

  for (const rating of ratings) {
    const key = `${rating.targetType}:${rating.targetId}`
    result.set(key, [...(result.get(key) ?? []), rating])
  }

  return result
}

export function targetRatings(
  ratings: EntityRating[] | Map<string, EntityRating[]>,
  targetType: RatingTargetType,
  targetId: string,
) {
  if (ratings instanceof Map) {
    return ratings.get(`${targetType}:${targetId}`) ?? []
  }

  return ratings.filter(
    (rating) =>
      rating.targetType === targetType && rating.targetId === targetId,
  )
}

export function toReleaseCoverImage(
  coverImage: ReleaseCoverImageDto,
): ReleaseCoverImage {
  return {
    url: coverImage.url,
    contentType: coverImage.contentType,
    originalFileName: coverImage.originalFileName,
    sizeBytes: coverImage.sizeBytes,
    sourceType: coverImage.sourceType,
  }
}

export function toReleaseCoverImageFromFile(
  releaseId: string,
  file: File,
): ReleaseCoverImage {
  return {
    url: `/api/releases/${releaseId}/cover-image`,
    contentType: file.type,
    originalFileName: file.name,
    sizeBytes: file.size,
    sourceType: 'localUpload',
  }
}

export function toTrackCredit(
  credit: CreditDto,
  dictionaries = activeDictionaries,
): TrackCredit {
  const roles = creditRolesFromDto(credit, dictionaries)

  return {
    artistId: credit.contributorArtistId,
    role: roles[0] ?? creditRoleLabel(credit.role, dictionaries),
    roles,
    artist: credit.contributorName,
    scope: 'Track credit.',
  }
}

export function toTrackCreditFromTrackCreditDto(
  credit: TrackCreditDto,
  dictionaries = activeDictionaries,
): TrackCredit {
  const roles = creditRolesFromDto(credit, dictionaries)

  return {
    artistId: credit.artistId,
    role: roles[0] ?? creditRoleLabel(credit.role, dictionaries),
    roles,
    artist: credit.artistName,
    scope: 'Track credit.',
  }
}

export function toTrackCreditFromReleaseCredit(
  credit: ReleaseArtistCreditDto,
  dictionaries = activeDictionaries,
): TrackCredit {
  const roles = creditRolesFromDto(credit, dictionaries)

  return {
    artistId: credit.artistId,
    role: roles[0] ?? creditRoleLabel(primaryCreditRole(credit), dictionaries),
    roles,
    artist: credit.artistName,
    scope: 'Tracklist credit.',
  }
}

export function toReleaseArtistCredit(
  credit: ReleaseArtistCreditDto,
  dictionaries = activeDictionaries,
): ReleaseArtistCredit {
  const roles = creditRolesFromDto(credit, dictionaries)

  return {
    artistId: credit.artistId,
    artist: credit.artistName,
    role: roles[0] ?? creditRoleLabel(primaryCreditRole(credit), dictionaries),
    roles,
  }
}

export function creditRolesFromDto(
  credit: { primaryRole?: string; role?: string; roles?: string[] },
  dictionaries = activeDictionaries,
) {
  const roleCodes =
    credit.roles && credit.roles.length > 0
      ? credit.roles
      : [primaryCreditRole(credit)]
  return [
    ...new Set(roleCodes.map((role) => creditRoleLabel(role, dictionaries))),
  ]
}

function primaryCreditRole(credit: { primaryRole?: string; role?: string }) {
  return credit.primaryRole ?? credit.role ?? ''
}

export function toReleaseLabel(label: ReleaseLabelDto): ReleaseLabel {
  return {
    labelId: label.labelId ?? undefined,
    name: label.name,
    catalogNumber: label.catalogNumber ?? undefined,
    hasNoCatalogNumber: label.hasNoCatalogNumber,
  }
}

export function releaseArtistDisplay(release: ReleaseDto) {
  if (release.isVariousArtists) {
    return 'Various Artists'
  }

  const credits = release.artistCredits ?? []
  const mainCredits = credits.filter((credit) =>
    (credit.roles && credit.roles.length > 0
      ? credit.roles
      : [primaryCreditRole(credit)]
    ).includes(mainArtistRoleCode),
  )
  const visibleCredits = mainCredits.length > 0 ? mainCredits : credits

  return (
    visibleCredits.map((credit) => credit.artistName).join(', ') ||
    'Unknown artist'
  )
}

export function releaseLabelDisplayFromDto(release: ReleaseDto) {
  if (release.notOnLabel) {
    return 'Not On Label'
  }

  return (
    release.labels
      ?.map((label) => releaseLabelDisplay(toReleaseLabel(label)))
      .join(', ') || 'Unknown label'
  )
}

export function releaseLabelDisplay(label: ReleaseLabel) {
  if (label.catalogNumber) {
    return `${label.name} ${label.catalogNumber}`
  }

  if (label.hasNoCatalogNumber) {
    return `${label.name} (No catalog number)`
  }

  return label.name
}

export function releaseArtistCreditsFromDisplay(
  release: ReleaseRecord,
): ReleaseArtistCredit[] {
  const artist = release.artist.trim()
  if (!artist || artist === 'Unknown artist') {
    return []
  }

  return [
    {
      artistId: release.artistId,
      artist,
      role: mainArtistRoleLabel(),
      roles: [mainArtistRoleLabel()],
    },
  ]
}

export function releaseLabelsFromDisplay(
  release: ReleaseRecord,
): ReleaseLabel[] {
  const label = release.label.trim()
  if (!label || label === 'Unknown label' || label === 'Not On Label') {
    return []
  }

  return [{ name: label, hasNoCatalogNumber: false }]
}

export function toArtistType(type: string): ArtistType {
  return type === 'group' ? 'Band' : 'Person'
}

export function toReleaseType(
  type: string,
  dictionaries = activeDictionaries,
): ReleaseType {
  return dictionaryLabel(dictionaries, 'releaseType', type)
}

export function ownershipStatusLabel(status: string): OwnedItemStatus {
  switch (status) {
    case 'owned':
      return 'Owned'
    case 'wanted':
      return 'Wanted'
    case 'sold':
      return 'Sold'
    case 'needsDigitization':
      return 'Needs digitization'
    default:
      return 'Not recorded'
  }
}

export function ownedCopyStatusLabel(status: string) {
  const label = ownershipStatusLabel(status)

  return label === 'Not recorded' ? 'Owned' : label
}

export function statusToneFor(
  status: OwnedItemStatus,
): OwnedItemRecord['statusTone'] {
  switch (status) {
    case 'Owned':
      return 'green'
    case 'Wanted':
      return 'blue'
    case 'Needs digitization':
      return 'amber'
    default:
      return 'gray'
  }
}

export function mediumLabel(
  medium: MediumDto,
  dictionaries = activeDictionaries,
) {
  switch (medium.type) {
    case 'digital':
      return medium.format && !isManualDigitalPlaceholder(medium)
        ? medium.format.toUpperCase()
        : dictionaryLabel(dictionaries, 'mediaType', medium.type)
    case 'cd':
      return medium.discCount && medium.discCount > 1
        ? `${medium.discCount}xCD`
        : dictionaryLabel(dictionaries, 'mediaType', medium.type)
    default:
      return (
        medium.description ??
        dictionaryLabel(dictionaries, 'mediaType', medium.type)
      )
  }
}

export function isManualDigitalPlaceholder(medium: MediumDto) {
  return (
    medium.type === 'digital' &&
    medium.path === '/discweave/manual-entry-placeholder'
  )
}

export function isDigitalFileMedium(medium: MediumDto) {
  return (
    medium.type === 'digital' &&
    Boolean(medium.path) &&
    !isManualDigitalPlaceholder(medium)
  )
}

export function conditionLabel(condition: string | null | undefined) {
  switch (condition) {
    case 'mint':
      return 'Mint'
    case 'nearMint':
      return 'Near Mint'
    case 'veryGoodPlus':
      return 'Very Good Plus'
    case 'veryGood':
      return 'Very Good'
    case 'good':
      return 'Good'
    case 'fair':
      return 'Fair'
    case 'poor':
      return 'Poor'
    default:
      return 'No condition recorded'
  }
}

export function creditRoleLabel(
  role: string,
  dictionaries = activeDictionaries,
) {
  return toCreditRole(dictionaryLabel(dictionaries, 'creditRole', role))
}

export function mainArtistRoleLabel(dictionaries = activeDictionaries) {
  return creditRoleLabel(mainArtistRoleCode, dictionaries)
}

export function isMainArtistRole(
  role: string,
  dictionaries = activeDictionaries,
) {
  return toCreditRoleCode(role, dictionaries) === mainArtistRoleCode
}

export function toCreditRoleCode(
  role: string,
  dictionaries = activeDictionaries,
) {
  return dictionaryCode('creditRole', role, dictionaries)
}

export function relationTypeLabel(
  type: string,
  kind: 'artistRelationType' | 'trackRelationType' = 'artistRelationType',
  dictionaries = activeDictionaries,
) {
  return dictionaryLabel(dictionaries, kind, type)
}

export function relationPeriodText(relation: ArtistRelationDto) {
  if (relation.startYear && relation.endYear) {
    return `Recorded from ${relation.startYear} to ${relation.endYear}.`
  }

  if (relation.startYear) {
    return `Recorded from ${relation.startYear}.`
  }

  if (relation.endYear) {
    return `Recorded until ${relation.endYear}.`
  }

  return ''
}

export function formatDuration(durationSeconds: number | null | undefined) {
  return formatDurationSeconds(durationSeconds)
}
