import type { DragEvent } from 'react'
import type {
  CatalogDictionaries,
  RatingCriterion,
} from '../catalog/catalogApi'
import { ratingValueFor } from '../ratings/ratingUtils'
import { openableFilesFromTrack } from '../localFiles/localFileOpenModel'
import { trackReleaseDisplay } from './trackDisplayHelpers'
import type { TrackRecord } from './tracksData'
import {
  trackRelationTypeDisplay,
  trackStackMemberClassName,
  type TrackStackMember,
  type TrackStackMemberGroup,
  type TrackStackRow,
} from './trackStackModel'

type TrackStackMemberGroupsProps = Readonly<{
  dictionaries: CatalogDictionaries
  groups: TrackStackMemberGroup[]
  highlightTrackId: string
  ratingCriteria: RatingCriterion[]
  selectedTrackId: string
  stack: TrackStackRow
  onDragOverStack: (event: DragEvent, stack: TrackStackRow) => void
  onDropStack: (event: DragEvent, stack: TrackStackRow) => void
  onOpenTrackLocalFiles?: (track: TrackRecord) => void
  onSelectTrack: (trackId: string) => void
}>

export function TrackStackMemberGroups({
  dictionaries,
  groups,
  highlightTrackId,
  ratingCriteria,
  selectedTrackId,
  stack,
  onDragOverStack,
  onDropStack,
  onOpenTrackLocalFiles,
  onSelectTrack,
}: TrackStackMemberGroupsProps) {
  return (
    <div className="track-stack-members">
      {groups.map((group) => (
        <TrackStackMemberGroupView
          dictionaries={dictionaries}
          group={group}
          highlightTrackId={highlightTrackId}
          key={`${stack.id}:${group.key}`}
          ratingCriteria={ratingCriteria}
          selectedTrackId={selectedTrackId}
          stack={stack}
          onDragOverStack={onDragOverStack}
          onDropStack={onDropStack}
          onOpenTrackLocalFiles={onOpenTrackLocalFiles}
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
  ratingCriteria: RatingCriterion[]
  selectedTrackId: string
  stack: TrackStackRow
  onDragOverStack: (event: DragEvent, stack: TrackStackRow) => void
  onDropStack: (event: DragEvent, stack: TrackStackRow) => void
  onOpenTrackLocalFiles?: (track: TrackRecord) => void
  onSelectTrack: (trackId: string) => void
}>

function TrackStackMemberGroupView({
  dictionaries,
  group,
  highlightTrackId,
  ratingCriteria,
  selectedTrackId,
  stack,
  onDragOverStack,
  onDropStack,
  onOpenTrackLocalFiles,
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
          key={`${stack.id}:${member.track.id}`}
          member={member}
          ratingCriteria={ratingCriteria}
          selectedTrackId={selectedTrackId}
          stack={stack}
          onDragOverStack={onDragOverStack}
          onDropStack={onDropStack}
          onOpenTrackLocalFiles={onOpenTrackLocalFiles}
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
  member: TrackStackMember
  ratingCriteria: RatingCriterion[]
  selectedTrackId: string
  stack: TrackStackRow
  onDragOverStack: (event: DragEvent, stack: TrackStackRow) => void
  onDropStack: (event: DragEvent, stack: TrackStackRow) => void
  onOpenTrackLocalFiles?: (track: TrackRecord) => void
  onSelectTrack: (trackId: string) => void
}>

function TrackStackMemberButton({
  dictionaries,
  groupKey,
  highlightTrackId,
  member,
  ratingCriteria,
  selectedTrackId,
  stack,
  onDragOverStack,
  onDropStack,
  onOpenTrackLocalFiles,
  onSelectTrack,
}: TrackStackMemberButtonProps) {
  const memberOpenableFileCount = onOpenTrackLocalFiles
    ? openableFilesFromTrack(member.track).length
    : 0
  const ratingFacts = ratingCriteria.flatMap((criterion) => {
    const value = ratingValueFor(member.track.ratings, criterion.id)
    return value === undefined
      ? []
      : [{ id: criterion.id, label: criterion.name, value }]
  })

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
    <div
      className="track-stack-member-row"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <button
        aria-label={`${member.track.title} ${trackReleaseDisplay(member.track)}`}
        className={trackStackMemberClassName(
          member.track.id === selectedTrackId,
          member.track.id === highlightTrackId,
        )}
        draggable={false}
        type="button"
        onClick={handleSelect}
        onDoubleClick={
          memberOpenableFileCount
            ? () => onOpenTrackLocalFiles?.(member.track)
            : undefined
        }
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
          <span>{member.track.versionYear ?? 'No year'}</span>
          {member.track.duration ? <span>{member.track.duration}</span> : null}
          {ratingFacts.map((fact) => (
            <span key={fact.id}>
              {fact.label}: {fact.value}
            </span>
          ))}
        </span>
      </button>
      {memberOpenableFileCount ? (
        <button
          aria-label={`Open track files for ${member.track.title}`}
          className="button button-secondary button-compact track-stack-member-open-files"
          type="button"
          onClick={() => onOpenTrackLocalFiles?.(member.track)}
        >
          Open track
        </button>
      ) : (
        <span
          aria-hidden="true"
          className="track-stack-member-action-placeholder"
        />
      )}
    </div>
  )
}
