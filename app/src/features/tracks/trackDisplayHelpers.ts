import { uniqueValues } from '../catalog/catalogGraph'
import type { TrackRecord, TrackReleaseAppearance } from './tracksData'

export function trackReleaseAppearances(
  track: TrackRecord,
): TrackReleaseAppearance[] {
  if (track.releaseAppearances.length > 0) {
    return track.releaseAppearances
  }

  if (!track.release.id) {
    return []
  }

  return [
    {
      releaseId: track.release.id,
      releaseTitle: track.release.title,
      releaseArtist: track.release.artist,
      year: track.release.year,
      label: track.release.label,
      position: track.trackNumber,
      disc: track.disc,
      side: track.side,
      duration: track.duration,
    },
  ]
}

export function trackArtistDisplay(track: TrackRecord) {
  const mainArtists = uniqueValues(
    track.credits
      .filter((credit) =>
        (credit.roles && credit.roles.length > 0
          ? credit.roles
          : [credit.role]
        ).includes('Main artist'),
      )
      .map((credit) => credit.artist),
  )
  const creditArtists = uniqueValues(
    track.credits.map((credit) => credit.artist),
  )
  const releaseArtists = uniqueValues(
    trackReleaseAppearances(track).map(
      (appearance) => appearance.releaseArtist,
    ),
  )

  return (
    (mainArtists.length > 0
      ? mainArtists
      : creditArtists.length > 0
        ? creditArtists
        : releaseArtists
    ).join(', ') || 'Unknown artist'
  )
}

export function trackReleaseDisplay(track: TrackRecord) {
  const releases = uniqueValues(
    trackReleaseAppearances(track).map((appearance) => appearance.releaseTitle),
  )

  return releases.length > 0 ? releases.join(', ') : 'Unlinked release'
}

export function hasRealLocalFile(track: TrackRecord) {
  const metadata = track.fileMetadata

  return (
    metadata.format !== 'None recorded' &&
    metadata.path !== 'No file linked' &&
    metadata.format.trim().length > 0
  )
}

export function trackSearchText(track: TrackRecord) {
  return [
    track.title,
    trackArtistDisplay(track),
    ...trackReleaseAppearances(track).flatMap((appearance) => [
      appearance.releaseTitle,
      appearance.releaseArtist,
      appearance.year,
      appearance.label,
      appearance.position,
      appearance.disc,
      appearance.side,
      appearance.duration,
    ]),
    track.duration,
    track.relationHint,
    ...(hasRealLocalFile(track)
      ? [
          track.fileMetadata.format,
          track.fileMetadata.path,
          track.fileMetadata.bitrate,
          track.fileMetadata.sampleRate,
          track.fileMetadata.channels,
        ]
      : []),
    ...track.tags,
    ...track.credits.flatMap((credit) => [
      ...(credit.roles && credit.roles.length > 0
        ? credit.roles
        : [credit.role]),
      credit.artist,
      credit.scope,
    ]),
    ...track.relations.flatMap((relation) => [
      relation.type,
      relation.target,
      relation.detail,
    ]),
  ]
    .join(' ')
    .toLowerCase()
}

export function releaseHref(releaseId: string) {
  return `/releases?release=${encodeURIComponent(releaseId)}`
}
