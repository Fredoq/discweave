import { uniqueValues } from '../catalog/catalogGraph'
import type {
  TrackDigitalFile,
  TrackRecord,
  TrackReleaseAppearance,
} from './tracksData'

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
  return track.digitalFiles.some(
    (file) => file.path.trim().length > 0 && file.format.trim().length > 0,
  )
}

export function primaryTrackDigitalFile(
  track: TrackRecord,
): TrackDigitalFile | undefined {
  return track.digitalFiles[0]
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
      ? track.digitalFiles.flatMap((file) => [
          file.format,
          file.path,
          file.quality,
          file.bitrate,
          file.sampleRate,
          file.channels,
          file.contentHash,
        ])
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

export type TrackDigitalFileSummary = {
  linkedFileRows: number
  uniqueLocalFiles: number
  reusedLocalFiles: number
  distinctPaths: number
  hasReusedLocalFiles: boolean
  hasDifferentPaths: boolean
}

export function trackDigitalFileSummary(
  track: TrackRecord,
): TrackDigitalFileSummary {
  const localAudioFileIds = uniqueValues(
    track.digitalFiles
      .map((file) => file.localAudioFileId.trim())
      .filter(Boolean),
  )
  const paths = uniqueValues(
    track.digitalFiles
      .map((file) => normalizeFilePath(file.path))
      .filter(Boolean),
  )
  const reusedLocalFiles = localAudioFileIds.filter(
    (localAudioFileId) =>
      track.digitalFiles.filter(
        (file) => file.localAudioFileId.trim() === localAudioFileId,
      ).length > 1,
  ).length

  return {
    linkedFileRows: track.digitalFiles.length,
    uniqueLocalFiles: localAudioFileIds.length,
    reusedLocalFiles,
    distinctPaths: paths.length,
    hasReusedLocalFiles: reusedLocalFiles > 0,
    hasDifferentPaths: paths.length > 1,
  }
}

export function trackDigitalFilePositionLabel(file: TrackDigitalFile) {
  const context = [
    file.disc?.trim(),
    file.side?.trim() ? `Side ${file.side.trim()}` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return [context, `Track ${file.position}`].filter(Boolean).join(' · ')
}

export function isReusedTrackDigitalFile(
  file: TrackDigitalFile,
  files: readonly TrackDigitalFile[],
) {
  const localAudioFileId = file.localAudioFileId.trim()

  return (
    localAudioFileId.length > 0 &&
    files.filter(
      (candidate) => candidate.localAudioFileId.trim() === localAudioFileId,
    ).length > 1
  )
}

export function isDifferentTrackDigitalFilePath(
  _file: TrackDigitalFile,
  files: readonly TrackDigitalFile[],
) {
  return (
    uniqueValues(
      files.map((file) => normalizeFilePath(file.path)).filter(Boolean),
    ).length > 1
  )
}

function normalizeFilePath(path: string) {
  return path.trim().toLowerCase()
}
