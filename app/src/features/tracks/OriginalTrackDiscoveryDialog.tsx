import { X } from 'lucide-react'
import { useEffect, useRef, type RefObject, type SyntheticEvent } from 'react'
import type { StackRelationTypeOption } from './trackStackModel'
import type { TrackRecord } from './tracksData'
import { OriginalTrackDiscoveryCandidates } from './OriginalTrackDiscoveryCandidates'
import { OriginalTrackDiscoveryReview } from './OriginalTrackDiscoveryReview'
import type { OriginalTrackDiscoveryController } from './useOriginalTrackDiscovery'
import { localCandidateForReview } from './originalTrackDiscoveryPresentation'

export type { OriginalTrackDiscoveryController } from './useOriginalTrackDiscovery'

export type OriginalTrackDiscoveryDialogProps = Readonly<{
  controller: OriginalTrackDiscoveryController
  relationTypeOptions: readonly StackRelationTypeOption[]
  returnFocusRef: RefObject<HTMLButtonElement | null>
  sourceTrack: TrackRecord
}>

export function OriginalTrackDiscoveryDialog({
  // NOSONAR: the dialog coordinates focus, steps, and external/local submission paths.
  controller,
  relationTypeOptions,
  returnFocusRef,
  sourceTrack,
}: OriginalTrackDiscoveryDialogProps) {
  const { selectedCandidate, state } = controller
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const titleRef = useRef<HTMLHeadingElement | null>(null)
  const candidatePaneRef = useRef<HTMLElement | null>(null)
  const wasOpenRef = useRef(false)
  const previousStepRef = useRef(state.step)
  const previousSourceTrackIdRef = useRef(state.sourceTrackId)
  const relationEnabled = relationTypeOptions.some(
    (option) => option.code === state.relationTypeCode,
  )
  const externalReview =
    state.step === 'review' &&
    selectedCandidate !== null &&
    localCandidateForReview(selectedCandidate) === null
  const externalRouteSelected = Boolean(
    externalReview && state.selectedExternalRouteKey,
  )
  const canContinueToReview = selectedCandidate !== null

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (state.isOpen && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    } else if (!state.isOpen && dialog.open) {
      closeDialog(dialog)
    }
  }, [state.isOpen])

  useEffect(() => {
    if (!state.isOpen) {
      wasOpenRef.current = false
      previousStepRef.current = 'candidates'
      previousSourceTrackIdRef.current = state.sourceTrackId
      return
    }

    const firstOpen = !wasOpenRef.current
    const sourceChanged =
      wasOpenRef.current &&
      previousSourceTrackIdRef.current !== state.sourceTrackId
    const returningToCandidates =
      wasOpenRef.current &&
      previousStepRef.current === 'review' &&
      state.step === 'candidates'
    queueMicrotask(() => {
      if (firstOpen || sourceChanged) {
        titleRef.current?.focus()
      } else if (state.step === 'review') {
        dialogRef.current
          ?.querySelector<HTMLElement>('#original-track-discovery-review-title')
          ?.focus()
      } else if (returningToCandidates) {
        const pane = candidatePaneRef.current
        if (pane) pane.scrollTop = state.candidateScrollOffset
        findSelectedCandidateRadio(dialogRef.current)?.focus()
      }
    })
    wasOpenRef.current = true
    previousStepRef.current = state.step
    previousSourceTrackIdRef.current = state.sourceTrackId
  }, [
    state.candidateScrollOffset,
    state.isOpen,
    state.sourceTrackId,
    state.step,
  ])

  function requestClose() {
    if (!controller.close()) return
    closeDialog(dialogRef.current)
    restoreFocus('trigger', returnFocusRef)
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault()
    requestClose()
  }

  async function submit() {
    const confirmed = await controller.confirmLocal()
    if (!confirmed) return
    closeDialog(dialogRef.current)
    restoreFocus('detail', returnFocusRef)
  }

  return (
    <dialog
      aria-labelledby="original-track-discovery-title"
      aria-modal="true"
      className="original-track-discovery-dialog"
      data-layout="wide"
      data-step={state.step}
      ref={dialogRef}
      onCancel={handleCancel}
    >
      <header className="original-track-discovery-header">
        <div>
          <h2
            aria-label={`Find original for ${sourceTrack.title}`}
            id="original-track-discovery-title"
            ref={titleRef}
            tabIndex={-1}
          >
            Find original track
          </h2>
          <p className="original-track-discovery-source">
            <strong>{sourceTrack.title}</strong>
            <span aria-hidden="true"> · </span>
            <span>{sourceTrack.artist}</span>
          </p>
        </div>
        <button
          aria-label="Close original-track discovery"
          className="original-track-discovery-close"
          disabled={state.submitting}
          type="button"
          onClick={requestClose}
        >
          <X aria-hidden="true" size={19} />
        </button>
      </header>
      <ol
        aria-label="Original-track discovery progress"
        className="original-track-discovery-stepper"
      >
        <li
          aria-current={state.step === 'candidates' ? 'step' : undefined}
          data-active={state.step === 'candidates'}
        >
          <span aria-hidden="true">1</span> Select original
        </li>
        <li
          aria-current={state.step === 'review' ? 'step' : undefined}
          data-active={state.step === 'review'}
        >
          <span aria-hidden="true">2</span> Review action
        </li>
      </ol>
      <div className="original-track-discovery-layout">
        <div
          aria-atomic="true"
          aria-live="polite"
          className="original-track-discovery-live-status"
          data-visible={
            state.status === 'retryable-error' || Boolean(state.mutationError)
          }
          role="status"
        >
          <span>{statusMessage(controller, relationTypeOptions)}</span>
          {state.status === 'retryable-error' ? (
            <button
              className="button button-secondary"
              type="button"
              onClick={() => {
                void controller.retryLocal()
              }}
            >
              Retry local search
            </button>
          ) : null}
        </div>
        <main
          aria-busy={
            state.status === 'loading' ||
            state.externalStatus === 'loading' ||
            state.deepSearchStatus === 'loading' ||
            state.submitting
          }
          className="original-track-discovery-main"
        >
          {state.step === 'candidates' ? (
            <OriginalTrackDiscoveryCandidates
              candidatePaneRef={candidatePaneRef}
              controller={controller}
            />
          ) : (
            <OriginalTrackDiscoveryReview
              controller={controller}
              relationTypeOptions={relationTypeOptions}
              sourceTrack={sourceTrack}
            />
          )}
        </main>
      </div>
      <footer className="original-track-discovery-footer">
        {state.step === 'review' ? (
          <button
            className="button button-secondary"
            disabled={state.submitting}
            type="button"
            onClick={controller.backToCandidates}
          >
            Back
          </button>
        ) : null}
        <button
          className="button button-secondary"
          disabled={state.submitting}
          type="button"
          onClick={requestClose}
        >
          {externalReview ? 'Close' : 'Cancel'}
        </button>
        {state.step === 'candidates' ? (
          <button
            className="button button-primary"
            disabled={!canContinueToReview || state.submitting}
            type="button"
            onClick={controller.continueToReview}
          >
            Continue to review
          </button>
        ) : externalReview ? ( // NOSONAR: footer action branches map directly to the two workflow steps.
          <button
            className="button button-primary"
            disabled={!externalRouteSelected || state.submitting}
            type="button"
            onClick={() => {
              void controller.confirmExternal()
            }}
          >
            {state.submitting
              ? 'Creating release draft...'
              : 'Create release draft'}
          </button>
        ) : (
          <button
            className="button button-primary"
            disabled={!relationEnabled || state.submitting}
            type="button"
            onClick={() => {
              void submit()
            }}
          >
            {localConfirmationLabel(
              state.submitting,
              selectedCandidate?.confidence,
            )}
          </button>
        )}
      </footer>
    </dialog>
  )
}

