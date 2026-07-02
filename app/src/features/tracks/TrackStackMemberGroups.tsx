import type { DragEvent } from 'react'
import type { CatalogDictionaries } from '../catalog/catalogApi'
import { openableFilesFromTrack } from '../localFiles/localFileOpenModel'
import { trackReleaseDisplay } from './trackDisplayHelpers'
import type {
  TrackStackMember,
  TrackStackMemberGroup,
  TrackStackRow,
} from './TrackStacksPanel'
import type { TrackRecord } from './tracksData'
import {
  trackRelationTypeDisplay,
  trackStackMemberClassName,
} from './trackStackModel'

type TrackStackMemberGroupsProps = Readonly<{
  dictionaries: CatalogDictionaries
  groups: TrackStackMemberGroup[]
  highlightTrackId: string
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
        member.track.id === highlightTrackId,
      )}
      draggable={false}
      type="button"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
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
        {member.track.versionYear ?? 'No year'}
      </span>
    </button>
  )
}
