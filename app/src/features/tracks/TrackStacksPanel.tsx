import {
  dateAdded,
  sortByDateAdded,
  type DateAddedSort,
} from '../catalog/dateAddedSort'
import { ChevronDown, ChevronRight } from 'lucide-react'
import {
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
import type {
  StackOriginalCommand,
  StackRelationCommand,
} from '../catalog/api/ownedRelationsClient'
import type { RelationRecord } from '../relations/relationsData'
import {
  openableFilesFromStackTracks,
  openableFilesFromTrack,
} from '../localFiles/localFileOpenModel'
import { trackArtistDisplay, trackReleaseDisplay } from './trackDisplayHelpers'
import { TrackStackDropChooser } from './TrackStackDropChooser'
import { TrackStackFacts } from './TrackStackFacts'
import { TrackStackMemberGroups } from './TrackStackMemberGroups'
import type { TrackRecord } from './tracksData'
import { useStackDropChooserDialog } from './useStackDropChooserDialog'
import {
  buildStackRelationCommand,
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
  sort?: DateAddedSort
  visibleTracks: TrackRecord[]
  selectedTrackId: string
  onCreateStackRelation: (command: StackRelationCommand) => Promise<void>
  onPromoteOriginal?: (command: StackOriginalCommand) => Promise<void>
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

export function TrackStacksPanel({
  dictionaries,
  expandedStackIds,
  ratingCriteria,
  relations,
  serverStacks,
  stackRelationTypeCodes,
  tracks,
  sort = 'default',
  visibleTracks,
  selectedTrackId,
  onCreateStackRelation,
  onPromoteOriginal,
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
      sortByDateAdded(
        stackRows.filter(
          (stack) =>
            visibleTrackIds.has(stack.original.id) ||
            stack.members.some((member) =>
              visibleTrackIds.has(member.track.id),
            ),
        ),
        sort,
        (stack) => dateAdded(stack.original),
      ),
    [stackRows, visibleTrackIds, sort],
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

  useStackDropChooserDialog(
    dropDraft !== null,
    dropChooserRef,
    firstDropChoiceRef,
  )

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

  function resolveDragSource(event: DragEvent) {
    const eventSourceTrackId = event.dataTransfer.getData('text/plain')
    return (
      dragSourceTrack ??
      tracks.find((track) => track.id === eventSourceTrackId) ??
      null
    )
  }

  function dragOverStack(event: DragEvent, stack: TrackStackRow) {
    const sourceTrack = resolveDragSource(event)

    if (!sourceTrack || !canDropOnStack(sourceTrack, stack)) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  function dropOnStack(event: DragEvent, stack: TrackStackRow) {
    event.preventDefault()
    const sourceTrack = resolveDragSource(event)

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
    await runStackMutation(
      () =>
        onCreateStackRelation(
          buildStackRelationCommand(
            draft.sourceTrack.id,
            draft.targetRootTrack.id,
            relationTypeCode,
            draft.targetWasStandalone && !draft.targetRootTrack.isOriginal,
          ),
        ),
      draft.sourceTrack.id,
      'Could not create the stack relation.',
    )
  }

  async function runStackMutation(
    mutate: () => Promise<void>,
    highlightedTrackId: string,
    fallbackError: string,
  ) {
    if (isSubmittingStackRelationRef.current) {
      return
    }
    isSubmittingStackRelationRef.current = true
    setIsSubmittingStackRelation(true)
    setDropError('')
    try {
      await mutate()
      setHighlightTrackId(highlightedTrackId)
      globalThis.setTimeout(() => setHighlightTrackId(''), 1200)
      setDropDraft(null)
    } catch (error) {
      setDropError(error instanceof Error ? error.message : fallbackError)
    } finally {
      isSubmittingStackRelationRef.current = false
      setIsSubmittingStackRelation(false)
    }
  }

  async function promoteOriginal(
    newOriginal: TrackRecord,
    currentOriginal: TrackRecord,
    relationTypeCode: string,
  ) {
    if (!onPromoteOriginal) {
      return
    }
    await runStackMutation(
      () =>
        onPromoteOriginal({
          newOriginalTrackId: newOriginal.id,
          currentOriginalTrackId: currentOriginal.id,
          relationTypeCode,
        }),
      newOriginal.id,
      'Could not change the stack original.',
    )
  }

  function promoteDroppedSource(event: MouseEvent<HTMLButtonElement>) {
    const relationTypeCode = event.currentTarget.dataset.relationTypeCode
    if (dropDraft && relationTypeCode) {
      void promoteOriginal(
        dropDraft.sourceTrack,
        dropDraft.targetRootTrack,
        relationTypeCode,
      )
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

  const canPromoteDrop =
    Boolean(onPromoteOriginal) && dropDraft?.targetWasStandalone === false

  function promoteMemberHandler(stack: TrackStackRow) {
    if (!onPromoteOriginal) return undefined
    return (member: TrackStackRow['members'][number]) =>
      promoteOriginal(member.track, stack.original, member.relationType)
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
                <TrackStackDropChooser
                  canPromote={canPromoteDrop}
                  dialogRef={dropChooserRef}
                  firstChoiceRef={firstDropChoiceRef}
                  isSubmitting={isSubmittingStackRelation}
                  relationTypeOptions={relationTypeOptions}
                  sourceTitle={dropDraft.sourceTrack.title}
                  targetTitle={dropDraft.targetRootTrack.title}
                  onCancel={handleDropChooserCancel}
                  onChooseRelation={chooseDroppedRelation}
                  onClose={handleDropChooserClose}
                  onDismiss={closeDropChooser}
                  onPromote={promoteDroppedSource}
                />
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
                  onPromoteMember={promoteMemberHandler(stack)}
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
