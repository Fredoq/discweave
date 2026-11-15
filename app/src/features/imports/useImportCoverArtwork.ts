import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { selectExternalCover } from '../catalog/api/importCoverSearchClient'
import {
  loadImportCoverArtwork,
  selectImportCoverArtwork,
  uploadImportCoverArtwork,
  type ImportCoverArtwork,
} from '../catalog/api/importCoverClient'
export type ImportCoverCallbacks = {
  onSelection: (sourcePath: string | null) => void
  onPendingChange: (pending: boolean) => void
}
export function useImportCoverArtwork(
  sessionId: string,
  draftId: string,
  callbacks: ImportCoverCallbacks,
) {
  const [artwork, setArtwork] = useState<ImportCoverArtwork | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setLoading] = useState(true)
  const [isSaving, setSaving] = useState(false)
  const [reload, setReload] = useState(0)
  const [status, setStatus] = useState('')
  const active = useRef(false)
  const busy = useRef(false)
  const latestCallbacks = useRef(callbacks)
  useLayoutEffect(() => {
    latestCallbacks.current = callbacks
  })
  useEffect(() => {
    active.current = true
    const controller = new AbortController()
    void loadImportCoverArtwork(sessionId, draftId, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setArtwork(result)
      })
      .catch((error_: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(error_))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => {
      active.current = false
      controller.abort()
    }
  }, [sessionId, draftId, reload])
  async function mutate(operation: () => Promise<ImportCoverArtwork>) {
    if (busy.current) return
    busy.current = true
    setSaving(true)
    setError('')
    setStatus('')
    latestCallbacks.current.onPendingChange(true)
    try {
      const result = await operation()
      if (!active.current) return
      setArtwork(result)
      latestCallbacks.current.onSelection(result.selected?.sourcePath ?? null)
      setStatus(
        result.selected
          ? 'Cover saved to this draft.'
          : 'No cover saved for this draft.',
      )
    } catch (error_) {
      if (active.current) setError(errorMessage(error_))
    } finally {
      busy.current = false
      latestCallbacks.current.onPendingChange(false)
      if (active.current) setSaving(false)
    }
  }
  return {
    artwork,
    error,
    isLoading,
    isSaving,
    status,
    retry: () => {
      setError('')
      setLoading(true)
      setReload((value) => value + 1)
    },
    select: (candidateId: string | null) =>
      mutate(() => selectImportCoverArtwork(sessionId, draftId, candidateId)),
    upload: (file: File) =>
      mutate(() => uploadImportCoverArtwork(sessionId, draftId, file)),
    selectExternal: (releaseId: string, imageId: string) =>
      mutate(() => selectExternalCover(sessionId, draftId, releaseId, imageId)),
  }
}
function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Cover update failed. Try again.'
}
