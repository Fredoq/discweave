import { useCallback, useMemo, useState } from 'react'
import type { ReleaseImportDraftTrack } from '../catalog/catalogApi'
import {
  importTrackFilePath,
  isImportFileOpenAvailable,
  openImportFile,
  type ImportFileOpenResult,
} from './importFileActions'

export type ImportTrackPlayback = Readonly<{
  canPlay: (track: ReleaseImportDraftTrack) => boolean
  failureFor: (track: ReleaseImportDraftTrack) => string | null
  isPending: (track: ReleaseImportDraftTrack) => boolean
  play: (track: ReleaseImportDraftTrack) => Promise<void>
}>

export function useImportTrackPlayback(): ImportTrackPlayback {
  const [pendingPath, setPendingPath] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, ImportFileOpenResult>>(
    {},
  )
  const isAvailable = isImportFileOpenAvailable()

  const play = useCallback(async (track: ReleaseImportDraftTrack) => {
    const filePath = importTrackFilePath(track)
    if (!filePath) {
      return
    }

    setPendingPath(filePath)
    try {
      const result = await openImportFile(filePath)
      setResults((current) => ({ ...current, [filePath]: result }))
    } finally {
      setPendingPath((current) => (current === filePath ? null : current))
    }
  }, [])

  return useMemo(
    () => ({
      canPlay: (track) => isAvailable && Boolean(importTrackFilePath(track)),
      failureFor: (track) => {
        const result = results[importTrackFilePath(track)]
        return result && !result.ok ? playbackFailureMessage(result) : null
      },
      isPending: (track) =>
        pendingPath !== null && pendingPath === importTrackFilePath(track),
      play,
    }),
    [isAvailable, pendingPath, play, results],
  )
}

function playbackFailureMessage(
  result: Extract<ImportFileOpenResult, { ok: false }>,
) {
  return result.reason === 'missing'
    ? 'File not found on disk.'
    : result.message
}
