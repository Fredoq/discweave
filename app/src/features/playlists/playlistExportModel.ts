import type { TrackDigitalFile, TrackRecord } from '../tracks/tracksData'
import type { PlaylistRecord } from './playlistsData'

export type PlaylistExportRow = {
  key: string
  trackId: string
  title: string
  artist: string
  duration: string
  files: TrackDigitalFile[]
}

/** Resolve a saved selection without dropping unavailable track occurrences. */
export function createPlaylistExportRows(
  playlist: PlaylistRecord,
  tracks: readonly TrackRecord[],
): PlaylistExportRow[] {
  if (playlist.type !== 'Manual') {
    throw new Error(
      'M3U8 export is currently available for manual playlists only.',
    )
  }
  if (
    playlist.serverEntries?.some((entry) => entry.kind === 'release') ||
    (playlist.serverEntries === undefined && playlist.linkedReleases.length > 0)
  ) {
    throw new Error(
      'Create a complete track-only copy of this legacy playlist before exporting it.',
    )
  }

  const entries =
    playlist.serverEntries ??
    playlist.tracks.map((track) => ({
      kind: 'track' as const,
      id: track.id,
      title: track.title,
      subtitle: track.artist,
    }))
  const byId = new Map(tracks.map((track) => [track.id, track]))
  return entries.map((entry, index) => {
    const track = byId.get(entry.id)
    return {
      key: `entry-${index}`,
      trackId: entry.id,
      title: track?.title || entry.title || entry.id || 'Unavailable track',
      artist: track?.artist || entry.subtitle || 'Unknown artist',
      duration: track?.duration ?? '',
      files: availableFileReferences(track?.digitalFiles ?? []),
    }
  })
}

function availableFileReferences(files: readonly TrackDigitalFile[]) {
  const seen = new Set<string>()
  return files.flatMap((file) => {
    // This checks recorded references only, not actual availability on disk.
    if (
      !file.path.trim() ||
      !file.localAudioFileId.trim() ||
      !file.digitalTrackFileLinkId.trim()
    ) {
      return []
    }
    const identity = JSON.stringify([file.localAudioFileId, file.path])
    if (seen.has(identity)) return []
    seen.add(identity)
    return [{ ...file }]
  })
}
