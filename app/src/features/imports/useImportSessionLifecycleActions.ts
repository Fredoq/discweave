import { useCallback } from 'react'
import {
  archiveImportSession,
  deleteImportSession,
  type ReleaseImportSession,
} from '../catalog/catalogApi'

type Props = Readonly<{
  selectedSession: ReleaseImportSession | null
  includeArchivedSessions: boolean
  refreshSessions: () => Promise<boolean>
  handleRequestError: (requestError: unknown, nextStatus: string) => boolean
  setConfirmationPreflight: (value: null) => void
  setDraft: (value: null) => void
  setError: (value: string | null) => void
  setPendingAction: (value: string | null) => void
  setSelectedDraftId: (value: string) => void
  setSelectedSession: (value: ReleaseImportSession | null) => void
  setStatus: (value: string) => void
}>

export function useImportSessionLifecycleActions({
  selectedSession,
  includeArchivedSessions,
  refreshSessions,
  handleRequestError,
  setConfirmationPreflight,
  setDraft,
  setError,
  setPendingAction,
  setSelectedDraftId,
  setSelectedSession,
  setStatus,
}: Props) {
  const archiveSession = useCallback(
    async (session: ReleaseImportSession) => {
      setStatus('Archiving session')
      setPendingAction(`archive:${session.id}`)
      setError(null)
      try {
        const archived = await archiveImportSession(session.id)
        if (selectedSession?.id === session.id) {
          if (includeArchivedSessions) {
            setSelectedSession(archived)
          } else {
            setSelectedSession(null)
            setSelectedDraftId('')
            setDraft(null)
          }
          setConfirmationPreflight(null)
        }
        const sessionsLoaded = await refreshSessions()
        if (!sessionsLoaded) return
        setStatus('Session archived')
        setError(null)
      } catch (requestError) {
        handleRequestError(requestError, 'Archive failed')
      } finally {
        setPendingAction(null)
      }
    },
    [
      handleRequestError,
      includeArchivedSessions,
      refreshSessions,
      selectedSession,
      setConfirmationPreflight,
      setDraft,
      setError,
      setPendingAction,
      setSelectedDraftId,
      setSelectedSession,
      setStatus,
    ],
  )

  const deleteSession = useCallback(
    async (session: ReleaseImportSession) => {
      const confirmed = globalThis.confirm(
        'Delete this abandoned import session? Confirmed catalog data is protected and cannot be deleted here.',
      )
      if (!confirmed) {
        setStatus('Delete cancelled')
        return
      }

      setStatus('Deleting session')
      setPendingAction(`delete:${session.id}`)
      setError(null)
      try {
        await deleteImportSession(session.id)
        if (selectedSession?.id === session.id) {
          setSelectedSession(null)
          setSelectedDraftId('')
          setDraft(null)
          setConfirmationPreflight(null)
        }
        const sessionsLoaded = await refreshSessions()
        if (!sessionsLoaded) return
        setStatus('Session deleted')
        setError(null)
      } catch (requestError) {
        handleRequestError(requestError, 'Delete failed')
      } finally {
        setPendingAction(null)
      }
    },
    [
      handleRequestError,
      refreshSessions,
      selectedSession,
      setConfirmationPreflight,
      setDraft,
      setError,
      setPendingAction,
      setSelectedDraftId,
      setSelectedSession,
      setStatus,
    ],
  )

  return { archiveSession, deleteSession }
}
