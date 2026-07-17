import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
  type SyntheticEvent,
} from 'react'
import type { TrackStackTargetDto } from '../catalog/api/catalogDtoTypes'
import { CatalogApiError } from '../catalog/api/httpClient'
import type { StackRelationCommand } from '../catalog/api/ownedRelationsClient'
import { searchTrackStackTargets } from '../catalog/api/trackStackTargetsClient'
import { useDebouncedValue } from '../catalog/useDebouncedValue'
import {
  buildStackRelationCommand,
  type StackRelationTypeOption,
} from './trackStackModel'
import type { TrackRecord } from './tracksData'

type PickerStep = 'destination' | 'relation'
type LoadMoreFailure = Readonly<{ offset: number; message: string }>
type MutationRecovery = Readonly<{
  kind:
    | 'destination-invalid'
    | 'relation-invalid'
    | 'retryable'
    | 'source-blocked'
  message: string
}>
type PickerState = Readonly<{
  step: PickerStep
  generation: number
  query: string
  items: TrackStackTargetDto[]
  total: number
  destination: TrackStackTargetDto | null
  selectionGeneration: number
  relationType: StackRelationTypeOption | null
  relationOptionsKey: string
  firstPageError: string
  destinationError: string
  mutationError: string
  sourceBlockedMessage: string
  loadMoreFailure: LoadMoreFailure | null
  loading: 'first' | 'more' | null
  submitting: boolean
}>
type RuntimeState = {
  request: AbortController | null
  generation: number
  appending: boolean
  submitting: boolean
  sourceBlocked: boolean
  sourceInvalidNotified: boolean
  closed: boolean
}

const initialState: PickerState = {
  step: 'destination',
  generation: 0,
  query: '',
  items: [],
  total: 0,
  destination: null,
  selectionGeneration: -1,
  relationType: null,
  relationOptionsKey: '',
  firstPageError: '',
  destinationError: '',
  mutationError: '',
  sourceBlockedMessage: '',
  loadMoreFailure: null,
  loading: null,
  submitting: false,
}
const firstPageReset: Partial<PickerState> = {
  items: [],
  total: 0,
  destination: null,
  selectionGeneration: -1,
  relationType: null,
  destinationError: '',
  mutationError: '',
  loadMoreFailure: null,
}

export type TrackStackPickerAssignedResult = Readonly<{
  destination: TrackStackTargetDto
  relationType: StackRelationTypeOption
}>
export type TrackStackTargetSearch = typeof searchTrackStackTargets
export type TrackStackPickerDialogProps = Readonly<{
  sourceTrack: TrackRecord
  relationTypeOptions: readonly StackRelationTypeOption[]
  returnFocusRef: RefObject<HTMLButtonElement | null>
  searchTargets?: TrackStackTargetSearch
  onSubmit: (command: StackRelationCommand) => Promise<void>
  onAssigned: (result: TrackStackPickerAssignedResult) => void
  onSourceInvalid: () => void
  onClose: () => void
}>

