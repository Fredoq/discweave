import { trackDigitalFilePositionLabel } from '../tracks/trackDisplayHelpers'
import type { TrackDigitalFile, TrackRecord } from '../tracks/tracksData'

export type LocalFileOpenFailureReason =
  | 'invalid-path'
  | 'missing'
  | 'not-file'
  | 'system-error'
  | 'unavailable'

export type LocalFileOpenResult =
  | { ok: true; path: string }
  | {
      ok: false
      path?: string
      reason: LocalFileOpenFailureReason
      message: string
    }

export type LocalOpenableFile = {
  id: string
  dedupeKey: string
  trackId: string
  trackTitle: string
  localAudioFileId: string
  digitalTrackFileLinkId: string
  path: string
  format: string
  releaseTitle: string
  position: string
}

export function isLocalFileOpenAvailable() {
  return Boolean(
    window.discweaveDesktop?.isDesktop && window.discweaveDesktop.localFiles,
  )
}

export async function openLocalFile(
  file: Pick<
    LocalOpenableFile,
    'digitalTrackFileLinkId' | 'localAudioFileId' | 'path'
  >,
): Promise<LocalFileOpenResult> {
  const open = window.discweaveDesktop?.localFiles?.open
  if (!open) {
    return {
      ok: false,
      path: file.path,
      reason: 'unavailable',
      message: 'Local file open is available only in the desktop app.',
    }
  }

  return await open({
    digitalTrackFileLinkId: file.digitalTrackFileLinkId,
    localAudioFileId: file.localAudioFileId,
    path: file.path,
  })
}

export function openableFilesFromTrack(track: TrackRecord) {
  return uniqueOpenableFiles(
    track.digitalFiles
      .map((file) => openableFileFromTrackDigitalFile(track, file))
      .filter((file): file is LocalOpenableFile => Boolean(file)),
  )
}

export function openableFilesFromReleaseTracks(
  tracks: readonly TrackRecord[],
  releaseId: string,
) {
  return uniqueOpenableFiles(
    tracks.flatMap((track) =>
      track.digitalFiles
        .filter((file) => file.releaseId === releaseId)
        .map((file) => openableFileFromTrackDigitalFile(track, file))
        .filter((file): file is LocalOpenableFile => Boolean(file)),
    ),
  )
}

export function openableFilesFromStackTracks(tracks: readonly TrackRecord[]) {
  return uniqueOpenableFiles(tracks.flatMap(openableFilesFromTrack))
}

function openableFileFromTrackDigitalFile(
  track: TrackRecord,
  digitalFile: TrackDigitalFile,
): LocalOpenableFile | null {
  const localAudioFileId = digitalFile.localAudioFileId.trim()
  const filePath = digitalFile.path.trim()
  if (!localAudioFileId || !filePath) {
    return null
  }

  return {
    id: digitalFile.digitalTrackFileLinkId || localAudioFileId,
    dedupeKey: `local:${localAudioFileId.toLowerCase()}`,
    trackId: track.id,
    trackTitle: track.title,
    localAudioFileId,
    digitalTrackFileLinkId: digitalFile.digitalTrackFileLinkId,
    path: filePath,
    format: digitalFile.format.trim() || 'Unknown format',
    releaseTitle: digitalFile.releaseTitle || track.release.title,
    position: trackDigitalFilePositionLabel(digitalFile),
  }
}

function uniqueOpenableFiles(files: LocalOpenableFile[]) {
  const seen = new Set<string>()
  const uniqueFiles: LocalOpenableFile[] = []

  for (const file of files) {
    const dedupeKey = file.dedupeKey || `path:${file.path.trim().toLowerCase()}`
    if (seen.has(dedupeKey)) {
      continue
    }

    seen.add(dedupeKey)
    uniqueFiles.push(file)
  }

  return uniqueFiles
}
