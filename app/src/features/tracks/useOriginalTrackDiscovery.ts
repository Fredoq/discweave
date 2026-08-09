import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ExternalOriginalCandidateDto,
  ExternalOriginalCandidateListDto,
  ExternalProviderSearchDiagnosticDto,
  ExternalProviderOperationStatusDto,
  ExternalReleaseDraftRequestDto,
  LocalOriginalCandidateDto,
  LocalOriginalCandidateListDto,
} from '../catalog/api/catalogDtoTypes'
import { CatalogApiError } from '../catalog/api/httpClient'
import {
  createExternalReleaseDraft,
  findExternalOriginalCandidates,
  listLocalOriginalCandidates,
  type FindExternalOriginalCandidatesOptions,
  type ListLocalOriginalCandidatesOptions,
} from '../catalog/api/originalTrackDiscoveryClient'
import type { ReleaseImportSession } from '../catalog/api/catalogImportTypes'
import {
  createStackRelation,
  type StackRelationCommand,
} from '../catalog/api/ownedRelationsClient'
import {
  findOriginalCandidate,
  initialOriginalCandidateRelationType,
} from './originalTrackDiscoveryModel'
import {
  presentOriginalCandidates,
  mergeExternalCandidates,
  replaceProviderItems,
  replaceProviderStatuses,
  replaceProviderWarnings,
  type OriginalTrackDiscoveryCandidate,
} from './originalTrackDiscoveryPresentation'
import {
  discoveryFailure,
  errorMessage,
  isReliableLocal,
  loadedCandidateStatus,
  loadedStatus,
  reliableLocalState,
} from './originalTrackDiscoveryState'
import type { StackRelationTypeOption } from './trackStackModel'
import { confirmLocalOriginalTrack } from './originalTrackDiscoveryConfirmation'
import {
  confirmExternalDraft,
  defaultExternalRouteKey,
  externalReleaseRouteKey,
} from './originalTrackDiscoveryExternalDraft'
import {
  initialOriginalTrackDiscoveryState,
  isAbortError,
  isCurrentRequest,
  type OriginalTrackDiscoveryRuntime,
} from './originalTrackDiscoveryRuntime'

export type OriginalTrackDiscoveryStatus =
  | 'idle'
  | 'loading'
  | 'loaded'
  | 'empty'
  | 'source-not-found'
  | 'source-not-eligible'
  | 'retryable-error'

export type OriginalTrackDiscoveryStep = 'candidates' | 'review'
export type ExternalDiscoveryStatus = 'idle' | 'loading' | 'loaded' | 'failed'

export type OriginalTrackDiscoveryState = Readonly<{
  isOpen: boolean
  sourceTrackId: string | null
  status: OriginalTrackDiscoveryStatus
  step: OriginalTrackDiscoveryStep
  candidates: OriginalTrackDiscoveryCandidate[]
  localCandidates: LocalOriginalCandidateDto[]
  externalCandidates: ExternalOriginalCandidateDto[]
  releaseCandidates: ExternalOriginalCandidateDto[]
  deepCandidates: ExternalOriginalCandidateDto[]
  hasReliableLocalCandidate: boolean
  externalStatus: ExternalDiscoveryStatus
  deepSearchStatus: ExternalDiscoveryStatus
  providerStatuses: ExternalProviderOperationStatusDto[]
  externalWarnings: string[]
  searchDiagnostics: ExternalProviderSearchDiagnosticDto[]
  externalError: string
  selectedCandidateKey: string | null
  relationTypeCode: string | null
  candidateScrollOffset: number
  selectedExternalRouteKey: string | null
  discoveryError: string
  discoveryErrorCode: string | null
  mutationError: string
  submitting: boolean
}>

export type OriginalCandidateLoader = (
  trackId: string,
  options: ListLocalOriginalCandidatesOptions,
) => Promise<LocalOriginalCandidateListDto>

export type ExternalOriginalCandidateLoader = (
  trackId: string,
  options: FindExternalOriginalCandidatesOptions,
) => Promise<ExternalOriginalCandidateListDto>

export type OriginalCandidateConfirmation = (
  command: StackRelationCommand,
) => Promise<void>

export type OriginalTrackDiscoveryConfirmedResult = Readonly<{
  candidate: LocalOriginalCandidateDto
  relationTypeCode: string
}>

export type UseOriginalTrackDiscoveryOptions = Readonly<{
  relationTypeOptions: readonly StackRelationTypeOption[]
  loadCandidates?: OriginalCandidateLoader
  loadExternalCandidates?: ExternalOriginalCandidateLoader
  confirmStackRelation?: OriginalCandidateConfirmation
  onConfirmed?: (result: OriginalTrackDiscoveryConfirmedResult) => void
  createExternalDraft?: (
    request: ExternalReleaseDraftRequestDto,
    options: Readonly<{ signal: AbortSignal }>,
  ) => Promise<ReleaseImportSession>
  onExternalDraftCreated?: (session: ReleaseImportSession) => void
}>