function statusMessage( // NOSONAR: status copy covers the workflow's provider and relation states.
  controller: OriginalTrackDiscoveryController,
  relationTypeOptions: readonly StackRelationTypeOption[],
) {
  const { state } = controller
  if (state.submitting) return 'Confirming the local relationship'
  if (state.mutationError) return state.mutationError
  if (state.step === 'review') {
    if (
      controller.selectedCandidate !== null &&
      localCandidateForReview(controller.selectedCandidate) === null
    ) {
      return state.selectedExternalRouteKey
        ? 'Selected release is ready for import review'
        : 'Choose a release to continue'
    }
    if (relationTypeOptions.length === 0) {
      return 'No enabled relation types are available. Enable one in Settings before confirming.'
    }
    if (
      !relationTypeOptions.some(
        (option) => option.code === state.relationTypeCode,
      )
    ) {
      return 'Choose an enabled relation type before confirming'
    }
    return 'Review the local relationship before confirming'
  }

  if (state.externalStatus === 'loading') return 'Searching release catalogues'
  if (state.deepSearchStatus === 'loading') {
    return 'Searching recording relationships and shared works'
  }
  if (state.externalError && state.candidates.length === 0) {
    return 'Some sources could not be checked'
  }

  switch (state.status) {
    case 'idle':
      return 'Preparing local discovery'
    case 'loading':
      return 'Searching the local collection for candidates'
    case 'loaded': {
      return `${state.candidates.length} ${
        state.candidates.length === 1 ? 'candidate' : 'candidates'
      } found`
    }
    case 'empty':
      return 'Local search completed with diagnostic candidates only'
    case 'source-not-found':
      return state.discoveryError || 'The source track is no longer available'
    case 'source-not-eligible':
      return (
        state.discoveryError ||
        'The source track is no longer eligible for discovery'
      )
    case 'retryable-error':
      return state.discoveryError || 'Could not search the local collection'
  }
}

function localConfirmationLabel(
  submitting: boolean,
  confidence: string | undefined,
) {
  if (submitting) {
    return 'Confirming...'
  }

  return confidence === 'low'
    ? 'Confirm low-confidence relationship'
    : 'Confirm local relationship'
}

function findSelectedCandidateRadio(dialog: HTMLDialogElement | null) {
  return Array.from(
    dialog?.querySelectorAll<HTMLInputElement>(
      'input[name="original-track-candidate"]',
    ) ?? [],
  ).find((radio) => radio.checked)
}

function closeDialog(dialog: HTMLDialogElement | null) {
  if (!dialog?.open) return
  if (typeof dialog.close === 'function') dialog.close()
  else dialog.removeAttribute('open')
}

function restoreFocus(
  preference: 'trigger' | 'detail',
  returnFocusRef: RefObject<HTMLButtonElement | null>,
) {
  const trigger = returnFocusRef.current
  queueMicrotask(() => {
    const detailTitle = document.querySelector<HTMLElement>(
      '#track-detail-title',
    )
    const connectedTrigger = trigger?.isConnected ? trigger : null
    const target =
      preference === 'detail'
        ? (detailTitle ?? connectedTrigger)
        : (connectedTrigger ?? detailTitle)
    target?.focus()
  })
}
