import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import {
  updateImportRelationSuggestion,
  type ImportRelationSuggestionDecision,
  type ImportRelationSuggestionPayload,
  type ReleaseImportConfirmationPreflight,
  type ReleaseImportDraft,
  type ReleaseImportSession,
} from '../catalog/catalogApi'
import { cloneDraft } from './importHelpers'

type Props = Readonly<{
  selectedSession: ReleaseImportSession | null
  selectedDraftId: string
  handleRequestError: (requestError: unknown, nextStatus: string) => boolean
  setConfirmationPreflight: (
    value: ReleaseImportConfirmationPreflight | null,
  ) => void
  setDraft: Dispatch<SetStateAction<ReleaseImportDraft | null>>
  setError: (value: string | null) => void
  setPendingAction: (value: string | null) => void
  setSelectedDraftId: (value: string) => void
  setSelectedSession: (value: ReleaseImportSession) => void
  setStatus: (value: string) => void
}>

export function useImportRelationSuggestionAction({
  selectedSession,
  selectedDraftId,
  handleRequestError,
  setConfirmationPreflight,
  setDraft,
  setError,
  setPendingAction,
  setSelectedDraftId,
  setSelectedSession,
  setStatus,
}: Props) {
  const updateRelationSuggestion = useCallback(
    async (
      suggestionId: string,
      decision: ImportRelationSuggestionDecision,
      reviewed: ImportRelationSuggestionPayload,
    ) => {
      if (!selectedSession) return

      const preservedDraftId = selectedDraftId
      setStatus('Updating relation suggestion')
      setPendingAction(`relation-suggestion:${suggestionId}`)
      try {
        const session = await updateImportRelationSuggestion(
          selectedSession.id,
          suggestionId,
          { decision, reviewed },
        )
        const updatedDraft =
          session.drafts?.find((item) => item.id === preservedDraftId) ?? null

        setSelectedSession(session)
        setSelectedDraftId(preservedDraftId)
        const replacementDraft = updatedDraft ? cloneDraft(updatedDraft) : null
        setDraft((currentDraft) =>
          currentDraft?.id === preservedDraftId
            ? replacementDraft
            : currentDraft,
        )
        setConfirmationPreflight(null)
        setStatus('Relation suggestion updated')
        setError(null)
      } catch (requestError) {
        handleRequestError(requestError, 'Relation suggestion update failed')
      } finally {
        setPendingAction(null)
      }
    },
    [
      handleRequestError,
      selectedDraftId,
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

  return { updateRelationSuggestion }
}