export function useTrackStackPickerDialog({
  sourceTrack,
  relationTypeOptions,
  returnFocusRef,
  searchTargets = searchTrackStackTargets,
  onSubmit,
  onAssigned,
  onSourceInvalid,
  onClose,
}: TrackStackPickerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const queryKeyRef = useRef('')
  const runtime = useRef<RuntimeState>({
    request: null,
    generation: 0,
    appending: false,
    submitting: false,
    sourceBlocked: false,
    sourceInvalidNotified: false,
    closed: false,
  })
  const relationOptionsKey = JSON.stringify(
    relationTypeOptions.map((option) => [option.code, option.label]),
  )
  const [state, setState] = useState(() => ({
    ...initialState,
    relationOptionsKey,
  }))
  const patch = useCallback((changes: Partial<PickerState>) => {
    setState((current) => ({ ...current, ...changes }))
  }, [])
  const queryKey = normalizeQuery(state.query)
  const debouncedQuery = useDebouncedValue(queryKey, 250)
  if (state.relationOptionsKey !== relationOptionsKey) {
    setState((current) => ({
      ...current,
      relationOptionsKey,
      relationType: current.relationType
        ? (relationTypeOptions.find(
            (option) => option.code === current.relationType?.code,
          ) ?? null)
        : null,
    }))
  }

  const finishClose = useCallback(
    (focusTarget: 'trigger' | 'detail') => {
      if (runtime.current.closed) return
      runtime.current.closed = true
      runtime.current.request?.abort()
      const dialog = dialogRef.current
      if (dialog?.open) {
        if (typeof dialog.close === 'function') dialog.close()
        else dialog.removeAttribute('open')
      }
      onClose()
      queueMicrotask(() => {
        const detailTitle = document.querySelector<HTMLElement>(
          '#track-detail-title',
        )
        const focusTargetElement =
          focusTarget === 'detail'
            ? (detailTitle ?? returnFocusRef.current)
            : (returnFocusRef.current ?? detailTitle)
        focusTargetElement?.focus()
      })
    },
    [onClose, returnFocusRef],
  )

  const blockSource = useCallback(
    (message: string) => {
      const current = runtime.current
      current.sourceBlocked = true
      current.generation += 1
      current.request?.abort()
      current.request = null
      current.appending = false
      patch({
        generation: current.generation,
        sourceBlockedMessage: message,
        firstPageError: '',
        loadMoreFailure: null,
        loading: null,
      })
      if (!current.sourceInvalidNotified) {
        current.sourceInvalidNotified = true
        onSourceInvalid()
      }
    },
    [onSourceInvalid, patch],
  )

  const loadPage = useCallback(
    async (offset: number, append: boolean, key = queryKeyRef.current) => {
      const current = runtime.current
      if (key.length < 2 || current.sourceBlocked || current.appending) return
      current.request?.abort()
      const controller = new AbortController()
      const generation = current.generation
      current.request = controller
      current.appending = append
      if (append) patch({ loading: 'more', loadMoreFailure: null })
      else {
        patch({
          ...firstPageReset,
          firstPageError: '',
          loading: 'first',
        })
      }

      try {
        const response = await searchTargets(
          {
            sourceTrackId: sourceTrack.id,
            search: key,
            offset,
            limit: 20,
          },
          { signal: controller.signal },
        )
        if (
          !isCurrentRequest(controller, generation, key, runtime, queryKeyRef)
        )
          return
        setState((latest) => ({
          ...latest,
          items: append ? [...latest.items, ...response.items] : response.items,
          total: response.total,
          loading: null,
        }))
      } catch (error) {
        if (
          isAbortError(error) ||
          !isCurrentRequest(controller, generation, key, runtime, queryKeyRef)
        )
          return
        const blockedMessage = searchSourceErrorMessage(error)
        if (blockedMessage) {
          if (!append) patch({ ...firstPageReset, firstPageError: '' })
          blockSource(blockedMessage)
        } else if (append) {
          patch({
            loadMoreFailure: {
              offset,
              message:
                'Could not load more stacks. Existing results are still available',
            },
            loading: null,
          })
        } else {
          patch({
            items: [],
            total: 0,
            firstPageError: 'Could not search stacks. Try again',
            loading: null,
          })
        }
      } finally {
        if (current.request === controller) {
          current.request = null
          current.appending = false
          patch({ loading: null })
        }
      }
    },
    [blockSource, patch, searchTargets, sourceTrack.id],
  )

  useEffect(() => {
    const current = runtime.current
    const dialog = dialogRef.current
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    }
    return () => current.request?.abort()
  }, [])
  useEffect(() => {
    if (state.step === 'destination' && !runtime.current.closed)
      queueMicrotask(() => searchInputRef.current?.focus())
  }, [state.step])
  useEffect(() => {
    if (
      debouncedQuery.length >= 2 &&
      debouncedQuery === queryKeyRef.current &&
      !runtime.current.sourceBlocked
    )
      loadPage(0, false, debouncedQuery).catch(() => undefined)
  }, [debouncedQuery, loadPage])
  function changeQuery(nextQuery: string) {
    const nextKey = normalizeQuery(nextQuery)
    if (nextKey !== queryKeyRef.current) {
      const current = runtime.current
      current.generation += 1
      current.request?.abort()
      current.request = null
      current.appending = false
      queryKeyRef.current = nextKey
      patch({
        ...firstPageReset,
        step: 'destination',
        generation: current.generation,
        query: nextQuery,
        firstPageError: '',
        loading: null,
      })
    } else patch({ query: nextQuery })
  }

  function selectDestination(destination: TrackStackTargetDto) {
    if (runtime.current.sourceBlocked) return
    patch({
      destination,
      selectionGeneration: runtime.current.generation,
      relationType:
        state.destination?.rootTrackId === destination.rootTrackId
          ? state.relationType
          : null,
      destinationError: '',
      mutationError: '',
    })
  }

  function recoverMutation(error: unknown) {
    const recovery = mutationRecovery(error)
    if (recovery.kind === 'destination-invalid') {
      patch({
        destination: null,
        selectionGeneration: -1,
        relationType: null,
        destinationError: recovery.message,
        mutationError: '',
        step: 'destination',
      })
    } else if (recovery.kind === 'relation-invalid') {
      patch({ relationType: null, mutationError: recovery.message })
    } else if (recovery.kind === 'source-blocked') {
      patch({ mutationError: recovery.message })
      blockSource(recovery.message)
    } else patch({ mutationError: recovery.message })
  }

  async function submitAssignment() {
    const { destination, relationType } = state
    const typeEnabled = relationTypeOptions.some(
      (option) => option.code === relationType?.code,
    )
    if (
      runtime.current.submitting ||
      runtime.current.sourceBlocked ||
      !destination ||
      !relationType ||
      !typeEnabled ||
      state.selectionGeneration !== state.generation
    )
      return
    runtime.current.submitting = true
    patch({ submitting: true, mutationError: '' })
    try {
      await onSubmit(
        buildStackRelationCommand(
          sourceTrack.id,
          destination.rootTrackId,
          relationType.code,
          false,
        ),
      )
    } catch (error) {
      recoverMutation(error)
      return
    } finally {
      runtime.current.submitting = false
      patch({ submitting: false })
    }
    if (runtime.current.sourceBlocked) return
    onAssigned({ destination, relationType })
    finishClose('detail')
  }

  const hasCurrentDestination = Boolean(
    state.destination &&
    state.selectionGeneration === state.generation &&
    state.items.some(
      (item) => item.rootTrackId === state.destination?.rootTrackId,
    ),
  )
  const typeEnabled = relationTypeOptions.some(
    (option) => option.code === state.relationType?.code,
  )
  const blocked = state.sourceBlockedMessage.length > 0

  return {
    state,
    dialogRef,
    searchInputRef,
    blocked,
    hasCurrentDestination,
    typeEnabled,
    status: searchStatus(state, queryKey, debouncedQuery),
    relationError: relationError(state, relationTypeOptions),
    changeQuery,
    selectDestination,
    selectRelationType: (option: StackRelationTypeOption) => {
      patch({ relationType: option, mutationError: '' })
    },
    destinationIsSelected: (item: TrackStackTargetDto) => {
      return (
        state.destination?.rootTrackId === item.rootTrackId &&
        state.selectionGeneration === state.generation
      )
    },
    loadFirstPage: () => {
      return loadPage(0, false)
    },
    loadNextPage: (offset: number) => {
      return loadPage(offset, true)
    },
    continueToRelation: () => {
      patch({ step: 'relation', mutationError: '' })
    },
    backToDestination: () => {
      patch({ step: 'destination', mutationError: '' })
    },
    requestClose: () => {
      if (!runtime.current.submitting) finishClose('trigger')
    },
    handleCancel: (event: SyntheticEvent<HTMLDialogElement>) => {
      event.preventDefault()
      if (!runtime.current.submitting) finishClose('trigger')
    },
    submitAssignment,
  }
}

