import { ArrowRight } from 'lucide-react'
import { type KeyboardEvent, type ReactElement } from 'react'
import type { TrackStackTargetDto } from '../catalog/api/catalogDtoTypes'
import { trackArtistDisplay } from './trackDisplayHelpers'
import type { TrackRecord } from './tracksData'
import {
  useTrackStackPickerDialog,
  type TrackStackPickerDialogProps,
} from './useTrackStackPickerDialog'

export type {
  TrackStackPickerAssignedResult,
  TrackStackPickerDialogProps,
  TrackStackTargetSearch,
} from './useTrackStackPickerDialog'

export function TrackStackPickerDialog(
  props: TrackStackPickerDialogProps,
): ReactElement {
  const {
    state,
    dialogRef,
    searchInputRef,
    blocked,
    hasCurrentDestination,
    typeEnabled,
    status,
    relationError,
    changeQuery,
    selectDestination,
    selectRelationType,
    destinationIsSelected,
    loadFirstPage,
    loadNextPage,
    continueToRelation,
    backToDestination,
    requestClose,
    handleCancel,
    submitAssignment,
  } = useTrackStackPickerDialog(props)
  let stepContent: ReactElement | null = null
  if (state.step === 'destination') {
    stepContent = (
      <DestinationStep
        blocked={blocked}
        changeQuery={changeQuery}
        continueToRelation={continueToRelation}
        destinationIsSelected={destinationIsSelected}
        hasCurrentDestination={hasCurrentDestination}
        loadFirstPage={loadFirstPage}
        loadNextPage={loadNextPage}
        requestClose={requestClose}
        searchInputRef={searchInputRef}
        selectDestination={selectDestination}
        sourceTrack={props.sourceTrack}
        state={state}
        status={status}
      />
    )
  } else if (state.destination) {
    stepContent = (
      <RelationStep
        backToDestination={backToDestination}
        blocked={blocked}
        destination={state.destination}
        hasCurrentDestination={hasCurrentDestination}
        relationError={relationError}
        relationTypeOptions={props.relationTypeOptions}
        requestClose={requestClose}
        selectRelationType={selectRelationType}
        sourceTrack={props.sourceTrack}
        state={state}
        submitAssignment={submitAssignment}
        typeEnabled={typeEnabled}
      />
    )
  }

  return (
    <dialog
      aria-labelledby="track-stack-picker-title"
      aria-modal="true"
      className="track-stack-picker-dialog"
      ref={dialogRef}
      onCancel={handleCancel}
    >
      {stepContent}
    </dialog>
  )
}

type PickerController = ReturnType<typeof useTrackStackPickerDialog>
type PickerState = PickerController['state']
type DestinationStepProps = Readonly<
  {
    sourceTrack: TrackRecord
    state: PickerState
  } & Pick<
    PickerController,
    | 'blocked'
    | 'changeQuery'
    | 'continueToRelation'
    | 'destinationIsSelected'
    | 'hasCurrentDestination'
    | 'loadFirstPage'
    | 'loadNextPage'
    | 'requestClose'
    | 'searchInputRef'
    | 'selectDestination'
    | 'status'
  >
>

