import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  LocalOriginalCandidateDto,
  LocalOriginalCandidateListDto,
} from '../catalog/api/catalogDtoTypes'
import { CatalogApiError } from '../catalog/api/httpClient'
import {
  listLocalOriginalCandidates,
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

export type OriginalTrackDiscoveryState = Readonly<{
  isOpen: boolean
  sourceTrackId: string | null
  status: OriginalTrackDiscoveryStatus
  step: OriginalTrackDiscoveryStep
  candidates: LocalOriginalCandidateDto[]
  hasReliableLocalCandidate: boolean
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
  hasReliableLocalCandidate: false,
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

        setState({
          ...initialState,
          isOpen: true,
          sourceTrackId,
          status: loadedStatus(response),
          candidates: response.items,
          hasReliableLocalCandidate: response.hasReliableLocalCandidate,
        })
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
    [loadCandidates],
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
    const typeEnabled = relationTypeOptions.some(
      (option) => option.code === state.relationTypeCode,
    )
    const command = typeEnabled
      ? buildOriginalCandidateStackCommand(
          state.sourceTrackId,
          candidate,
          state.relationTypeCode,
        )
      : null
    if (command === null || candidate === null) {
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
      candidate,
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

function loadedStatus(
  response: LocalOriginalCandidateListDto,
): OriginalTrackDiscoveryStatus {
  return response.items.some(
    (candidate) =>
      candidate.confidence === 'high' || candidate.confidence === 'medium',
  )
    ? 'loaded'
    : 'empty'
}

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

function discoveryFailure(
  error: unknown,
): Pick<
  OriginalTrackDiscoveryState,
  'status' | 'discoveryError' | 'discoveryErrorCode'
> {
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

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : fallback
}
