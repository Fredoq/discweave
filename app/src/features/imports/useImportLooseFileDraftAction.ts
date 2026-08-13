import { useCallback } from 'react'
import {
  createImportDraftFromLooseFiles,
  type CreateLooseFileDraftRequest,
  type ReleaseImportConfirmationPreflight,
  type ReleaseImportDraft,
  type ReleaseImportSession,
} from '../catalog/catalogApi'
import { cloneDraft } from './importHelpers'

type Props = Readonly<{
  selectedSession: ReleaseImportSession | null
  refreshSessions: () => Promise<boolean>
  handleRequestError: (requestError: unknown, nextStatus: string) => boolean
  setConfirmationPreflight: (
    value: ReleaseImportConfirmationPreflight | null,
  ) => void
  setDraft: (value: ReleaseImportDraft | null) => void
  setError: (value: string | null) => void
  setPendingAction: (value: string | null) => void
  setSelectedDraftId: (value: string) => void
  setSelectedSession: (value: ReleaseImportSession) => void
  setStatus: (value: string) => void
}>

export function useImportLooseFileDraftAction({
  selectedSession,
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
  const createLooseFileDraft = useCallback(
    async (request: CreateLooseFileDraftRequest) => {
      const candidateIds = request.candidateIds
      if (!selectedSession || candidateIds.length === 0) return

      setStatus('Creating release draft')
      setPendingAction('loose-file-draft')
      setError(null)
      try {
        const session = await createImportDraftFromLooseFiles(
          selectedSession.id,
          request,
        )
        const selectedIds = new Set(candidateIds)
        const createdDraftId =
          session.looseFileCandidates?.find(
            (candidate) =>
              selectedIds.has(candidate.id) && Boolean(candidate.sourceDraftId),
          )?.sourceDraftId ?? session.drafts?.at(-1)?.id
        const createdDraft =
          session.drafts?.find((item) => item.id === createdDraftId) ??
          session.drafts?.at(-1) ??
          null

        setSelectedSession(session)
        setSelectedDraftId(createdDraft?.id ?? '')
        setDraft(createdDraft ? cloneDraft(createdDraft) : null)
        setConfirmationPreflight(null)
        const sessionsLoaded = await refreshSessions()
        if (!sessionsLoaded) return
        setStatus('Release draft created')
        setError(null)
      } catch (requestError) {
        handleRequestError(requestError, 'Release draft creation failed')
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

  return { createLooseFileDraft }
}