function DestinationStep({
  blocked,
  changeQuery,
  continueToRelation,
  destinationIsSelected,
  hasCurrentDestination,
  loadFirstPage,
  loadNextPage,
  requestClose,
  searchInputRef,
  selectDestination,
  sourceTrack,
  state,
  status,
}: DestinationStepProps) {
  return (
    <>
      <DialogHeader step="Step 1 of 2" title="Choose destination stack">
        <button
          aria-label="Close stack picker"
          className="icon-button"
          type="button"
          onClick={requestClose}
        >
          Close
        </button>
      </DialogHeader>
      <section aria-label="Source track" className="track-stack-picker-source">
        <strong>{sourceTrack.title}</strong>
        <span>{trackArtistDisplay(sourceTrack)}</span>
      </section>
      <label className="track-stack-picker-search">
        <span>Search stacks</span>
        <input
          disabled={blocked}
          ref={searchInputRef}
          type="search"
          value={state.query}
          onChange={(event) => changeQuery(event.currentTarget.value)}
        />
      </label>
      <p
        aria-live="polite"
        className={
          state.firstPageError || blocked
            ? 'track-stack-picker-error'
            : 'track-stack-picker-state'
        }
        role="status"
      >
        {status}
      </p>
      {state.destinationError ? (
        <p
          aria-live="polite"
          className="track-stack-picker-error"
          role="status"
        >
          {state.destinationError}
        </p>
      ) : null}
      {state.firstPageError && !blocked ? (
        <button
          aria-label="Retry stack search"
          className="button button-secondary"
          disabled={state.loading === 'first'}
          type="button"
          onClick={() => startAsyncAction(loadFirstPage)}
        >
          Retry stack search
        </button>
      ) : null}
      {state.items.length > 0 ? (
        <fieldset className="track-stack-picker-results">
          <legend className="visually-hidden">Destination stack</legend>
          {state.items.map((item) => (
            <DestinationOption
              blocked={blocked}
              checked={destinationIsSelected(item)}
              item={item}
              key={item.rootTrackId}
              select={() => selectDestination(item)}
            />
          ))}
        </fieldset>
      ) : null}
      <PaginationControls
        blocked={blocked}
        loadNextPage={loadNextPage}
        state={state}
      />
      <footer className="track-stack-picker-footer">
        <button
          className="button button-secondary"
          type="button"
          onClick={requestClose}
        >
          Cancel
        </button>
        <button
          className="button button-primary"
          disabled={!hasCurrentDestination || blocked}
          type="button"
          onClick={continueToRelation}
        >
          Continue
        </button>
      </footer>
    </>
  )
}

function PaginationControls({
  blocked,
  loadNextPage,
  state,
}: Readonly<{
  blocked: boolean
  loadNextPage: PickerController['loadNextPage']
  state: PickerState
}>) {
  const loadMoreFailure = state.loadMoreFailure
  if (state.loading === 'more') {
    return (
      <p aria-live="polite" className="track-stack-picker-state" role="status">
        Loading more stacks...
      </p>
    )
  }
  if (loadMoreFailure) {
    return (
      <div>
        <p
          aria-live="polite"
          className="track-stack-picker-error"
          role="status"
        >
          {loadMoreFailure.message}
        </p>
        <button
          aria-label="Retry loading more stacks"
          className="button button-secondary"
          type="button"
          onClick={() =>
            startAsyncAction(() => loadNextPage(loadMoreFailure.offset))
          }
        >
          Retry loading more stacks
        </button>
      </div>
    )
  }
  if (state.items.length >= state.total) return null
  return (
    <button
      className="button button-secondary"
      disabled={blocked}
      type="button"
      onClick={() => startAsyncAction(() => loadNextPage(state.items.length))}
    >
      Load more
    </button>
  )
}

