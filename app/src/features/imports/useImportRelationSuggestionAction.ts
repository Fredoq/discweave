import { useCallback, type Dispatch, type SetStateAction } from 'react'
import {
  updateImportRelationSuggestion,
  type ImportRelationSuggestionDecision,
  type ImportRelationSuggestionPayload,
  type ReleaseImportConfirmationPreflight,
  type ReleaseImportSession,
} from '../catalog/catalogApi'

type Props = Readonly<{
  selectedSession: ReleaseImportSession | null
  handleRequestError: (requestError: unknown, nextStatus: string) => boolean
  setConfirmationPreflight: (
    value: ReleaseImportConfirmationPreflight | null,
  ) => void
  setError: (value: string | null) => void
  setPendingAction: (value: string | null) => void
  setSelectedSession: Dispatch<SetStateAction<ReleaseImportSession | null>>
  setStatus: (value: string) => void
}>

export function useImportRelationSuggestionAction({
  selectedSession,
  handleRequestError,
  setConfirmationPreflight,
  setError,
  setPendingAction,
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

      setStatus('Updating relation suggestion')
      setPendingAction(`relation-suggestion:${suggestionId}`)
      try {
        const session = await updateImportRelationSuggestion(
          selectedSession.id,
          suggestionId,
          { decision, reviewed },
        )

        setSelectedSession((currentSession) => {
          if (currentSession?.id !== session.id) {
            return currentSession
          }

          return {
            ...currentSession,
            relationSuggestions: session.relationSuggestions,
          }
        })
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
      selectedSession,
      setConfirmationPreflight,
      setError,
      setPendingAction,
      setSelectedSession,
      setStatus,
    ],
  )

  return { updateRelationSuggestion }
}
