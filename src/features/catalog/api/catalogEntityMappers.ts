import type { ArtistRecord } from '../../artists/artistsData'
import type { LabelRecord } from '../../labels/labelsData'
import type { OwnedItemRecord } from '../../ownedItems/ownedItemsData'
import type {
  OwnedCopy,
  ReleaseArtistCredit,
  ReleaseRecord,
} from '../../releases/releasesData'
import type { RelationRecord } from '../../relations/relationsData'
import type { TrackRecord } from '../../tracks/tracksData'
import {
  conditionLabel,
  creditRoleLabel,
  formatDuration,
  isDigitalFileMedium,
  isMainArtistRole,
  isManualDigitalPlaceholder,
  mediumLabel,
  ownedCopyStatusLabel,
  ownershipStatusLabel,
  releaseArtistDisplay,
  releaseLabelDisplay,
  releaseLabelDisplayFromDto,
  relationPeriodText,
  relationTypeLabel,
  statusToneFor,
  targetCredits,
  targetRatings,
  toArtistType,
  toReleaseType,
  toReleaseArtistCredit,
  toReleaseCoverImage,
  toReleaseLabel,
  toTrackCredit,
  toTrackCreditFromReleaseCredit,
  toTrackCreditFromTrackCreditDto,
} from './catalogValueMappers'
import type {
  ArtistDto,
  ArtistRelationDto,
  CatalogDictionaries,
  CreditDto,
  EntityRating,
  LabelDto,
  OwnedItemDto,
  ReleaseDto,
  ReleaseTrackContext,
  TrackDto,
  TrackRelationDto,
} from './catalogTypes'

export function toLabelRecord(label: LabelDto): LabelRecord {
  return {
    id: label.id,
    name: label.name,
  }
}

export function toArtistRecord(
  artist: ArtistDto,
  credits: CreditDto[],
  relations: ArtistRelationDto[],
  artistsById: Map<string, ArtistDto>,
  releasesById: Map<string, ReleaseDto>,
  tracksById: Map<string, TrackDto>,
  dictionaries: CatalogDictionaries,
  ratingsByTarget: Map<string, EntityRating[]>,
): ArtistRecord {
  const artistCredits = credits.filter(
    (credit) => credit.contributorArtistId === artist.id,
  )
  const artistRelations = relations.filter(
    (relation) =>
      relation.sourceArtistId === artist.id ||
      relation.targetArtistId === artist.id,
  )

  return {
    id: artist.id,
    name: artist.name,
    type: toArtistType(artist.type),
    aliases: [],
    members: artistRelations
      .filter(
        (relation) =>
          relation.type === 'memberOf' && relation.targetArtistId === artist.id,
      )
      .map(
        (relation) =>
          artistsById.get(relation.sourceArtistId)?.name ?? 'Unknown artist',
      ),
    relationHint:
      artistRelations
        .map((relation) =>
          relationTypeLabel(relation.type, 'artistRelationType', dictionaries),
        )
        .join(', ') || 'No relations recorded',
    creditHint:
      artistCredits
        .map((credit) => creditRoleLabel(credit.role, dictionaries))
        .join(', ') || 'No credits recorded',
    relations: artistRelations.map((relation) => {
      const isSource = relation.sourceArtistId === artist.id
      const target = artistsById.get(
        isSource ? relation.targetArtistId : relation.sourceArtistId,
      )

      return {
        type: relationTypeLabel(
          relation.type,
          'artistRelationType',
          dictionaries,
        ),
        target: target?.name ?? 'Unknown artist',
        detail: relationPeriodText(relation),
      }
    }),
    credits: artistCredits.map((credit) => ({
      role: creditRoleLabel(credit.role, dictionaries),
      target:
        credit.targetType === 'release'
          ? (releasesById.get(credit.targetId)?.title ?? 'Unknown release')
          : (tracksById.get(credit.targetId)?.title ?? 'Unknown track'),
      scope: credit.targetType === 'release' ? 'Release' : 'Track',
    })),
    tags: [],
    summary: '',
    ratings: targetRatings(ratingsByTarget, 'artist', artist.id),
  }
}

