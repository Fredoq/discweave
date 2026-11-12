import type {
  ArtistDto,
  ArtistRelationDto,
  TrackRelationDto,
  CreditDto,
  ReleaseDto,
  TrackDto,
} from './catalogTypes'

export function creditTargetTitle(
  credit: CreditDto,
  releasesById: Map<string, ReleaseDto>,
  tracksById: Map<string, TrackDto>,
) {
  if (credit.targetTitle) {
    return credit.targetTitle
  }
  if (credit.targetType === 'release') {
    return releasesById.get(credit.targetId)?.title ?? 'Unknown release'
  }
  return tracksById.get(credit.targetId)?.title ?? 'Unknown track'
}

export function artistRelationSourceName(
  relation: ArtistRelationDto,
  artistsById: Map<string, ArtistDto>,
) {
  return (
    relation.sourceArtistName ??
    artistsById.get(relation.sourceArtistId)?.name ??
    'Unknown artist'
  )
}

export function artistRelationTargetName(
  relation: ArtistRelationDto,
  artistsById: Map<string, ArtistDto>,
) {
  return (
    relation.targetArtistName ??
    artistsById.get(relation.targetArtistId)?.name ??
    'Unknown artist'
  )
}

export function trackRelationSourceTitle(
  relation: TrackRelationDto,
  tracksById: Map<string, TrackDto>,
) {
  return (
    relation.sourceTrackTitle ??
    tracksById.get(relation.sourceTrackId)?.title ??
    'Unknown track'
  )
}

export function trackRelationTargetTitle(
  relation: TrackRelationDto,
  tracksById: Map<string, TrackDto>,
) {
  return (
    relation.targetTrackTitle ??
    tracksById.get(relation.targetTrackId)?.title ??
    'Unknown track'
  )
}