function RelationStep({
  backToDestination,
  blocked,
  destination,
  hasCurrentDestination,
  relationError,
  relationTypeOptions,
  requestClose,
  selectRelationType,
  sourceTrack,
  state,
  submitAssignment,
  typeEnabled,
}: Readonly<{
  backToDestination: PickerController['backToDestination']
  blocked: boolean
  destination: TrackStackTargetDto
  hasCurrentDestination: boolean
  relationError: string
  relationTypeOptions: TrackStackPickerDialogProps['relationTypeOptions']
  requestClose: PickerController['requestClose']
  selectRelationType: PickerController['selectRelationType']
  sourceTrack: TrackRecord
  state: PickerState
  submitAssignment: PickerController['submitAssignment']
  typeEnabled: boolean
}>) {
  return (
    <>
      <DialogHeader step="Step 2 of 2" title="Choose relation type">
        <button
          aria-label="Close stack picker"
          className="icon-button"
          disabled={state.submitting}
          type="button"
          onClick={requestClose}
        >
          Close
        </button>
      </DialogHeader>
      <AssignmentRoute destination={destination} sourceTrack={sourceTrack} />
      <fieldset className="track-stack-picker-relation-options">
        <legend>Relation type</legend>
        {relationTypeOptions.map((option) => (
          <label key={option.code}>
            <input
              checked={state.relationType?.code === option.code}
              disabled={state.submitting || blocked}
              name="stack-relation-type"
              type="radio"
              value={option.code}
              onChange={() => selectRelationType(option)}
              onKeyDown={(event) =>
                selectRadioOnEnter(event, () => selectRelationType(option))
              }
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
      {relationError ? (
        <p
          aria-live="polite"
          className="track-stack-picker-error"
          role="status"
        >
          {relationError}
        </p>
      ) : null}
      <footer className="track-stack-picker-footer">
        <button
          className="button button-secondary"
          disabled={state.submitting}
          type="button"
          onClick={backToDestination}
        >
          Back
        </button>
        <button
          className="button button-secondary"
          disabled={state.submitting}
          type="button"
          onClick={requestClose}
        >
          Cancel
        </button>
        <button
          aria-live="polite"
          className="button button-primary"
          disabled={
            !hasCurrentDestination ||
            !typeEnabled ||
            state.submitting ||
            blocked
          }
          type="button"
          onClick={() => startAsyncAction(submitAssignment)}
        >
          {state.submitting ? 'Adding...' : 'Add to stack'}
        </button>
      </footer>
    </>
  )
}

function startAsyncAction(action: () => Promise<unknown>) {
  action().catch(() => undefined)
}

function DialogHeader({
  step,
  title,
  children,
}: Readonly<{ step: string; title: string; children: ReactElement }>) {
  return (
    <header className="track-stack-picker-header">
      <div>
        <span className="track-stack-picker-kicker">{step}</span>
        <h2 id="track-stack-picker-title">{title}</h2>
      </div>
      {children}
    </header>
  )
}

function DestinationOption({
  blocked,
  checked,
  item,
  select,
}: Readonly<{
  blocked: boolean
  checked: boolean
  item: TrackStackTargetDto
  select: () => void
}>) {
  return (
    <label className="track-stack-picker-result">
      <input
        checked={checked}
        disabled={blocked}
        name="stack-destination"
        type="radio"
        value={item.rootTrackId}
        onChange={select}
        onKeyDown={(event) => selectRadioOnEnter(event, select)}
      />
      <span>
        <strong>{item.title}</strong>
        <span>{item.artistDisplay}</span>
        <span className="track-stack-picker-result-meta">
          {item.versionYear == null ? null : <span>{item.versionYear}</span>}
          <span>
            {item.memberCount} {item.memberCount === 1 ? 'member' : 'members'}
          </span>
        </span>
        {item.matchedMember ? (
          <span className="track-stack-picker-match">
            Matched member: {item.matchedMember.title}
          </span>
        ) : null}
      </span>
    </label>
  )
}

function AssignmentRoute({
  destination,
  sourceTrack,
}: Readonly<{
  destination: TrackStackTargetDto
  sourceTrack: TrackRecord
}>) {
  return (
    <section
      aria-label="Stack assignment route"
      className="track-stack-picker-route"
    >
      <section aria-label="Source track">
        <span>Source track</span>
        <strong>{sourceTrack.title}</strong>
        <span>{trackArtistDisplay(sourceTrack)}</span>
      </section>
      <ArrowRight aria-hidden="true" size={18} />
      <section aria-label="Destination stack">
        <span>Destination stack</span>
        <strong>{destination.title}</strong>
        <span>{destination.artistDisplay}</span>
        <span>
          {destination.versionYear == null
            ? null
            : `${destination.versionYear} · `}
          {destination.memberCount}{' '}
          {destination.memberCount === 1 ? 'member' : 'members'}
        </span>
      </section>
    </section>
  )
}

function selectRadioOnEnter(
  event: KeyboardEvent<HTMLInputElement>,
  select: () => void,
) {
  if (event.key === 'Enter' && !event.currentTarget.disabled) {
    event.preventDefault()
    select()
  }
}
