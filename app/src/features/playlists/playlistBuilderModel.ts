import type { ReleaseRecord } from '../releases/releasesData'
import type { TrackRecord } from '../tracks/tracksData'
import type { PlaylistEntryRef, PlaylistRecord } from './playlistsData'

export type PlaylistBuilderRow = {
  key: string
  trackId?: string
  title: string
  artist: string
  releaseTitle: string
  duration: string
  problem?: string
}

export type PlaylistTrackProjection = {
  rows: PlaylistBuilderRow[]
  problems: string[]
  canCopy: boolean
  legacy: boolean
}

/** Projects each occurrence independently; reading a playlist never migrates it. */
export function projectPlaylistTracks(
  playlist: PlaylistRecord,
  releases: readonly ReleaseRecord[],
  tracks: readonly TrackRecord[],
): PlaylistTrackProjection {
  const rows: PlaylistBuilderRow[] = []
  const problems: string[] = []
  const trackById = new Map(tracks.map((track) => [track.id, track]))
  const releaseById = new Map(releases.map((release) => [release.id, release]))
  // Smart entries describe no result order; its evaluated result is read-only.
  const entries: PlaylistEntryRef[] =
    playlist.type === 'Manual' && playlist.serverEntries !== undefined
      ? playlist.serverEntries
      : [
          ...playlist.tracks.map((track) => ({
            kind: 'track' as const,
            id: track.id,
            title: track.title,
            subtitle: track.artist,
          })),
          ...playlist.linkedReleases.map((release) => ({
            kind: 'release' as const,
            id: release.releaseId,
            title: release.title,
          })),
        ]
  const legacy = entries.some((entry) => entry.kind === 'release')
  if (
    playlist.type === 'Manual' &&
    playlist.serverEntries === undefined &&
    legacy
  ) {
    problems.push(
      'The original entry order is unavailable. Reload this playlist before creating a copy.',
    )
  }

  entries.forEach((entry, index) => {
    if (entry.kind === 'track') {
      const track = trackById.get(entry.id)
      const problem = track
        ? undefined
        : `Track “${entry.title || entry.id}” is unavailable.`
      if (problem) problems.push(problem)
      rows.push({
        key: `entry-${index}`,
        trackId: entry.id,
        title: track?.title ?? entry.title ?? 'Unavailable track',
        artist: track?.artist ?? entry.subtitle ?? 'Unknown artist',
        releaseTitle: track?.release.title ?? '',
        duration: track?.duration ?? '',
        problem,
      })
      return
    }

    const release = releaseById.get(entry.id)
    const title = release?.title ?? entry.title ?? 'Unavailable release'
    if (!release?.tracklist?.length) {
      const problem = `The complete tracklist for “${title}” is unavailable. The original release link is preserved.`
      problems.push(problem)
      rows.push({
        key: `entry-${index}-unresolved-release`,
        title: `Unresolved tracklist: ${title}`,
        artist: release?.artist ?? entry.subtitle ?? 'Unknown artist',
        releaseTitle: title,
        duration: '',
        problem,
      })
      return
    }
    release.tracklist.forEach((item, position) => {
      const track = item.trackId ? trackById.get(item.trackId) : undefined
      let problem: string | undefined
      if (item.isReleaseOnly || !item.trackId) {
        problem = `“${item.title}” in “${title}” has no standalone track record.`
      } else if (!track) {
        problem = `Track “${item.title}” in “${title}” is unavailable.`
      }
      if (problem) problems.push(problem)
      rows.push({
        key: `entry-${index}-row-${position}`,
        trackId: item.isReleaseOnly ? undefined : item.trackId,
        title: item.title || track?.title || 'Untitled track',
        artist:
          item.artistCredits.map((credit) => credit.artist).join(', ') ||
          track?.artist ||
          release.artist,
        releaseTitle: title,
        duration: item.duration ?? track?.duration ?? '',
        problem,
      })
    })
  })
  return {
    rows,
    problems,
    legacy,
    canCopy: playlist.type === 'Manual' && problems.length === 0,
  }
}

/** Creates a separate unsaved manual record, never rewrites its source. */
export function createTrackOnlyPlaylistCopy(
  playlist: PlaylistRecord,
  projection: PlaylistTrackProjection,
  id: string,
): PlaylistRecord | undefined {
  if (
    !projection.canCopy ||
    playlist.type !== 'Manual' ||
    id === playlist.id ||
    !id ||
    projection.rows.some((row) => !row.trackId || row.problem)
  )
    return undefined
  return {
    id,
    name: `${playlist.name} (track copy)`,
    description: playlist.description,
    type: 'Manual',
    curator: 'Default collection',
    updatedAt: 'Manual entry',
    yearRange: playlist.yearRange,
    ruleHints: [],
    linkedReleases: [],
    serverEntries: projection.rows.map((row) => ({
      kind: 'track',
      id: row.trackId!,
      title: row.title,
      subtitle: row.artist,
    })),
    tracks: projection.rows.map((row) => ({
      id: row.trackId!,
      title: row.title,
      artist: row.artist,
      release: {
        id: '',
        title: row.releaseTitle,
        artist: row.artist,
        year: '',
        label: '',
      },
      trackNumber: '',
      duration: row.duration,
      tags: [],
      fileFormat: '',
      media: [],
      ownershipStatus: [],
      availability: '',
    })),
    manualSelection: { source: 'Manual track selection', note: '' },
  }
}

export function playlistTrackFromRecord(
  track: TrackRecord,
): import('./playlistsData').PlaylistTrack {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    release: { ...track.release, id: track.release.id ?? '' },
    trackNumber: track.trackNumber,
    duration: track.duration,
    tags: [...track.tags],
    fileFormat: '',
    media: [],
    ownershipStatus: [],
    availability: '',
  }
}