export function toReleaseRecord(
  release: ReleaseDto,
  labelsById: Map<string, LabelDto>,
  creditsByTarget: Map<string, CreditDto[]>,
  artistsById: Map<string, ArtistDto>,
  ownedItems: OwnedItemDto[],
  dictionaries: CatalogDictionaries,
  ratingsByTarget: Map<string, EntityRating[]>,
): ReleaseRecord {
  const credits = targetCredits(creditsByTarget, 'release', release.id)
  const responseCredits = release.artistCredits ?? []
  const releaseCredits: ReleaseArtistCredit[] =
    responseCredits.length > 0
      ? responseCredits.map((credit) =>
          toReleaseArtistCredit(credit, dictionaries),
        )
      : credits.map((credit) => ({
          artistId: credit.contributorArtistId,
          artist:
            artistsById.get(credit.contributorArtistId)?.name ??
            credit.contributorName,
          role: creditRoleLabel(credit.role, dictionaries),
        }))
  const mainCredits = releaseCredits.filter((credit) =>
    isMainArtistRole(credit.role, dictionaries),
  )
  const artistDisplay = release.isVariousArtists
    ? 'Various Artists'
    : (mainCredits.length > 0 ? mainCredits : releaseCredits)
        .map((credit) => credit.artist)
        .join(', ') || 'Unknown artist'
  const releaseLabels = (release.labels ?? []).map(toReleaseLabel)
  const labelDisplay = release.notOnLabel
    ? 'Not On Label'
    : releaseLabels.length > 0
      ? releaseLabels.map(releaseLabelDisplay).join(', ')
      : release.labelId
        ? (labelsById.get(release.labelId)?.name ?? 'Unknown label')
        : 'Unknown label'
  const mainCredit = mainCredits[0] ?? releaseCredits[0]

  return {
    id: release.id,
    title: release.title,
    artistId: mainCredit?.artistId,
    artist: artistDisplay,
    artistCredits: releaseCredits,
    type: toReleaseType(release.type, dictionaries),
    year: release.year?.toString() ?? 'Unknown year',
    releaseDate: release.releaseDate ?? undefined,
    label: labelDisplay,
    labels: releaseLabels,
    isVariousArtists: Boolean(release.isVariousArtists),
    notOnLabel: Boolean(release.notOnLabel),
    genres: release.genres,
    tags: release.tags,
    releaseNotes: '',
    coverImage: release.coverImage
      ? toReleaseCoverImage(release.coverImage)
      : undefined,
    ownedCopies: [
      ...ownedItems
        .filter(
          (item) =>
            item.targetType === 'release' && item.targetId === release.id,
        )
        .map((item) => ({
          id: item.id,
          medium: mediumLabel(item.medium, dictionaries),
          status: ownedCopyStatusLabel(item.status),
          storage: item.storageLocation ?? 'No storage recorded',
          condition: conditionLabel(item.condition),
          note: '',
        })),
      ...releaseTrackDigitalCopies(release, ownedItems),
    ],
    ratings: targetRatings(ratingsByTarget, 'release', release.id),
  }
}

function releaseTrackDigitalCopies(
  release: ReleaseDto,
  ownedItems: OwnedItemDto[],
): OwnedCopy[] {
  const trackIds = new Set(
    (release.tracklist ?? []).map((track) => track.trackId),
  )
  const digitalItems = ownedItems.filter(
    (item) =>
      item.targetType === 'track' &&
      trackIds.has(item.targetId) &&
      isDigitalFileMedium(item.medium),
  )

  if (digitalItems.length === 0) {
    return []
  }

  const formats = [
    ...new Set(
      digitalItems
        .map((item) => item.medium.format?.toUpperCase())
        .filter((format): format is string => Boolean(format)),
    ),
  ]

  return [
    {
      id: `${release.id}:track-digital-files`,
      medium: 'Digital',
      status: 'Owned',
      storage: `${digitalItems.length} track file${digitalItems.length === 1 ? '' : 's'}`,
      condition: formats.length > 0 ? formats.join(', ') : 'Files recorded',
      note: 'Track-level digital ownership',
    },
  ]
}

