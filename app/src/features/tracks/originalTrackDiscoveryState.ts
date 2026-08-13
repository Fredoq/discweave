import type { LocalOriginalCandidateListDto } from '../catalog/api/catalogDtoTypes'
import { CatalogApiError } from '../catalog/api/httpClient'
import { presentOriginalCandidates } from './originalTrackDiscoveryPresentation'

export type DiscoveryCandidateConfidence = Readonly<{
  confidence: 'high' | 'medium' | 'low'
}>

export function loadedStatus(
  response: LocalOriginalCandidateListDto,
): 'loaded' | 'empty' {
  return loadedCandidateStatus(response.items)
}

export function loadedCandidateStatus(
  candidates: readonly DiscoveryCandidateConfidence[],
): 'loaded' | 'empty' {
  return candidates.some(
    (candidate) =>
      candidate.confidence === 'high' || candidate.confidence === 'medium',
  )
    ? 'loaded'
    : 'empty'
}

export function isReliableLocal(response: LocalOriginalCandidateListDto) {
  return (
    response.hasReliableLocalCandidate &&
    response.items.filter((candidate) => candidate.confidence === 'high')
      .length === 1
  )
}

export function reliableLocalState(response: LocalOriginalCandidateListDto) {
  return {
    status: loadedStatus(response),
    candidates: presentOriginalCandidates(response.items, []),
    localCandidates: response.items,
    externalCandidates: [],
    hasReliableLocalCandidate: true,
    externalStatus: 'loaded' as const,
    providerStatuses: [],
    externalWarnings: [],
    externalError: '',
  }
}

export function discoveryFailure(error: unknown): {
  status: 'source-not-found' | 'source-not-eligible' | 'retryable-error'
  discoveryError: string
  discoveryErrorCode: string | null
} {
  if (error instanceof CatalogApiError) {
    if (error.status === 404 && error.code === 'track.not_found') {
      return {
        status: 'source-not-found',
        discoveryError: error.message,
        discoveryErrorCode: error.code,
      }
    }
    if (
      error.status === 409 &&
      error.code === 'original_discovery.source_not_eligible'
    ) {
      return {
        status: 'source-not-eligible',
        discoveryError: error.message,
        discoveryErrorCode: error.code,
      }
    }
  }

  return {
    status: 'retryable-error',
    discoveryError: errorMessage(
      error,
      'Could not find original-track candidates. Try again',
    ),
    discoveryErrorCode: error instanceof CatalogApiError ? error.code : null,
  }
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : fallback
}