const initialState = initialOriginalTrackDiscoveryState

const ignoreConfirmed = () => undefined
const ignoreExternalDraftCreated = () => undefined

export function useOriginalTrackDiscovery({
  relationTypeOptions,
  loadCandidates = listLocalOriginalCandidates,
  loadExternalCandidates = findExternalOriginalCandidates,
  confirmStackRelation = createStackRelation,
  onConfirmed = ignoreConfirmed,
  createExternalDraft = createExternalReleaseDraft,
  onExternalDraftCreated = ignoreExternalDraftCreated,
}: UseOriginalTrackDiscoveryOptions) {
  const runtime = useRef<OriginalTrackDiscoveryRuntime>({
    request: null,
    generation: 0,
    submitting: false,
    disposed: false,
    externalDraftIdempotencyKey: null,
  })
  const [state, setState] = useState<OriginalTrackDiscoveryState>(initialState)
  const patch = useCallback((changes: Partial<OriginalTrackDiscoveryState>) => {
    setState((current) => ({ ...current, ...changes }))
  }, [])

  const loadSource = useCallback(
    async (sourceTrackId: string) => {
      const current = runtime.current
      if (current.submitting || current.disposed) {
        return
      }

      current.generation += 1
      current.request?.abort()
      current.externalDraftIdempotencyKey = null
      const generation = current.generation
      const controller = new AbortController()
      current.request = controller
      setState({
        ...initialState,
        isOpen: true,
        sourceTrackId,
        status: 'loading',
      })

      try {
        const response = await loadCandidates(sourceTrackId, {
          signal: controller.signal,
        })
        if (!isCurrentRequest(controller, generation, current)) {
          return
        }

        const localState: OriginalTrackDiscoveryState = {
          ...initialState,
          isOpen: true,
          sourceTrackId,
          status: loadedStatus(response),
          candidates: presentOriginalCandidates(response.items, []),
          localCandidates: response.items,
          hasReliableLocalCandidate: response.hasReliableLocalCandidate,
        }
        setState(localState)
        if (isReliableLocal(response)) {
          return
        }

        setState({ ...localState, externalStatus: 'loading' })
        try {
          const external = await loadExternalCandidates(sourceTrackId, {
            searchMode: 'releaseFirst',
            signal: controller.signal,
          })
          if (!isCurrentRequest(controller, generation, current)) {
            return
          }
          const local = external.local
          const candidates = presentOriginalCandidates(
            local.items,
            external.items,
          )
          setState((previous) => ({
            ...previous,
            status: loadedCandidateStatus(candidates),
            candidates,
            localCandidates: local.items,
            externalCandidates: external.items,
            releaseCandidates: external.items,
            deepCandidates: [],
            hasReliableLocalCandidate: local.hasReliableLocalCandidate,
            externalStatus: 'loaded',
            providerStatuses: external.providerStatuses,
            externalWarnings: external.warnings,
            searchDiagnostics: external.searchDiagnostics ?? [],
          }))
        } catch (error) {
          if (
            error instanceof CatalogApiError &&
            error.status === 409 &&
            error.code === 'original_discovery.local_candidate_available'
          ) {
            const refreshed = await loadCandidates(sourceTrackId, {
              signal: controller.signal,
            })
            if (!isCurrentRequest(controller, generation, current)) {
              return
            }
            setState((previous) => ({
              ...previous,
              ...reliableLocalState(refreshed),
            }))
            return
          }
          if (
            isAbortError(error) ||
            !isCurrentRequest(controller, generation, current)
          ) {
            return
          }
          setState((previous) => ({
            ...previous,
            externalStatus: 'failed',
            externalError: errorMessage(
              error,
              'Could not search external providers. Try again',
            ),
          }))
        }
      } catch (error) {
        if (
          isAbortError(error) ||
          !isCurrentRequest(controller, generation, current)
        ) {
          return
        }

        const failure = discoveryFailure(error)
        setState({
          ...initialState,
          isOpen: true,
          sourceTrackId,
          ...failure,
        })
      } finally {
        if (current.request === controller) {
          current.request = null
        }
      }
    },
    [loadCandidates, loadExternalCandidates],
  )

  useEffect(() => {
    const current = runtime.current
    current.disposed = false
    return () => {
      current.disposed = true
      current.generation += 1
      current.request?.abort()
      current.request = null
    }
  }, [])

  const open = useCallback(
    (sourceTrackId: string) => loadSource(sourceTrackId),
    [loadSource],
  )

  const retryLocal = useCallback(() => {
    if (
      !state.isOpen ||
      state.sourceTrackId === null ||
      state.status !== 'retryable-error' ||
      runtime.current.submitting
    ) {
      return Promise.resolve()
    }

    return loadSource(state.sourceTrackId)
  }, [loadSource, state.isOpen, state.sourceTrackId, state.status])

  const retryProvider = useCallback(
    async (providerCode: string) => {
      const current = runtime.current
      if (
        !state.isOpen ||
        state.sourceTrackId === null ||
        current.submitting ||
        current.disposed
      ) {
        return
      }

      current.generation += 1
      current.request?.abort()
      const generation = current.generation
      const controller = new AbortController()
      current.request = controller
      patch({ externalStatus: 'loading', externalError: '' })
      try {
        const response = await loadExternalCandidates(state.sourceTrackId, {
          providerCodes: [providerCode],
          searchMode: 'releaseFirst',
          signal: controller.signal,
        })
        if (!isCurrentRequest(controller, generation, current)) return
        setState((previous) => {
          const externalCandidates = replaceProviderItems(
            previous.externalCandidates,
            response.items,
            providerCode,
          )
          const localCandidates = response.local.items
          const candidates = presentOriginalCandidates(
            localCandidates,
            externalCandidates,
          )
          return {
            ...previous,
            status: loadedCandidateStatus(candidates),
            candidates,
            localCandidates,
            externalCandidates,
            hasReliableLocalCandidate: response.local.hasReliableLocalCandidate,
            externalStatus: 'loaded',
            providerStatuses: replaceProviderStatuses(
              previous.providerStatuses,
              response.providerStatuses,
              providerCode,
            ),
            externalWarnings: replaceProviderWarnings(
              previous.externalWarnings,
              response.warnings,
              providerCode,
            ),
            searchDiagnostics: replaceSearchDiagnostics(
              previous.searchDiagnostics,
              response.searchDiagnostics ?? [],
              providerCode,
            ),
          }
        })
      } catch (error) {
        if (
          error instanceof CatalogApiError &&
          error.status === 409 &&
          error.code === 'original_discovery.local_candidate_available'
        ) {
          const refreshed = await loadCandidates(state.sourceTrackId, {
            signal: controller.signal,
          })
          if (!isCurrentRequest(controller, generation, current)) return
          setState((previous) => ({
            ...previous,
            ...reliableLocalState(refreshed),
          }))
          return
        }
        if (
          isAbortError(error) ||
          !isCurrentRequest(controller, generation, current)
        ) {
          return
        }
        patch({
          externalStatus: 'failed',
          externalError: errorMessage(
            error,
            `Could not retry ${providerCode}. Try again`,
          ),
        })
      } finally {
        if (current.request === controller) current.request = null
      }
    },
    [
      loadExternalCandidates,
      loadCandidates,
      patch,
      state.isOpen,
      state.sourceTrackId,
    ],
  )

  const searchDeeper = useCallback(async () => {
    const current = runtime.current
    if (
      !state.isOpen ||
      state.sourceTrackId === null ||
      current.submitting ||
      current.disposed ||
      state.deepSearchStatus === 'loading'
    ) {
      return
    }

    current.generation += 1
    current.request?.abort()
    const generation = current.generation
    const controller = new AbortController()
    current.request = controller
    patch({ deepSearchStatus: 'loading', externalError: '' })
    try {
      const response = await loadExternalCandidates(state.sourceTrackId, {
        searchMode: 'deep',
        signal: controller.signal,
      })
      if (!isCurrentRequest(controller, generation, current)) return
      setState((previous) => {
        const externalCandidates = mergeExternalCandidates([
          ...previous.releaseCandidates,
          ...response.items,
        ])
        const localCandidates = response.local.items
        const candidates = presentOriginalCandidates(
          localCandidates,
          externalCandidates,
        )
        return {
          ...previous,
          status: loadedCandidateStatus(candidates),
          candidates,
          localCandidates,
          externalCandidates,
          deepCandidates: response.items,
          hasReliableLocalCandidate: response.local.hasReliableLocalCandidate,
          deepSearchStatus: 'loaded',
          providerStatuses: response.providerStatuses,
          externalWarnings: [
            ...new Set([...previous.externalWarnings, ...response.warnings]),
          ],
          searchDiagnostics: response.searchDiagnostics ?? [],
        }
      })
    } catch (error) {
      if (
        isAbortError(error) ||
        !isCurrentRequest(controller, generation, current)
      ) {
        return
      }
      patch({
        deepSearchStatus: 'failed',
        externalError: errorMessage(
          error,
          'Could not complete the deeper search. Try again',
        ),
      })
    } finally {
      if (current.request === controller) current.request = null
    }
  }, [
    loadExternalCandidates,
    patch,
    state.deepSearchStatus,
    state.isOpen,
    state.sourceTrackId,
  ])

  function selectCandidate(candidateKey: string): boolean {
    if (runtime.current.submitting) {
      return false
    }

    const candidate = findOriginalCandidate(state.candidates, candidateKey)
    if (!candidate) {
      return false
    }

    const relationType = initialOriginalCandidateRelationType(
      candidate,
      relationTypeOptions,
    )
    patch({
      selectedCandidateKey: candidate.candidateKey,
      relationTypeCode: relationType?.code ?? null,
      selectedExternalRouteKey: null,
      mutationError: '',
    })
    runtime.current.externalDraftIdempotencyKey = null
    return true
  }

  function selectReleaseCandidate(
    externalCandidateKey: string,
    routeKey: string,
  ): boolean {
    if (runtime.current.submitting) return false
    const candidate = state.candidates.find(
      (item) =>
        'kind' in item &&
        item.externalCandidate?.candidateKey === externalCandidateKey,
    )
    if (!candidate || !('kind' in candidate)) return false
    const routeExists = candidate.externalCandidate?.releaseRoutes.some(
      (route) => externalReleaseRouteKey(route) === routeKey,
    )
    if (!routeExists) return false

    const relationType = initialOriginalCandidateRelationType(
      candidate,
      relationTypeOptions,
    )
    patch({
      selectedCandidateKey: candidate.candidateKey,
      relationTypeCode: relationType?.code ?? null,
      selectedExternalRouteKey: routeKey,
      mutationError: '',
    })
    runtime.current.externalDraftIdempotencyKey = null
    return true
  }

  function continueToReview(): boolean {
    const candidate = findOriginalCandidate(
      state.candidates,
      state.selectedCandidateKey,
    )
    if (runtime.current.submitting || candidate === null) {
      return false
    }

    patch({
      step: 'review',
      selectedExternalRouteKey:
        state.selectedExternalRouteKey ?? defaultExternalRouteKey(candidate),
      mutationError: '',
    })
    return true
  }

  function backToCandidates(): boolean {
    if (runtime.current.submitting) {
      return false
    }

    patch({ step: 'candidates', mutationError: '' })
    return true
  }

  function close(): boolean {
    const current = runtime.current
    if (current.submitting) {
      return false
    }

    current.generation += 1
    current.request?.abort()
    current.request = null
    current.externalDraftIdempotencyKey = null
    setState(initialState)
    return true
  }

  function setRelationTypeCode(relationTypeCode: string | null) {
    if (runtime.current.submitting) {
      return
    }

    const enabled =
      relationTypeCode === null ||
      relationTypeOptions.some((option) => option.code === relationTypeCode)
    if (state.relationTypeCode !== relationTypeCode) {
      runtime.current.externalDraftIdempotencyKey = null
    }
    patch({
      relationTypeCode: enabled ? relationTypeCode : null,
      mutationError: '',
    })
  }

  function setCandidateScrollOffset(offset: number) {
    if (!runtime.current.submitting) {
      patch({ candidateScrollOffset: Math.max(0, offset) })
    }
  }

  function setExternalReleaseRoute(routeKey: string | null) {
    if (!runtime.current.submitting) {
      if (state.selectedExternalRouteKey !== routeKey) {
        runtime.current.externalDraftIdempotencyKey = null
      }
      patch({ selectedExternalRouteKey: routeKey, mutationError: '' })
    }
  }

  function confirmLocal() {
    return confirmLocalOriginalTrack({
      confirmStackRelation,
      onConfirmed,
      patch,
      relationTypeOptions,
      reset: () => setState(initialState),
      runtime: runtime.current,
      state,
    })
  }
  return {
    state,
    selectedCandidate: findOriginalCandidate(
      state.candidates,
      state.selectedCandidateKey,
    ),
    open,
    retryLocal,
    retryProvider,
    searchDeeper,
    selectCandidate,
    selectReleaseCandidate,
    continueToReview,
    backToCandidates,
    confirmLocal,
    confirmExternal: () =>
      confirmExternalDraft({
        state,
        runtime: runtime.current,
        candidate: findOriginalCandidate(
          state.candidates,
          state.selectedCandidateKey,
        ),
        createDraft: createExternalDraft,
        onCreated: (session) => {
          setState(initialState)
          onExternalDraftCreated(session)
        },
        patch,
      }),
    close,
    setRelationTypeCode,
    setCandidateScrollOffset,
    setExternalReleaseRoute,
  }
}
export type OriginalTrackDiscoveryController = ReturnType<
  typeof useOriginalTrackDiscovery
>

function replaceSearchDiagnostics(
  current: readonly ExternalProviderSearchDiagnosticDto[],
  replacement: readonly ExternalProviderSearchDiagnosticDto[],
  providerCode: string,
) {
  const normalized = providerCode.toLowerCase()
  return [
    ...current.filter(
      (diagnostic) => diagnostic.providerCode.toLowerCase() !== normalized,
    ),
    ...replacement,
  ]
}
