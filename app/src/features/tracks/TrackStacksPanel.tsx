import { ArrowRight, ChevronDown, ChevronRight } from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
  type SyntheticEvent,
} from 'react'
import type {
  CatalogDictionaries,
  RatingCriterion,
  TrackStackDto,
} from '../catalog/catalogApi'
import type { RelationRecord } from '../relations/relationsData'
import {
  openableFilesFromStackTracks,
  openableFilesFromTrack,
} from '../localFiles/localFileOpenModel'
import { trackArtistDisplay, trackReleaseDisplay } from './trackDisplayHelpers'
import { TrackStackFacts } from './TrackStackFacts'
import { TrackStackMemberGroups } from './TrackStackMemberGroups'
import type { TrackRecord } from './tracksData'
import {
  buildTrackStackRows,
  canDragStackTrack,
  canDropOnStack,
  existingStackRelationTypeCode,
  hasStackPath,
  stackRelationTypeOptions,
  trackStackMemberGroups,
  trackStackRootClassName,
  type TrackStackRow,
} from './trackStackModel'

type TrackStacksPanelProps = Readonly<{
  dictionaries: CatalogDictionaries
  expandedStackIds: Set<string>
  ratingCriteria: RatingCriterion[]
  relations: RelationRecord[]
  serverStacks?: TrackStackDto[] | null
  stackRelationTypeCodes: string[]
  tracks: TrackRecord[]
  visibleTracks: TrackRecord[]
  selectedTrackId: string
  onCreateStackRelation: (mutation: StackRelationMutation) => Promise<void>
  onOpenStackLocalFiles?: (stackTitle: string, tracks: TrackRecord[]) => void
  onOpenTrackLocalFiles?: (track: TrackRecord) => void
  onSelectTrack: (trackId: string) => void
  onToggleStack: (stackId: string) => void
}>

type StackDropDraft = {
  sourceTrack: TrackRecord
  targetRootTrack: TrackRecord
  targetWasStandalone: boolean
}

export type StackRelationMutation = {
  sourceTrack: TrackRecord
  targetRootTrack: TrackRecord
  relationTypeCode: string
  targetWasStandalone: boolean
}

