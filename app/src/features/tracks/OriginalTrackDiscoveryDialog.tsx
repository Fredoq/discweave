import { X } from 'lucide-react'
import { useEffect, useRef, type RefObject, type SyntheticEvent } from 'react'
import type { StackRelationTypeOption } from './trackStackModel'
import type { TrackRecord } from './tracksData'
import { OriginalTrackDiscoveryCandidates } from './OriginalTrackDiscoveryCandidates'
import { OriginalTrackDiscoveryReview } from './OriginalTrackDiscoveryReview'
import type { OriginalTrackDiscoveryController } from './useOriginalTrackDiscovery'
import { isLocalDiscoveryCandidate } from './originalTrackDiscoveryPresentation'

export type { OriginalTrackDiscoveryController } from './useOriginalTrackDiscovery'

export type OriginalTrackDiscoveryDialogProps = Readonly<{
  controller: OriginalTrackDiscoveryController
  relationTypeOptions: readonly StackRelationTypeOption[]
  returnFocusRef: RefObject<HTMLButtonElement | null>
  sourceTrack: TrackRecord
}>

export function OriginalTrackDiscoveryDialog({
  controller,
  relationTypeOptions,
  returnFocusRef,
  sourceTrack,
}: OriginalTrackDiscoveryDialogProps) {
  const { selectedCandidate, state } = controller
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const titleRef = useRef<HTMLHeadingElement | null>(null)
  const candidatePaneRef = useRef<HTMLDivElement | null>(null)
  const wasOpenRef = useRef(false)
  const previousStepRef = useRef(state.step)
  const previousSourceTrackIdRef = useRef(state.sourceTrackId)
  const relationEnabled = relationTypeOptions.some(
    (option) => option.code === state.relationTypeCode,
  )
  const externalReview =
    state.step === 'review' &&
    selectedCandidate !== null &&
    !isLocalDiscoveryCandidate(selectedCandidate)

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
          <span className="original-track-discovery-kicker">
            Discovery workflow
          </span>
          <h2 id="original-track-discovery-title" ref={titleRef} tabIndex={-1}>
            Find original for {sourceTrack.title}
          </h2>
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
          <span aria-hidden="true">1</span>
          Select original
        </li>
        <li
          aria-current={state.step === 'review' ? 'step' : undefined}
          data-active={state.step === 'review'}
        >
          <span aria-hidden="true">2</span>
          Review action
        </li>
      </ol>
      <div className="original-track-discovery-layout">
        <aside className="original-track-discovery-context">
          <section aria-label="Source track">
            <span>Source track</span>
            <strong>{sourceTrack.title}</strong>
            <span>{sourceTrack.artist}</span>
          </section>
          <div
            aria-atomic="true"
            aria-live="polite"
            className="original-track-discovery-status"
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
            {retryableProviderCodes(controller).map((providerCode) => (
              <button
                className="button button-secondary"
                key={providerCode}
                type="button"
                onClick={() => {
                  void controller.retryProvider(providerCode)
                }}
              >
                Retry {providerLabel(providerCode)}
              </button>
            ))}
          </div>
        </aside>
        <main
          aria-busy={
            state.status === 'loading' ||
            state.externalStatus === 'loading' ||
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
            disabled={!selectedCandidate?.selectable || state.submitting}
            type="button"
            onClick={controller.continueToReview}
          >
            Continue to review
          </button>
        ) : externalReview ? null : (
          <button
            className="button button-primary"
            disabled={!relationEnabled || state.submitting}
            type="button"
            onClick={() => {
              void submit()
            }}
          >
            {state.submitting ? 'Confirming...' : 'Confirm local relationship'}
          </button>
        )}
      </footer>
    </dialog>
  )
}

function statusMessage(
  controller: OriginalTrackDiscoveryController,
  relationTypeOptions: readonly StackRelationTypeOption[],
) {
  const { state } = controller
  if (state.submitting) return 'Confirming the local relationship'
  if (state.mutationError) return state.mutationError
  if (state.step === 'review') {
    if (
      controller.selectedCandidate !== null &&
      !isLocalDiscoveryCandidate(controller.selectedCandidate)
    ) {
      return 'Review external evidence and release routes'
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

  if (state.externalStatus === 'loading') {
    return 'Searching MusicBrainz for original recordings'
  }
  const failedProviders = state.providerStatuses.filter(
    (provider) =>
      provider.outcome !== 'succeeded' && provider.outcome !== 'notFound',
  )
  if (failedProviders.length > 0) {
    const warnings =
      state.externalWarnings.length === 0
        ? ''
        : ` · ${state.externalWarnings.join(', ')}`
    return `${failedProviders.map((status) => providerLabel(status.providerCode)).join(', ')} returned partial results${warnings}`
  }
  if (state.externalError) return state.externalError

  switch (state.status) {
    case 'idle':
      return 'Preparing local discovery'
    case 'loading':
      return 'Searching the local collection for candidates'
    case 'loaded': {
      const scope = state.externalCandidates.length === 0 ? ' local' : ''
      return `${state.candidates.length}${scope} ${
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

function retryableProviderCodes(controller: OriginalTrackDiscoveryController) {
  const retryable = new Set([
    'rateLimited',
    'timeout',
    'unavailable',
    'invalidResponse',
  ])
  const codes = controller.state.providerStatuses
    .filter((status) => retryable.has(status.outcome))
    .map((status) => status.providerCode)
  if (controller.state.externalStatus === 'failed' && codes.length === 0) {
    codes.push('musicbrainz')
  }
  return [...new Set(codes)]
}

function providerLabel(providerCode: string) {
  switch (providerCode.toLowerCase()) {
    case 'musicbrainz':
      return 'MusicBrainz'
    case 'discogs':
      return 'Discogs'
    default:
      return providerCode
  }
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