export function toTrackRecord(
  track: TrackDto,
  creditsByTarget: Map<string, CreditDto[]>,
  releasesById: Map<string, ReleaseDto>,
  releaseTrackByTrackId: Map<string, ReleaseTrackContext[]>,
  ownedItems: OwnedItemDto[],
  dictionaries: CatalogDictionaries,
  ratingsByTarget: Map<string, EntityRating[]>,
): TrackRecord {
  const credits = targetCredits(creditsByTarget, 'track', track.id)
  const releaseTracks = releaseTrackByTrackId.get(track.id) ?? []
  const primaryReleaseTrack = releaseTracks[0]
  const releaseAppearances =
    track.releaseAppearances?.map((appearance) => {
      const appearanceRelease = releasesById.get(appearance.releaseId)

      return {
        releaseId: appearance.releaseId,
        coverImage: appearanceRelease?.coverImage
          ? toReleaseCoverImage(appearanceRelease.coverImage)
          : undefined,
        releaseTitle: appearance.releaseTitle,
        releaseArtist: appearance.releaseArtist,
        year: appearance.year?.toString() ?? 'Unknown year',
        label: appearance.label ?? 'Unknown label',
        position: appearance.position.toString(),
        duration: formatDuration(
          appearance.durationSeconds ?? track.durationSeconds,
        ),
        versionNote: appearance.versionNote ?? 'No version relation recorded',
      }
    }) ??
    releaseTracks.map(({ release: releaseContext, track: releaseTrack }) => {
      const appearanceRelease = releasesById.get(releaseContext.id)

      return {
        releaseId: appearanceRelease?.id,
        coverImage: appearanceRelease?.coverImage
          ? toReleaseCoverImage(appearanceRelease.coverImage)
          : undefined,
        releaseTitle: appearanceRelease?.title ?? releaseContext.title,
        releaseArtist: appearanceRelease
          ? releaseArtistDisplay(appearanceRelease)
          : 'Unknown artist',
        year: appearanceRelease?.year?.toString() ?? 'Unknown year',
        label: appearanceRelease
          ? releaseLabelDisplayFromDto(appearanceRelease)
          : 'Unknown label',
        position: releaseTrack.position.toString(),
        duration: formatDuration(
          releaseTrack.durationSeconds ?? track.durationSeconds,
        ),
        versionNote: releaseTrack.versionNote ?? 'No version relation recorded',
      }
    })
  const primaryAppearance = primaryReleaseTrack
    ? undefined
    : releaseAppearances[0]
  const trackCredits = track.credits
    ? track.credits.map((credit) =>
        toTrackCreditFromTrackCreditDto(credit, dictionaries),
      )
    : primaryReleaseTrack?.track.artistCredits &&
        primaryReleaseTrack.track.artistCredits.length > 0
      ? primaryReleaseTrack.track.artistCredits.map((credit) =>
          toTrackCreditFromReleaseCredit(credit, dictionaries),
        )
      : credits.map((credit) => toTrackCredit(credit, dictionaries))
  const mainCredit =
    trackCredits.find((credit) =>
      isMainArtistRole(credit.role, dictionaries),
    ) ?? trackCredits[0]
  const release = primaryReleaseTrack?.release
    ? releasesById.get(primaryReleaseTrack.release.id)
    : primaryAppearance?.releaseId
      ? releasesById.get(primaryAppearance.releaseId)
      : undefined
  const releaseTitle =
    release?.title ?? primaryAppearance?.releaseTitle ?? 'Unlinked release'
  const releaseArtist = release
    ? releaseArtistDisplay(release)
    : primaryAppearance?.releaseArtist
  const releaseYear =
    release?.year?.toString() ?? primaryAppearance?.year ?? 'Unknown year'
  const releaseLabel = release
    ? releaseLabelDisplayFromDto(release)
    : (primaryAppearance?.label ?? 'Unknown label')
  const trackNumber =
    primaryReleaseTrack?.track.position.toString() ??
    primaryAppearance?.position ??
    'Unnumbered'
  const trackDuration =
    primaryReleaseTrack?.track.durationSeconds !== undefined
      ? formatDuration(primaryReleaseTrack.track.durationSeconds)
      : (primaryAppearance?.duration ?? formatDuration(track.durationSeconds))
  const versionHint =
    primaryReleaseTrack?.track.versionNote ??
    primaryAppearance?.versionNote ??
    'No version relation recorded'
  const trackArtist = mainCredit?.artist ?? releaseArtist ?? 'Unknown artist'
  const digitalFileItem = ownedItems.find(
    (item) =>
      item.targetType === 'track' &&
      item.targetId === track.id &&
      isDigitalFileMedium(item.medium),
  )

  return {
    id: track.id,
    title: track.title,
    artistId: mainCredit?.artistId,
    artist: trackArtist,
    release: {
      id: release?.id,
      title: releaseTitle,
      artist: releaseArtist ?? trackArtist,
      year: releaseYear,
      label: releaseLabel,
    },
    trackNumber,
    duration: trackDuration,
    versionHint,
    relationHint: '',
    tags: [...track.genres, ...track.tags],
    credits: trackCredits,
    releaseAppearances,
    relations: [],
    fileMetadata: {
      format: digitalFileItem?.medium.format?.toUpperCase() ?? 'None recorded',
      path: digitalFileItem?.medium.path ?? 'No file linked',
      bitrate: 'Not recorded',
      sampleRate: 'Not recorded',
      channels: 'Not recorded',
      importedAt: digitalFileItem ? 'Imported file' : 'Not recorded',
      checksum: 'Not recorded',
    },
    ratings: targetRatings(ratingsByTarget, 'track', track.id),
  }
}