export function TrackStacksPanel({
  dictionaries,
  expandedStackIds,
  ratingCriteria,
  relations,
  serverStacks,
  stackRelationTypeCodes,
  tracks,
  visibleTracks,
  selectedTrackId,
  onCreateStackRelation,
  onOpenStackLocalFiles,
  onOpenTrackLocalFiles,
  onSelectTrack,
  onToggleStack,
}: TrackStacksPanelProps) {
  const stackRows = useMemo(
    () =>
      buildTrackStackRows({
        dictionaries,
        relations,
        serverStacks,
        stackRelationTypeCodes,
        tracks,
      }),
    [dictionaries, relations, serverStacks, stackRelationTypeCodes, tracks],
  )
  const visibleTrackIds = useMemo(
    () => new Set(visibleTracks.map((track) => track.id)),
    [visibleTracks],
  )
  const stacks = useMemo(
    () =>
      stackRows.filter(
        (stack) =>
          visibleTrackIds.has(stack.original.id) ||
          stack.members.some((member) => visibleTrackIds.has(member.track.id)),
      ),
    [stackRows, visibleTrackIds],
  )
  const [dragSourceTrackId, setDragSourceTrackId] = useState('')
  const [dropDraft, setDropDraft] = useState<StackDropDraft | null>(null)
  const [dropError, setDropError] = useState('')
  const [highlightTrackId, setHighlightTrackId] = useState('')
  const [isSubmittingStackRelation, setIsSubmittingStackRelation] =
    useState(false)
  const isSubmittingStackRelationRef = useRef(false)
  const dropChooserRef = useRef<HTMLDialogElement | null>(null)
  const firstDropChoiceRef = useRef<HTMLButtonElement | null>(null)
  const relationTypeOptions = useMemo(
    () => stackRelationTypeOptions(stackRelationTypeCodes, dictionaries),
    [dictionaries, stackRelationTypeCodes],
  )
  const dragSourceTrack = dragSourceTrackId
    ? (tracks.find((track) => track.id === dragSourceTrackId) ?? null)
    : null

  useEffect(() => {
    if (!dropDraft) {
      return
    }

    const dialog = dropChooserRef.current
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === 'function') {
        dialog.showModal()
      } else {
        dialog.setAttribute('open', '')
      }
    }

    dropChooserRef.current?.scrollIntoView?.({
      block: 'nearest',
      inline: 'nearest',
    })
    firstDropChoiceRef.current?.focus()
  }, [dropDraft])

  function startTrackDrag(
    track: TrackRecord,
    stack: TrackStackRow,
    event: DragEvent,
  ) {
    if (!canDragStackTrack(track, stack, stackRows)) {
      event.preventDefault()
      setDragSourceTrackId('')
      return
    }

    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', track.id)
    setDragSourceTrackId(track.id)
    setDropDraft(null)
    setDropError('')
  }

  function cancelTrackDrag() {
    setDragSourceTrackId('')
  }

  function dragOverStack(event: DragEvent, stack: TrackStackRow) {
    const eventSourceTrackId = event.dataTransfer.getData('text/plain')
    const sourceTrack =
      dragSourceTrack ??
      tracks.find((track) => track.id === eventSourceTrackId) ??
      null

    if (!sourceTrack || !canDropOnStack(sourceTrack, stack)) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  function dropOnStack(event: DragEvent, stack: TrackStackRow) {
    event.preventDefault()
    const eventSourceTrackId = event.dataTransfer.getData('text/plain')
    const sourceTrack =
      dragSourceTrack ??
      tracks.find((track) => track.id === eventSourceTrackId) ??
      null

    if (!sourceTrack || !canDropOnStack(sourceTrack, stack)) {
      cancelTrackDrag()
      return
    }

    if (
      hasStackPath(
        stack.original.id,
        sourceTrack.id,
        relations,
        stackRelationTypeCodes,
        dictionaries,
      )
    ) {
      setDropError('This relation would create a stack cycle.')
      cancelTrackDrag()
      return
    }

    const draft = {
      sourceTrack,
      targetRootTrack: stack.original,
      targetWasStandalone: stack.members.length === 0,
    }
    const existingRelationTypeCode = existingStackRelationTypeCode(
      sourceTrack.id,
      stack.original.id,
      relations,
      stackRelationTypeCodes,
      dictionaries,
    )

    if (existingRelationTypeCode) {
      setDropDraft(null)
      cancelTrackDrag()
      void submitStackRelation(draft, existingRelationTypeCode)
      return
    }

    setDropDraft(draft)
    cancelTrackDrag()
  }

  async function chooseStackRelation(relationTypeCode: string) {
    if (!dropDraft) {
      return
    }

    await submitStackRelation(dropDraft, relationTypeCode)
  }

  async function submitStackRelation(
    draft: StackDropDraft,
    relationTypeCode: string,
  ) {
    if (isSubmittingStackRelationRef.current) {
      return
    }
    isSubmittingStackRelationRef.current = true
    setIsSubmittingStackRelation(true)
    setDropError('')
    try {
      await onCreateStackRelation({
        sourceTrack: draft.sourceTrack,
        targetRootTrack: draft.targetRootTrack,
        relationTypeCode,
        targetWasStandalone: draft.targetWasStandalone,
      })
      setHighlightTrackId(draft.sourceTrack.id)
      globalThis.setTimeout(() => setHighlightTrackId(''), 1200)
      setDropDraft(null)
    } catch (error) {
      setDropError(
        error instanceof Error
          ? error.message
          : 'Could not create the stack relation.',
      )
    } finally {
      isSubmittingStackRelationRef.current = false
      setIsSubmittingStackRelation(false)
    }
  }

  function chooseDroppedRelation(event: MouseEvent<HTMLButtonElement>) {
    const relationTypeCode = event.currentTarget.dataset.relationTypeCode
    if (relationTypeCode) {
      void chooseStackRelation(relationTypeCode)
    }
  }

  function closeDropChooser() {
    const dialog = dropChooserRef.current
    if (dialog?.open && typeof dialog.close === 'function') {
      dialog.close()
      return
    }

    setDropDraft(null)
  }

  function handleDropChooserCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault()
    if (!isSubmittingStackRelationRef.current) {
      closeDropChooser()
    }
  }

  function handleDropChooserClose() {
    setDropDraft(null)
  }

  return (
    <section
      className="panel catalog-panel"
      aria-labelledby="track-results-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="track-results-title">Track records</h2>
          <p>Stacked by original tracks and relation-derived versions.</p>
        </div>
      </div>

      {dropError ? <p className="track-stack-drop-error">{dropError}</p> : null}

      <ul className="track-stack-list">
        {stacks.map((stack) => {
          const isExpanded = expandedStackIds.has(stack.id)
          const stackTracks = [
            stack.original,
            ...stack.members.map((member) => member.track),
          ]
          const stackOpenableFileCount = onOpenStackLocalFiles
            ? openableFilesFromStackTracks(stackTracks).length
            : 0
          const originalOpenableFileCount = onOpenTrackLocalFiles
            ? openableFilesFromTrack(stack.original).length
            : 0
          const canDragRoot = canDragStackTrack(
            stack.original,
            stack,
            stackRows,
          )
          const isDropTarget =
            dragSourceTrack !== null && canDropOnStack(dragSourceTrack, stack)
          return (
            <li
              aria-current={
                stack.original.id === selectedTrackId ? 'true' : undefined
              }
              aria-label={`${stack.original.title} ${trackArtistDisplay(stack.original)} ${trackReleaseDisplay(stack.original)}`}
              className="track-stack-row"
              key={stack.id}
            >
              <div
                className={trackStackRootClassName(
                  stack.original.id === selectedTrackId,
                  isDropTarget,
                  stack.original.id === highlightTrackId,
                )}
                onDragOver={(event) => dragOverStack(event, stack)}
                onDrop={(event) => dropOnStack(event, stack)}
              >
                <button
                  aria-label={isExpanded ? 'Collapse stack' : 'Expand stack'}
                  className="icon-button track-stack-toggle"
                  disabled={stack.members.length === 0}
                  type="button"
                  onClick={() => onToggleStack(stack.id)}
                >
                  {isExpanded ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                </button>
                <button
                  className="track-stack-title"
                  draggable={canDragRoot}
                  type="button"
                  onDragEnd={cancelTrackDrag}
                  onDragOver={(event) => dragOverStack(event, stack)}
                  onDragStart={(event) =>
                    startTrackDrag(stack.original, stack, event)
                  }
                  onDrop={(event) => dropOnStack(event, stack)}
                  onClick={() => onSelectTrack(stack.original.id)}
                  onDoubleClick={
                    originalOpenableFileCount
                      ? () => onOpenTrackLocalFiles?.(stack.original)
                      : undefined
                  }
                >
                  <strong>{stack.original.title}</strong>
                  <span>{trackArtistDisplay(stack.original)}</span>
                </button>
                <TrackStackFacts
                  ratingCriteria={ratingCriteria}
                  stack={stack}
                  track={stack.original}
                />
                <div className="track-stack-actions">
                  {originalOpenableFileCount ? (
                    <button
                      aria-label={`Open track files for ${stack.original.title}`}
                      className="button button-secondary button-compact track-stack-open-track-files"
                      type="button"
                      onClick={() => onOpenTrackLocalFiles?.(stack.original)}
                    >
                      Open track
                    </button>
                  ) : (
                    <span
                      aria-hidden="true"
                      className="track-stack-action-placeholder"
                    />
                  )}
                  {stackOpenableFileCount ? (
                    <button
                      aria-label={`Open stack files for ${stack.original.title}`}
                      className="button button-secondary button-compact track-stack-open-files"
                      type="button"
                      onClick={() =>
                        onOpenStackLocalFiles?.(
                          stack.original.title,
                          stackTracks,
                        )
                      }
                    >
                      Open files
                    </button>
                  ) : (
                    <span
                      aria-hidden="true"
                      className="track-stack-action-placeholder"
                    />
                  )}
                </div>
              </div>
              {dropDraft?.targetRootTrack.id === stack.original.id ? (
                <dialog
                  aria-label="Add to stack as"
                  className="track-stack-drop-chooser"
                  onCancel={handleDropChooserCancel}
                  onClose={handleDropChooserClose}
                  ref={dropChooserRef}
                >
                  <div className="track-stack-drop-copy">
                    <span className="track-stack-drop-kicker">
                      Add to stack
                    </span>
                    <strong>Choose relation type</strong>
                    <span className="track-stack-drop-route">
                      <span>
                        <span>Source</span>
                        <strong>{dropDraft.sourceTrack.title}</strong>
                      </span>
                      <ArrowRight
                        size={16}
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                      <span>
                        <span>Original</span>
                        <strong>{dropDraft.targetRootTrack.title}</strong>
                      </span>
                    </span>
                  </div>
                  <fieldset className="track-stack-drop-actions">
                    <legend className="visually-hidden">
                      Stack relation type
                    </legend>
                    <div className="track-stack-drop-choice-list">
                      {relationTypeOptions.map((option, index) => (
                        <button
                          className="track-stack-drop-choice-button"
                          key={option.code}
                          data-relation-type-code={option.code}
                          disabled={isSubmittingStackRelation}
                          ref={index === 0 ? firstDropChoiceRef : undefined}
                          type="button"
                          onClick={chooseDroppedRelation}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <button
                      className="track-stack-drop-cancel"
                      disabled={isSubmittingStackRelation}
                      type="button"
                      onClick={closeDropChooser}
                    >
                      Cancel
                    </button>
                  </fieldset>
                </dialog>
              ) : null}
              {isExpanded ? (
                <TrackStackMemberGroups
                  dictionaries={dictionaries}
                  groups={trackStackMemberGroups(stack.members, dictionaries)}
                  highlightTrackId={highlightTrackId}
                  ratingCriteria={ratingCriteria}
                  selectedTrackId={selectedTrackId}
                  stack={stack}
                  onDragOverStack={dragOverStack}
                  onDropStack={dropOnStack}
                  onOpenTrackLocalFiles={onOpenTrackLocalFiles}
                  onSelectTrack={onSelectTrack}
                />
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
