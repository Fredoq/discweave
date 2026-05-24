import type {
  ReleaseCoverImage,
  ReleaseRecord,
} from '../../releases/releasesData'
import type { TrackRecord } from '../../tracks/tracksData'
import type { CatalogState } from './catalogTypes'

export function mergeReleaseTracklist(
  existingTracks: TrackRecord[],
  release: ReleaseRecord,
  tracks: TrackRecord[],
) {
  const desiredById = new Map(tracks.map((track) => [track.id, track]))
  const existingIds = new Set(existingTracks.map((track) => track.id))
  const updatedTracks = existingTracks.map((track) => {
    const desiredTrack = desiredById.get(track.id)

    return desiredTrack
      ? withReleaseAppearance(track, release, desiredTrack)
      : track
  })
  const createdTracks = tracks
    .filter((track) => !existingIds.has(track.id))
    .map((track) => withReleaseAppearance(track, release, track))

  return [...updatedTracks, ...createdTracks]
}

export function replaceReleaseTracklist(
  existingTracks: TrackRecord[],
  release: ReleaseRecord,
  tracks: TrackRecord[],
) {
  const desiredById = new Map(tracks.map((track) => [track.id, track]))
  const existingIds = new Set(existingTracks.map((track) => track.id))
  const updatedTracks = existingTracks.map((track) => {
    const desiredTrack = desiredById.get(track.id)
    if (desiredTrack) {
      return withReleaseAppearance(track, release, desiredTrack)
    }

    return removeReleaseAppearance(track, release.id)
  })
  const createdTracks = tracks
    .filter((track) => !existingIds.has(track.id))
    .map((track) => withReleaseAppearance(track, release, track))

  return [...updatedTracks, ...createdTracks]
}

export function updateReleaseMetadataOnTrack(
  track: TrackRecord,
  release: ReleaseRecord,
): TrackRecord {
  if (
    track.release.id !== release.id &&
    !track.releaseAppearances.some(
      (appearance) => appearance.releaseId === release.id,
    )
  ) {
    return track
  }

  return {
    ...track,
    release:
      track.release.id === release.id
        ? releaseSummaryForTrack(release, track)
        : track.release,
    releaseAppearances: track.releaseAppearances.map((appearance) =>
      appearance.releaseId === release.id
        ? {
            ...appearance,
            coverImage: release.coverImage,
            releaseTitle: release.title,
            releaseArtist: release.artist,
            year: release.year,
            label: release.label,
          }
        : appearance,
    ),
  }
}

export function applyReleaseCoverToState(
  state: CatalogState,
  releaseId: string,
  coverImage: ReleaseCoverImage | undefined,
): CatalogState {
  const releases = state.releases.map((release) =>
    release.id === releaseId ? { ...release, coverImage } : release,
  )
  const updatedRelease = releases.find((release) => release.id === releaseId)

  return {
    ...state,
    releases,
    tracks: updatedRelease
      ? state.tracks.map((track) =>
          updateReleaseMetadataOnTrack(track, updatedRelease),
        )
      : state.tracks,
  }
}

function withReleaseAppearance(
  track: TrackRecord,
  release: ReleaseRecord,
  sourceTrack: TrackRecord,
): TrackRecord {
  const appearance = releaseAppearanceForTrack(release, sourceTrack)
  const releaseAppearances = [
    ...track.releaseAppearances.filter(
      (candidate) => candidate.releaseId !== release.id,
    ),
    appearance,
  ]

  return {
    ...track,
    release:
      track.release.id && track.release.id !== release.id
        ? track.release
        : releaseSummaryForTrack(release, track),
    trackNumber:
      track.release.id === release.id ? appearance.position : track.trackNumber,
    duration:
      track.release.id === release.id ? appearance.duration : track.duration,
    versionHint:
      track.release.id === release.id
        ? appearance.versionNote
        : track.versionHint,
    releaseAppearances,
  }
}

function removeReleaseAppearance(
  track: TrackRecord,
  releaseId: string,
): TrackRecord {
  const releaseAppearances = track.releaseAppearances.filter(
    (appearance) => appearance.releaseId !== releaseId,
  )
  if (track.release.id !== releaseId) {
    return { ...track, releaseAppearances }
  }

  const primaryAppearance = releaseAppearances[0]

  return {
    ...track,
    release: primaryAppearance
      ? releaseSummaryFromAppearance(primaryAppearance)
      : {
          id: undefined,
          title: 'Unlinked release',
          artist: track.artist,
          year: 'Unknown year',
          label: 'Unknown label',
        },
    trackNumber: primaryAppearance?.position ?? 'Unnumbered',
    duration: primaryAppearance?.duration ?? track.duration,
    versionHint:
      primaryAppearance?.versionNote ?? 'No version relation recorded',
    releaseAppearances,
  }
}

function releaseAppearanceForTrack(
  release: ReleaseRecord,
  track: TrackRecord,
): TrackRecord['releaseAppearances'][number] {
  const existingAppearance = track.releaseAppearances.find(
    (appearance) => appearance.releaseId === release.id,
  )

  return {
    releaseId: release.id,
    coverImage: release.coverImage,
    releaseTitle: release.title,
    releaseArtist: release.artist,
    year: release.year,
    label: release.label,
    position: existingAppearance?.position ?? track.trackNumber,
    duration: existingAppearance?.duration ?? track.duration,
    versionNote:
      existingAppearance?.versionNote ??
      textOrDefault(track.versionHint, 'No version relation recorded'),
  }
}

function releaseSummaryForTrack(release: ReleaseRecord, track: TrackRecord) {
  return {
    ...track.release,
    id: release.id,
    title: release.title,
    artist: release.artist,
    year: release.year,
    label: release.label,
  }
}

function releaseSummaryFromAppearance(
  appearance: TrackRecord['releaseAppearances'][number],
) {
  return {
    id: appearance.releaseId,
    title: appearance.releaseTitle,
    artist: appearance.releaseArtist,
    year: appearance.year,
    label: appearance.label,
  }
}

function textOrDefault(value: string, fallback: string) {
  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : fallback
}