export function toOwnedItemRecord(
  item: OwnedItemDto,
  releasesById: Map<string, ReleaseDto>,
  tracksById: Map<string, TrackDto>,
  releases: ReleaseRecord[],
  tracks: TrackRecord[],
  dictionaries: CatalogDictionaries,
): OwnedItemRecord {
  const release =
    item.targetType === 'release' ? releasesById.get(item.targetId) : undefined
  const track =
    item.targetType === 'track' ? tracksById.get(item.targetId) : undefined
  const releaseRecord = release
    ? releases.find((record) => record.id === release.id)
    : undefined
  const trackRecord = track
    ? tracks.find((record) => record.id === track.id)
    : undefined
  const status = ownershipStatusLabel(item.status)

  return {
    id: item.id,
    title: release?.title ?? track?.title ?? 'Owned item',
    releaseId: release?.id,
    releaseTitle:
      release?.title ?? trackRecord?.release.title ?? 'Unlinked release',
    artist: releaseRecord?.artist ?? trackRecord?.artist ?? 'Unknown artist',
    medium: mediumLabel(item.medium, dictionaries),
    status,
    statusTone: statusToneFor(status),
    storage: item.storageLocation ?? 'No storage recorded',
    condition: conditionLabel(item.condition),
    acquisition: 'Not recorded',
    copyNotes: '',
    linkedType: item.targetType === 'track' ? 'Track' : 'Release',
    fileFormat:
      item.medium.format && !isManualDigitalPlaceholder(item.medium)
        ? item.medium.format.toUpperCase()
        : 'None recorded',
    digitalState:
      item.medium.type === 'digital'
        ? isManualDigitalPlaceholder(item.medium)
          ? 'Digital copy recorded'
          : 'Digital file recorded'
        : 'No digital file recorded',
    digitizationState:
      status === 'Needs digitization'
        ? 'Needs digitization'
        : 'No digitization state recorded',
    tags: [],
  }
}

export function toArtistRelationRecord(
  relation: ArtistRelationDto,
  artistsById: Map<string, ArtistDto>,
  dictionaries: CatalogDictionaries,
): RelationRecord {
  const source = artistsById.get(relation.sourceArtistId)
  const target = artistsById.get(relation.targetArtistId)
  const type = relationTypeLabel(
    relation.type,
    'artistRelationType',
    dictionaries,
  )

  return {
    id: relation.id,
    source: source?.name ?? 'Unknown artist',
    sourceLink: { kind: 'artist', id: relation.sourceArtistId },
    sourceType: source ? toArtistType(source.type) : 'Artist',
    target: target?.name ?? 'Unknown artist',
    targetLink: { kind: 'artist', id: relation.targetArtistId },
    targetType: target ? toArtistType(target.type) : 'Artist',
    relationType: type,
    role: type,
    context: relationPeriodText(relation),
    evidence: relationPeriodText(relation),
    linkedEntity: target?.name ?? 'Unknown artist',
    linkedEntityLink: { kind: 'artist', id: relation.targetArtistId },
    linkedEntityType: 'Artist',
    direction: 'Artist relation',
    searchHints: [source?.name ?? '', target?.name ?? '', type],
  }
}

export function toTrackRelationRecord(
  relation: TrackRelationDto,
  tracksById: Map<string, TrackDto>,
  dictionaries: CatalogDictionaries,
): RelationRecord {
  const source = tracksById.get(relation.sourceTrackId)
  const target = tracksById.get(relation.targetTrackId)
  const type = relationTypeLabel(
    relation.type,
    'trackRelationType',
    dictionaries,
  )

  return {
    id: relation.id,
    source: source?.title ?? 'Unknown track',
    sourceLink: { kind: 'track', id: relation.sourceTrackId },
    sourceType: 'Track',
    target: target?.title ?? 'Unknown track',
    targetLink: { kind: 'track', id: relation.targetTrackId },
    targetType: 'Track',
    relationType: type,
    role: type,
    context: '',
    evidence: '',
    linkedEntity: target?.title ?? 'Unknown track',
    linkedEntityLink: { kind: 'track', id: relation.targetTrackId },
    linkedEntityType: 'Track',
    direction: 'Track relation',
    searchHints: [source?.title ?? '', target?.title ?? '', type],
  }
}
