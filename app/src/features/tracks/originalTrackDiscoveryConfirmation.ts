import {
  buildOriginalCandidateStackCommand,
  findOriginalCandidate,
} from './originalTrackDiscoveryModel'
import { localCandidateForReview } from './originalTrackDiscoveryPresentation'
import { errorMessage } from './originalTrackDiscoveryState'
import {
  isCurrentConfirmation,
  type OriginalTrackDiscoveryRuntime,
} from './originalTrackDiscoveryRuntime'
import type {
  OriginalCandidateConfirmation,
  OriginalTrackDiscoveryConfirmedResult,
  OriginalTrackDiscoveryState,
} from './useOriginalTrackDiscovery'
import type { StackRelationTypeOption } from './trackStackModel'

export async function confirmLocalOriginalTrack({
  confirmStackRelation,
  onConfirmed,
  patch,
  relationTypeOptions,
  reset,
  runtime,
  state,
}: Readonly<{
  confirmStackRelation: OriginalCandidateConfirmation
  onConfirmed: (result: OriginalTrackDiscoveryConfirmedResult) => void
  patch: (changes: Partial<OriginalTrackDiscoveryState>) => void
  relationTypeOptions: readonly StackRelationTypeOption[]
  reset: () => void
  runtime: OriginalTrackDiscoveryRuntime
  state: OriginalTrackDiscoveryState
}>): Promise<boolean> {
  if (
    runtime.submitting ||
    state.sourceTrackId === null ||
    state.step !== 'review'
  ) {
    return false
  }

  const candidate = findOriginalCandidate(
    state.candidates,
    state.selectedCandidateKey,
  )
  const localCandidate = localCandidateForReview(candidate)
  const typeEnabled = relationTypeOptions.some(
    (option) => option.code === state.relationTypeCode,
  )
  const command = typeEnabled
    ? buildOriginalCandidateStackCommand(
        state.sourceTrackId,
        localCandidate,
        state.relationTypeCode,
        true,
      )
    : null
  if (command === null || localCandidate === null) {
    return false
  }

  const confirmationGeneration = runtime.generation
  runtime.submitting = true
  patch({ submitting: true, mutationError: '' })
  try {
    await confirmStackRelation(command)
  } catch (error) {
    runtime.submitting = false
    if (!isCurrentConfirmation(runtime, confirmationGeneration)) {
      return false
    }
    patch({
      step: 'review',
      submitting: false,
      mutationError: errorMessage(
        error,
        'Could not confirm this original track. Try again',
      ),
    })
    return false
  }

  runtime.submitting = false
  if (!isCurrentConfirmation(runtime, confirmationGeneration)) {
    return false
  }
  onConfirmed({
    candidate: localCandidate,
    relationTypeCode: command.relationTypeCode,
  })
  reset()
  return true
}
