import { ArrowRight, ChevronDown, ChevronRight } from 'lucide-react'
import {
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
} from 'react'
import type {
  CatalogDictionaries,
  RatingCriterion,
  TrackStackDto,
} from '../catalog/catalogApi'
import { RatingTableValue } from '../ratings/RatingsPanel'
import { ratingValueFor } from '../ratings/ratingUtils'
import type { RelationRecord } from '../relations/relationsData'
import { trackArtistDisplay, trackReleaseDisplay } from './trackDisplayHelpers'
import type { TrackRecord } from './tracksData'
import {
  buildTrackStacks,
  buildTrackStacksFromServer,
  canDragStackTrack,
  canDropOnStack,
  hasDuplicateStackRelation,
  hasStackPath,
  stackRelationTypeOptions,
  stackRelationTypeValues,
  trackRelationTypeDisplay,
  trackStackMemberClassName,
  trackStackMemberGroups,
  trackStackRootClassName,
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
  onSelectTrack: (trackId: string) => void
  onToggleStack: (stackId: string) => void
}>

type TrackStackRow = {
  id: string
  original: TrackRecord
  members: TrackStackMember[]
  hasCycleIssue: boolean
}

type TrackStackMember = {
  track: TrackRecord
  relationType: string
  depth: number
  isDirect: boolean
}

type ProductStackRelationTypeCode = 'remixOf' | 'versionOf'

