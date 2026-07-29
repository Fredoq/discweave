import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ExternalOriginalCandidateDto,
  ExternalOriginalCandidateListDto,
  ExternalProviderOperationStatusDto,
  LocalOriginalCandidateDto,
  LocalOriginalCandidateListDto,
} from '../catalog/api/catalogDtoTypes'
import { CatalogApiError } from '../catalog/api/httpClient'
import {
  findExternalOriginalCandidates,
  listLocalOriginalCandidates,
  type FindExternalOriginalCandidatesOptions,
  type ListLocalOriginalCandidatesOptions,
} from '../catalog/api/originalTrackDiscoveryClient'
import {
  createStackRelation,
  type StackRelationCommand,
} from '../catalog/api/ownedRelationsClient'
import {
  buildOriginalCandidateStackCommand,
  findOriginalCandidate,
  initialOriginalCandidateRelationType,
} from './originalTrackDiscoveryModel'
import {
  localCandidateForReview,
  presentOriginalCandidates,
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
  hasReliableLocalCandidate: boolean
  externalStatus: ExternalDiscoveryStatus
  providerStatuses: ExternalProviderOperationStatusDto[]
  externalWarnings: string[]
  externalError: string
  selectedCandidateKey: string | null
  relationTypeCode: string | null
  expandedEvidenceKeys: string[]
  candidateScrollOffset: number
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
}>

type RuntimeState = {
  request: AbortController | null
  generation: number
  submitting: boolean
  disposed: boolean
}

const initialState: OriginalTrackDiscoveryState = {
  isOpen: false,
  sourceTrackId: null,
  status: 'idle',
  step: 'candidates',
  candidates: [],
  localCandidates: [],
  externalCandidates: [],
  hasReliableLocalCandidate: false,
  externalStatus: 'idle',
  providerStatuses: [],
  externalWarnings: [],
  externalError: '',
  selectedCandidateKey: null,
  relationTypeCode: null,
  expandedEvidenceKeys: [],
  candidateScrollOffset: 0,
  discoveryError: '',
  discoveryErrorCode: null,
  mutationError: '',
  submitting: false,
}

const ignoreConfirmed = () => undefined

export function useOriginalTrackDiscovery({
  relationTypeOptions,
  loadCandidates = listLocalOriginalCandidates,
  loadExternalCandidates = findExternalOriginalCandidates,
  confirmStackRelation = createStackRelation,
  onConfirmed = ignoreConfirmed,
}: UseOriginalTrackDiscoveryOptions) {
  const runtime = useRef<RuntimeState>({
    request: null,
    generation: 0,
    submitting: false,
    disposed: false,
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
            hasReliableLocalCandidate: local.hasReliableLocalCandidate,
            externalStatus: 'loaded',
            providerStatuses: external.providerStatuses,
            externalWarnings: external.warnings,
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

  function selectCandidate(candidateKey: string): boolean {
    if (runtime.current.submitting) {
      return false
    }

    const candidate = findOriginalCandidate(state.candidates, candidateKey)
    if (!candidate?.selectable) {
      return false
    }

    const relationType = initialOriginalCandidateRelationType(
      candidate,
      relationTypeOptions,
    )
    patch({
      selectedCandidateKey: candidate.candidateKey,
      relationTypeCode: relationType?.code ?? null,
      mutationError: '',
    })
    return true
  }

  function continueToReview(): boolean {
    const candidate = findOriginalCandidate(
      state.candidates,
      state.selectedCandidateKey,
    )
    if (runtime.current.submitting || !candidate?.selectable) {
      return false
    }

    patch({ step: 'review', mutationError: '' })
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
    patch({
      relationTypeCode: enabled ? relationTypeCode : null,
      mutationError: '',
    })
  }

  function setExpandedEvidenceKeys(keys: string[]) {
    if (!runtime.current.submitting) {
      patch({ expandedEvidenceKeys: [...new Set(keys)] })
    }
  }

  function setCandidateScrollOffset(offset: number) {
    if (!runtime.current.submitting) {
      patch({ candidateScrollOffset: Math.max(0, offset) })
    }
  }

  async function confirmLocal(): Promise<boolean> {
    const current = runtime.current
    if (
      current.submitting ||
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
        )
      : null
    if (command === null || localCandidate === null) {
      return false
    }

    const confirmationGeneration = current.generation
    current.submitting = true
    patch({ submitting: true, mutationError: '' })
    try {
      await confirmStackRelation(command)
    } catch (error) {
      current.submitting = false
      if (!isCurrentConfirmation(current, confirmationGeneration)) {
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

    current.submitting = false
    if (!isCurrentConfirmation(current, confirmationGeneration)) {
      return false
    }
    onConfirmed({
      candidate: localCandidate,
      relationTypeCode: command.relationTypeCode,
    })
    setState(initialState)
    return true
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
    selectCandidate,
    continueToReview,
    backToCandidates,
    confirmLocal,
    close,
    setRelationTypeCode,
    setExpandedEvidenceKeys,
    setCandidateScrollOffset,
  }
}

export type OriginalTrackDiscoveryController = ReturnType<
  typeof useOriginalTrackDiscovery
>

function isCurrentRequest(
  controller: AbortController,
  generation: number,
  runtime: RuntimeState,
) {
  return (
    !controller.signal.aborted &&
    !runtime.disposed &&
    runtime.request === controller &&
    runtime.generation === generation
  )
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
}

function isCurrentConfirmation(runtime: RuntimeState, generation: number) {
  return !runtime.disposed && runtime.generation === generation
}
