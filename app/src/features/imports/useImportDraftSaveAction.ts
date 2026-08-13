import { useCallback } from 'react'
import type {
  ReleaseImportDraft,
  ReleaseImportSession,
} from '../catalog/catalogApi'
import { updateImportDraft } from '../catalog/catalogApi'
import { cloneDraft } from './importHelpers'

type Props = Readonly<{
  draft: ReleaseImportDraft | null
  selectedSession: ReleaseImportSession | null
  setDraft: (value: ReleaseImportDraft | null) => void
  setError: (value: string | null) => void
  setPendingAction: (value: string | null) => void
  setSelectedDraftId: (value: string) => void
  setSelectedSession: (value: ReleaseImportSession) => void
  setStatus: (value: string) => void
  handleRequestError: (requestError: unknown, nextStatus: string) => boolean
}>

export function useImportDraftSaveAction({
  draft,
  selectedSession,
  setDraft,
  setError,
  setPendingAction,
  setSelectedDraftId,
  setSelectedSession,
  setStatus,
  handleRequestError,
}: Props) {
  const saveDraft = useCallback(async () => {
    if (!selectedSession || !draft) {
      return null
    }

    const session = await updateImportDraft(selectedSession.id, draft)
    const savedDraft =
      session.drafts?.find((item) => item.id === draft.id) ?? draft
    setSelectedSession(session)
    setSelectedDraftId(savedDraft.id)
    setDraft(cloneDraft(savedDraft))
    return session
  }, [draft, selectedSession, setDraft, setSelectedDraftId, setSelectedSession])

  const saveDraftFromEditor = useCallback(() => {
    setStatus('Saving draft')
    setPendingAction('save')
    void saveDraft()
      .then(() => {
        setStatus('Draft saved')
        setError(null)
      })
      .catch((requestError: unknown) => {
        handleRequestError(requestError, 'Save failed')
      })
      .finally(() => {
        setPendingAction(null)
      })
  }, [handleRequestError, saveDraft, setError, setPendingAction, setStatus])

  return { saveDraft, saveDraftFromEditor }
}