type TrackStackMemberGroup = {
  key: ProductStackRelationTypeCode | 'other'
  label: string
  members: TrackStackMember[]
}

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
  onSelectTrack,
  onToggleStack,
}: TrackStacksPanelProps) {
  const relationTypeValues = useMemo(
    () => stackRelationTypeValues(stackRelationTypeCodes, dictionaries),
    [dictionaries, stackRelationTypeCodes],
  )
  const visibleTrackIds = useMemo(
    () => new Set(visibleTracks.map((track) => track.id)),
    [visibleTracks],
  )
  const stacks = useMemo(
    () =>
      (serverStacks
        ? buildTrackStacksFromServer(serverStacks, tracks)
        : buildTrackStacks(tracks, relations, relationTypeValues)
      ).filter(
        (stack) =>
          visibleTrackIds.has(stack.original.id) ||
          stack.members.some((member) => visibleTrackIds.has(member.track.id)),
      ),
    [relationTypeValues, relations, serverStacks, tracks, visibleTrackIds],
  )
  const [dragSourceTrackId, setDragSourceTrackId] = useState('')
  const [dropDraft, setDropDraft] = useState<StackDropDraft | null>(null)
  const [dropError, setDropError] = useState('')
  const [highlightTrackId, setHighlightTrackId] = useState('')
  const [isSubmittingStackRelation, setIsSubmittingStackRelation] =
    useState(false)
  const isSubmittingStackRelationRef = useRef(false)
  const stackMemberTrackIds = useMemo(
    () =>
      new Set(
        stacks.flatMap((stack) =>
          stack.members.map((member) => member.track.id),
        ),
      ),
    [stacks],
  )
  const relationTypeOptions = useMemo(
    () => stackRelationTypeOptions(stackRelationTypeCodes, dictionaries),
    [dictionaries, stackRelationTypeCodes],
  )
  const dragSourceTrack = dragSourceTrackId
    ? (tracks.find((track) => track.id === dragSourceTrackId) ?? null)
    : null

  function startTrackDrag(
    track: TrackRecord,
    stack: TrackStackRow,
    event: DragEvent,
  ) {
    if (!canDragStackTrack(track, stack, stackMemberTrackIds)) {
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

    setDropDraft({
      sourceTrack,
      targetRootTrack: stack.original,
      targetWasStandalone: stack.members.length === 0,
    })
    cancelTrackDrag()
  }

  async function chooseStackRelation(relationTypeCode: string) {
    if (!dropDraft || isSubmittingStackRelationRef.current) {
      return
    }

    const draft = dropDraft

    if (
      hasDuplicateStackRelation(
        draft.sourceTrack.id,
        draft.targetRootTrack.id,
        relationTypeCode,
        relations,
        stackRelationTypeCodes,
        dictionaries,
      )
    ) {
      setDropError('This stack relation already exists.')
      setDropDraft(null)
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
      {dropDraft ? (
        <dialog
          open
          aria-label="Add to stack as"
          className="track-stack-drop-chooser"
        >
          <div className="track-stack-drop-copy">
            <span className="track-stack-drop-kicker">Add to stack</span>
            <strong>Choose relation type</strong>
            <span className="track-stack-drop-route">
              <span>
                <span>Source</span>
                <strong>{dropDraft.sourceTrack.title}</strong>
              </span>
              <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
              <span>
                <span>Original</span>
                <strong>{dropDraft.targetRootTrack.title}</strong>
              </span>
            </span>
          </div>
          <div
            aria-label="Stack relation type"
            className="track-stack-drop-actions"
            role="group"
          >
            <div className="track-stack-drop-choice-list">
              {relationTypeOptions.map((option) => (
                <button
                  className="track-stack-drop-choice-button"
                  key={option.code}
                  data-relation-type-code={option.code}
                  disabled={isSubmittingStackRelation}
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
          </div>
        </dialog>
      ) : null}

      <ul className="track-stack-list">
        {stacks.map((stack) => {
          const isExpanded = expandedStackIds.has(stack.id)
          const canDragRoot = canDragStackTrack(
            stack.original,
            stack,
            stackMemberTrackIds,
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
                >
                  <strong>{stack.original.title}</strong>
                  <span>{trackArtistDisplay(stack.original)}</span>
                </button>
                <TrackStackFacts
                  ratingCriteria={ratingCriteria}
                  stack={stack}
                  track={stack.original}
                />
              </div>
              {isExpanded ? (
                <TrackStackMemberGroups
                  dictionaries={dictionaries}
                  groups={trackStackMemberGroups(stack.members, dictionaries)}
                  highlightTrackId={highlightTrackId}
                  isDropTarget={isDropTarget}
                  selectedTrackId={selectedTrackId}
                  stack={stack}
                  onDragOverStack={dragOverStack}
                  onDropStack={dropOnStack}
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

type TrackStackMemberGroupsProps = Readonly<{
  dictionaries: CatalogDictionaries
  groups: TrackStackMemberGroup[]
  highlightTrackId: string
  isDropTarget: boolean
  selectedTrackId: string
  stack: TrackStackRow
  onDragOverStack: (event: DragEvent, stack: TrackStackRow) => void
  onDropStack: (event: DragEvent, stack: TrackStackRow) => void
  onSelectTrack: (trackId: string) => void
}>

function TrackStackMemberGroups({
  dictionaries,
  groups,
  highlightTrackId,
  isDropTarget,
  selectedTrackId,
  stack,
  onDragOverStack,
  onDropStack,
  onSelectTrack,
}: TrackStackMemberGroupsProps) {
  return (
    <div className="track-stack-members">
      {groups.map((group) => (
        <TrackStackMemberGroupView
          dictionaries={dictionaries}
          group={group}
          highlightTrackId={highlightTrackId}
          isDropTarget={isDropTarget}
          key={`${stack.id}:${group.key}`}
          selectedTrackId={selectedTrackId}
          stack={stack}
          onDragOverStack={onDragOverStack}
          onDropStack={onDropStack}
          onSelectTrack={onSelectTrack}
        />
      ))}
    </div>
  )
}

type TrackStackMemberGroupViewProps = Readonly<{
  dictionaries: CatalogDictionaries
  group: TrackStackMemberGroup
  highlightTrackId: string
  isDropTarget: boolean
  selectedTrackId: string
  stack: TrackStackRow
  onDragOverStack: (event: DragEvent, stack: TrackStackRow) => void
  onDropStack: (event: DragEvent, stack: TrackStackRow) => void
  onSelectTrack: (trackId: string) => void
}>

function TrackStackMemberGroupView({
  dictionaries,
  group,
  highlightTrackId,
  isDropTarget,
  selectedTrackId,
  stack,
  onDragOverStack,
  onDropStack,
  onSelectTrack,
}: TrackStackMemberGroupViewProps) {
  return (
    <div className="track-stack-member-group">
      <div className="track-stack-member-group-label">{group.label}</div>
      {group.members.map((member) => (
        <TrackStackMemberButton
          dictionaries={dictionaries}
          groupKey={group.key}
          highlightTrackId={highlightTrackId}
          isDropTarget={isDropTarget}
          key={`${stack.id}:${member.track.id}`}
          member={member}
          selectedTrackId={selectedTrackId}
          stack={stack}
          onDragOverStack={onDragOverStack}
          onDropStack={onDropStack}
          onSelectTrack={onSelectTrack}
        />
      ))}
    </div>
  )
}

type TrackStackMemberButtonProps = Readonly<{
  dictionaries: CatalogDictionaries
  groupKey: TrackStackMemberGroup['key']
  highlightTrackId: string
  isDropTarget: boolean
  member: TrackStackMember
  selectedTrackId: string
  stack: TrackStackRow
  onDragOverStack: (event: DragEvent, stack: TrackStackRow) => void
  onDropStack: (event: DragEvent, stack: TrackStackRow) => void
  onSelectTrack: (trackId: string) => void
}>

function TrackStackMemberButton({
  dictionaries,
  groupKey,
  highlightTrackId,
  isDropTarget,
  member,
  selectedTrackId,
  stack,
  onDragOverStack,
  onDropStack,
  onSelectTrack,
}: TrackStackMemberButtonProps) {
  function handleDragOver(event: DragEvent) {
    onDragOverStack(event, stack)
  }

  function handleDrop(event: DragEvent) {
    onDropStack(event, stack)
  }

  function handleSelect() {
    onSelectTrack(member.track.id)
  }

  return (
    <button
      aria-label={`${member.track.title} ${trackReleaseDisplay(member.track)}`}
      className={trackStackMemberClassName(
        member.track.id === selectedTrackId,
        isDropTarget,
        member.track.id === highlightTrackId,
      )}
      draggable={false}
      type="button"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleSelect}
    >
      <span className="track-stack-member-title">
        <strong>{member.track.title}</strong>
        <span className="track-stack-member-details">
          {groupKey === 'other' ? (
            <span className="track-stack-member-connector">
              {trackRelationTypeDisplay(member.relationType, dictionaries)}
            </span>
          ) : null}
          <span>{trackReleaseDisplay(member.track)}</span>
        </span>
      </span>
      <span className="track-stack-member-meta">
        {member.track.versionYear ?? 'No year'}
      </span>
    </button>
  )
}

type TrackStackFactsProps = Readonly<{
  ratingCriteria: RatingCriterion[]
  stack: TrackStackRow
  track: TrackRecord
}>

function TrackStackFacts({
  ratingCriteria,
  stack,
  track,
}: TrackStackFactsProps) {
  return (
    <div className="track-stack-facts">
      <span>{track.versionYear ?? 'No year'}</span>
      <span>{track.duration}</span>
      <span>{stack.members.length} versions</span>
      <span>{track.releaseAppearances.length} releases</span>
      <span>{track.digitalFiles.length} files</span>
      {stack.hasCycleIssue ? <span>Cycle issue</span> : null}
      {ratingCriteria.map((criterion) => (
        <span key={criterion.id}>
          {criterion.name}:{' '}
          <RatingTableValue
            value={ratingValueFor(track.ratings, criterion.id)}
          />
        </span>
      ))}
    </div>
  )
}