function normalizeQuery(value: string) {
  return value.trim().toLowerCase()
}
function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
}
function isCurrentRequest(
  controller: AbortController,
  generation: number,
  key: string,
  runtime: RefObject<RuntimeState>,
  queryKey: RefObject<string>,
) {
  return (
    !controller.signal.aborted &&
    runtime.current.generation === generation &&
    queryKey.current === key
  )
}
function searchSourceErrorMessage(error: unknown) {
  if (!(error instanceof CatalogApiError)) return null
  if (error.code === 'track.not_found')
    return 'Source track is no longer available'
  if (error.code === 'track_stack.source_not_standalone')
    return 'Source track is no longer eligible for stack assignment'
  return null
}
function searchStatus(state: PickerState, key: string, debounced: string) {
  if (state.sourceBlockedMessage) return state.sourceBlockedMessage
  if (key.length < 2)
    return 'Enter at least two characters to search existing stacks.'
  if (state.firstPageError) return state.firstPageError
  if (key !== debounced || state.loading === 'first')
    return 'Searching stacks...'
  if (state.items.length === 0) return 'No matching existing stacks.'
  return `${state.items.length} of ${state.total} matching stacks.`
}
function relationError(
  state: PickerState,
  options: readonly StackRelationTypeOption[],
) {
  if (state.sourceBlockedMessage)
    return state.mutationError || state.sourceBlockedMessage
  if (options.length === 0) return 'No stack relation types are enabled'
  return state.mutationError
}

const destinationMissing: MutationRecovery = {
  kind: 'destination-invalid',
  message: 'Destination stack is no longer available. Choose another stack',
}
const destinationChanged: MutationRecovery = {
  kind: 'destination-invalid',
  message: 'Destination is no longer an original stack. Choose another stack',
}
const recoveries: Readonly<Record<string, MutationRecovery>> = {
  'track_relation.track_conflict': destinationMissing,
  'track_relation.stack_target_not_original': destinationChanged,
  'track_relation.stack_target_not_standalone': destinationChanged,
  'track_relation.stack_cycle': {
    kind: 'destination-invalid',
    message: 'This assignment would create a stack cycle. Choose another stack',
  },
  'track_relation.stack_type_invalid': {
    kind: 'relation-invalid',
    message: 'This relation type is no longer enabled. Choose another type',
  },
  'track_relation.type_invalid': {
    kind: 'relation-invalid',
    message: 'This relation type is no longer enabled. Choose another type',
  },
  'track_relation.stack_source_not_standalone': {
    kind: 'source-blocked',
    message: 'Source track is no longer eligible for stack assignment',
  },
  'track_relation.duplicate': {
    kind: 'retryable',
    message:
      'A conflicting stack relation already exists. Review the track and try again',
  },
}
function mutationRecovery(error: unknown): MutationRecovery {
  const code = error instanceof CatalogApiError ? error.code : null
  return code && recoveries[code]
    ? recoveries[code]
    : {
        kind: 'retryable',
        message:
          'Could not save the stack assignment. Check the connection or storage and try again',
      }
}
