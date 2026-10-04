import { useRef, useState, type RefObject } from 'react'
import {
  createStackRelation,
  promoteStackOriginal,
  type StackOriginalCommand,
  type StackRelationCommand,
} from '../catalog/api/ownedRelationsClient'
import type { TrackRelationDto } from '../catalog/api/catalogTypes'
import type { TrackStackPickerAssignedResult } from './TrackStackPickerDialog'
import {
  isEligibleStackSource,
  type StackRelationTypeOption,
  type TrackStackRow,
} from './trackStackModel'
import type { TrackRecord } from './tracksData'

export type UseTrackStackAssignmentInput = Readonly<{
  selectedTrack: TrackRecord | null
  stackRows: TrackStackRow[]
  relationTypeOptions: StackRelationTypeOption[]
  relationTypesReady: boolean
  stackProjectionReady: boolean
  onCatalogChanged?: () => void
  onStackRelationSaved?: (
    relation: TrackRelationDto,
    command: StackRelationCommand,
  ) => void
  onExpandDropTarget: (trackId: string) => void
  onRefreshStacks: () => void
}>

export type UseTrackStackAssignmentResult = Readonly<{
  actionStatus: string
  canOpenPicker: boolean
  entryButtonRef: RefObject<HTMLButtonElement | null>
  pickerSource: TrackRecord | null
  closePicker: () => void
  handleAssigned: (result: TrackStackPickerAssignedResult) => void
  handleDropCommand: (command: StackRelationCommand) => Promise<void>
  handlePickerCommand: (command: StackRelationCommand) => Promise<void>
  handlePromoteOriginal: (command: StackOriginalCommand) => Promise<void>
  handleSourceInvalid: () => void
  openPicker: () => void
}>

type PickerState = Readonly<{
  sourceTrackId: string
  sourceSnapshot: TrackRecord
}>

export function useTrackStackAssignment({
  selectedTrack,
  stackRows,
  relationTypeOptions,
  relationTypesReady,
  stackProjectionReady,
  onCatalogChanged,
  onStackRelationSaved,
  onExpandDropTarget,
  onRefreshStacks,
}: UseTrackStackAssignmentInput): UseTrackStackAssignmentResult {
  const entryButtonRef = useRef<HTMLButtonElement>(null)
  const [actionStatus, setActionStatus] = useState('')
  const [pickerState, setPickerState] = useState<PickerState | null>(null)
  const pickerSource = pickerState
    ? (findTrackInStackRows(pickerState.sourceTrackId, stackRows) ??
      pickerState.sourceSnapshot)
    : null
  const canOpenPicker = Boolean(
    selectedTrack &&
    relationTypesReady &&
    stackProjectionReady &&
    relationTypeOptions.length > 0 &&
    isEligibleStackSource(selectedTrack, stackRows),
  )

  async function persistStackRelation(command: StackRelationCommand) {
    const relation = await createStackRelation(command)
    if (relation && onStackRelationSaved) {
      onStackRelationSaved(relation, command)
    } else {
      onCatalogChanged?.()
    }
    onRefreshStacks()
  }

  async function handlePickerCommand(command: StackRelationCommand) {
    await persistStackRelation(command)
  }

  async function handleDropCommand(command: StackRelationCommand) {
    await persistStackRelation(command)
    onExpandDropTarget(command.targetRootTrackId)
  }

  async function handlePromoteOriginal(command: StackOriginalCommand) {
    await promoteStackOriginal(command)
    onCatalogChanged?.()
    onRefreshStacks()
    onExpandDropTarget(command.newOriginalTrackId)
  }

  function openPicker() {
    if (!canOpenPicker || !selectedTrack) {
      return
    }
    setActionStatus('')
    setPickerState({
      sourceTrackId: selectedTrack.id,
      sourceSnapshot: selectedTrack,
    })
  }

  function closePicker() {
    setPickerState(null)
  }

  function handleAssigned(result: TrackStackPickerAssignedResult) {
    if (!pickerSource) {
      return
    }
    setActionStatus(
      result.placement === 'original'
        ? `Made ${pickerSource.title} the original of the ${result.destination.title} stack.`
        : `Added ${pickerSource.title} to ${result.destination.title} as ${result.relationType.label}.`,
    )
  }

  function handleSourceInvalid() {
    onRefreshStacks()
    onCatalogChanged?.()
  }

  return {
    actionStatus,
    canOpenPicker,
    entryButtonRef,
    pickerSource,
    closePicker,
    handleAssigned,
    handleDropCommand,
    handlePickerCommand,
    handlePromoteOriginal,
    handleSourceInvalid,
    openPicker,
  }
}

function findTrackInStackRows(
  trackId: string,
  stackRows: TrackStackRow[],
): TrackRecord | null {
  for (const row of stackRows) {
    if (row.original.id === trackId) {
      return row.original
    }

    const member = row.members.find((item) => item.track.id === trackId)
    if (member) {
      return member.track
    }
  }

  return null
}
