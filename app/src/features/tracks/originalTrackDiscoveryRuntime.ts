import type { OriginalTrackDiscoveryState } from './useOriginalTrackDiscovery'

export type OriginalTrackDiscoveryRuntime = {
  request: AbortController | null
  generation: number
  submitting: boolean
  disposed: boolean
  externalDraftIdempotencyKey: string | null
}

export const initialOriginalTrackDiscoveryState: OriginalTrackDiscoveryState = {
  isOpen: false,
  sourceTrackId: null,
  status: 'idle',
  step: 'candidates',
  candidates: [],
  localCandidates: [],
  externalCandidates: [],
  releaseCandidates: [],
  deepCandidates: [],
  hasReliableLocalCandidate: false,
  externalStatus: 'idle',
  deepSearchStatus: 'idle',
  providerStatuses: [],
  externalWarnings: [],
  searchDiagnostics: [],
  externalError: '',
  selectedCandidateKey: null,
  relationTypeCode: null,
  candidateScrollOffset: 0,
  selectedExternalRouteKey: null,
  discoveryError: '',
  discoveryErrorCode: null,
  mutationError: '',
  submitting: false,
}

export function isCurrentRequest(
  controller: AbortController,
  generation: number,
  runtime: OriginalTrackDiscoveryRuntime,
) {
  return (
    !controller.signal.aborted &&
    !runtime.disposed &&
    runtime.request === controller &&
    runtime.generation === generation
  )
}

export function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
}

export function isCurrentConfirmation(
  runtime: OriginalTrackDiscoveryRuntime,
  generation: number,
) {
  return !runtime.disposed && runtime.generation === generation
}
