import type {
  ExternalReleaseDraftRequestDto,
  ExternalOriginalCandidateReleaseRouteDto,
} from '../catalog/api/catalogDtoTypes'
import type { ReleaseImportSession } from '../catalog/api/catalogImportTypes'
import { errorMessage } from './originalTrackDiscoveryState'
import {
  isLocalDiscoveryCandidate,
  type OriginalTrackDiscoveryCandidate,
} from './originalTrackDiscoveryPresentation'
import type { OriginalTrackDiscoveryState } from './useOriginalTrackDiscovery'

export type ExternalDraftRuntime = {
  request: AbortController | null
  generation: number
  submitting: boolean
  disposed: boolean
  externalDraftIdempotencyKey: string | null
}

export type ExternalDraftCreator = (
  request: ExternalReleaseDraftRequestDto,
  options: Readonly<{ signal: AbortSignal }>,
) => Promise<ReleaseImportSession>

export async function confirmExternalDraft({
  state,
  runtime,
  candidate,
  createDraft,
  onCreated,
  patch,
}: {
  state: OriginalTrackDiscoveryState
  runtime: ExternalDraftRuntime
  candidate: OriginalTrackDiscoveryCandidate | null
  createDraft: ExternalDraftCreator
  onCreated: (session: ReleaseImportSession) => void
  patch: (changes: Partial<OriginalTrackDiscoveryState>) => void
}): Promise<boolean> {
  if (
    runtime.submitting ||
    state.sourceTrackId === null ||
    state.step !== 'review' ||
    candidate === null ||
    isLocalDiscoveryCandidate(candidate)
  ) {
    return false
  }

  const external = candidate.externalCandidate
  const route = external?.releaseRoutes.find(
    (item) => externalReleaseRouteKey(item) === state.selectedExternalRouteKey,
  )
  const relationTypeCode = state.relationTypeCode
  if (
    external === null ||
    external === undefined ||
    route === undefined ||
    !relationTypeCode ||
    external.recordingSource.providerCode.toLowerCase() !== 'musicbrainz' ||
    route.releaseSource.providerCode.toLowerCase() !== 'musicbrainz'
  ) {
    return false
  }

  const confirmationGeneration = runtime.generation
  runtime.submitting = true
  runtime.externalDraftIdempotencyKey ??= createIdempotencyKey()
  patch({ submitting: true, mutationError: '' })
  const request: ExternalReleaseDraftRequestDto = {
    sourceTrackId: state.sourceTrackId,
    recordingMbid: external.recordingSource.externalId,
    musicBrainzRow: {
      releaseMbid: route.releaseSource.externalId,
      mediumPosition: route.mediumPosition,
      trackMbid: route.musicBrainzTrackMbid,
    },
    reviewedRelationTypeCode: relationTypeCode,
    idempotencyKey: runtime.externalDraftIdempotencyKey,
  }
  if (route.discogsBinding) {
    request.discogsRoute = {
      releaseId: route.discogsBinding.releaseSource.externalId,
      rowOrdinal: route.discogsBinding.rowOrdinal,
      position: route.discogsBinding.position,
      fingerprint: route.discogsBinding.fingerprint,
    }
  }

  const requestController = new AbortController()
  runtime.request = requestController
  try {
    const session = await createDraft(request, {
      signal: requestController.signal,
    })
    if (!isCurrentConfirmation(runtime, confirmationGeneration)) {
      return false
    }
    runtime.submitting = false
    runtime.request = null
    runtime.externalDraftIdempotencyKey = null
    onCreated(session)
    return true
  } catch (error) {
    runtime.submitting = false
    runtime.request = null
    if (!isCurrentConfirmation(runtime, confirmationGeneration)) {
      return false
    }
    patch({
      submitting: false,
      mutationError: errorMessage(
        error,
        'Could not create the release draft. Try again',
      ),
    })
    return false
  }
}

export function externalReleaseRouteKey(
  route: Pick<
    ExternalOriginalCandidateReleaseRouteDto,
    | 'releaseSource'
    | 'mediumPosition'
    | 'musicBrainzTrackMbid'
    | 'discogsBinding'
  >,
) {
  return [
    route.releaseSource.externalId,
    route.mediumPosition,
    route.musicBrainzTrackMbid,
    route.discogsBinding?.releaseSource.externalId ?? '',
    route.discogsBinding?.rowOrdinal ?? '',
    route.discogsBinding?.position ?? '',
    route.discogsBinding?.fingerprint ?? '',
  ].join(':')
}

export function defaultExternalRouteKey(
  candidate: OriginalTrackDiscoveryCandidate | null,
) {
  if (candidate === null || isLocalDiscoveryCandidate(candidate)) {
    return null
  }

  const routes = candidate.externalCandidate?.releaseRoutes ?? []
  if (routes.length !== 1) {
    return null
  }

  const route = routes[0]
  return route ? externalReleaseRouteKey(route) : null
}

function createIdempotencyKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `external-original-${Date.now()}`
}

function isCurrentConfirmation(
  runtime: ExternalDraftRuntime,
  generation: number,
) {
  return !runtime.disposed && runtime.generation === generation
}
