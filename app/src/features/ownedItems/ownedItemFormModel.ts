import { toMediumRequest } from '../catalog/api/catalogRequestMappers'
import type { ReleaseRecord } from '../releases/releasesData'
import {
  createManualRecordId,
  textOrFallback,
} from '../manualEntry/manualEntryUtils'
import {
  isDigitalOwnedItem,
  type OwnedItemRecord,
  type OwnedItemMediumType,
  type OwnedItemStatus,
} from './ownedItemsData'

type CopyFields = {
  title: string
  medium: string
  status: OwnedItemStatus | ''
  storage: string
  condition: string
  copyNote: string
}

export function initialCopyFields(
  item?: OwnedItemRecord,
  release?: ReleaseRecord,
) {
  const isDigital = Boolean(item && isDigitalOwnedItem(item))
  return {
    title: item?.title ?? release?.title ?? '',
    releaseId: item?.releaseId ?? item?.targetId ?? '',
    medium: item?.medium ?? '',
    status:
      item?.status === 'Not recorded'
        ? ('' as const)
        : (item?.status ?? ('' as const)),
    isDigital,
    storage: isDigital ? '' : (item?.storage ?? ''),
    condition: isDigital ? '' : (item?.condition ?? ''),
    copyNote: item?.copyNotes ?? '',
  }
}
export function buildOwnedItemRecord(
  initialItem: OwnedItemRecord | undefined,
  selectedRelease: ReleaseRecord,
  fields: CopyFields,
  isDigitalMedium: boolean,
  selectedMediumType: OwnedItemMediumType,
): OwnedItemRecord {
  const { title, medium, status, copyNote } = fields
  if (!status || status === 'Not recorded')
    throw new Error('Select an ownership status before saving the copy.')
  const itemStatus = status
  const item: OwnedItemRecord = {
    ...initialItem,
    id: initialItem?.id ?? createManualRecordId('owned-item', title.trim()),
    title: title.trim(),
    targetType: 'Release',
    targetId: selectedRelease.id,
    target: initialItem?.target
      ? {
          ...initialItem.target,
          id: selectedRelease.id,
          title: selectedRelease.title,
        }
      : undefined,
    releaseId: selectedRelease.id,
    releaseTitle: selectedRelease.title,
    artist: selectedRelease.artist,
    medium: textOrFallback(medium, 'Unspecified medium'),
    ...mediumDetails(initialItem, fields, isDigitalMedium, selectedMediumType),
    status: itemStatus,
    statusTone: statusToneFor(itemStatus),
    acquisition: initialItem?.acquisition ?? 'Manual entry',
    copyNotes: copyNote.trim(),
    linkedType: 'Release',
    ...digitalSummary(initialItem, fields, isDigitalMedium),
    tags: initialItem?.tags ?? ['manual entry'],
  }
  return item
}
function mediumDetails(
  initialItem: OwnedItemRecord | undefined,
  fields: CopyFields,
  isDigitalMedium: boolean,
  selectedMediumType: OwnedItemMediumType,
) {
  const { medium, storage, condition } = fields
  const unchangedMedium = initialItem?.medium === medium
  const previous = unchangedMedium ? initialItem : undefined
  const initialType = initialItem
    ? (initialItem.mediumType ?? toMediumRequest(initialItem.medium).type)
    : undefined
  const sameType = unchangedMedium || initialType === selectedMediumType
  return {
    mediumType: unchangedMedium ? initialItem?.mediumType : selectedMediumType,
    physicalDetails:
      sameType && !isDigitalMedium && initialItem?.physicalDetails
        ? {
            ...initialItem.physicalDetails,
            storageLocation: storage.trim(),
            condition: condition.trim(),
          }
        : undefined,
    digitalDetails: unchangedMedium ? initialItem?.digitalDetails : undefined,
    storage: isDigitalMedium
      ? (previous?.storage ?? 'Digital copy')
      : textOrFallback(storage, 'No storage recorded'),
    condition: isDigitalMedium
      ? (previous?.condition ?? 'Digital copy recorded')
      : textOrFallback(condition, 'No condition recorded'),
  }
}
function digitalSummary(
  initialItem: OwnedItemRecord | undefined,
  fields: CopyFields,
  isDigitalMedium: boolean,
) {
  const { medium, copyNote } = fields
  const unchangedMedium = initialItem?.medium === medium
  const previous = unchangedMedium ? initialItem : undefined
  const digitalState = isDigitalMedium
    ? 'Digital copy recorded'
    : 'No digital file recorded'
  const digitizationState = isDigitalMedium
    ? 'Digital source only'
    : copyNote.trim()
  return {
    fileFormat: previous?.fileFormat ?? 'None recorded',
    digitalState: previous?.digitalState ?? digitalState,
    digitizationState: previous?.digitizationState ?? digitizationState,
  }
}
function statusToneFor(status: OwnedItemStatus): OwnedItemRecord['statusTone'] {
  switch (status) {
    case 'Owned':
      return 'green'
    case 'Wanted':
      return 'blue'
    case 'Needs digitization':
      return 'amber'
    default:
      return 'gray'
  }
}

export function confirmMediumChange(
  item: OwnedItemRecord | undefined,
  initiallyDigital: boolean,
  isDigital: boolean,
) {
  if (!initiallyDigital || isDigital) return true
  const details = item?.digitalDetails
  const count = Math.max(
    details?.linkedFileCount ?? 0,
    details?.files.length ?? 0,
  )
  if (count === 0) return true
  return window.confirm(
    'Changing this digital copy to a physical medium will remove its track-file links. The audio files themselves will not be deleted. Continue?',
  )
}

export function findDuplicateCopy(
  items: OwnedItemRecord[],
  initialItem: OwnedItemRecord | undefined,
  release: ReleaseRecord | undefined,
  medium: string,
  storage: string,
) {
  if (!release) return undefined
  return items.find(
    (item) =>
      item.id !== initialItem?.id &&
      (item.releaseId ?? item.targetId ?? item.target?.id) === release.id &&
      item.medium.toLowerCase() === medium.trim().toLowerCase() &&
      item.storage.toLowerCase() === storage.trim().toLowerCase(),
  )
}

function formLabels(scoped: boolean, editing: boolean, digital: boolean) {
  if (scoped)
    return {
      noteLabel: 'Copy note',
      formTitle: editing ? 'Edit copy' : 'Add copy',
      submitLabel: editing ? 'Save copy' : 'Add copy',
    }
  return {
    noteLabel: digital ? 'Digital copy note' : 'Digitization note',
    formTitle: editing ? 'Edit owned item' : 'Add owned item',
    submitLabel: editing ? 'Save record' : 'Add record',
  }
}

export function ownedItemFormPresentation({
  title,
  status,
  scopeId,
  scopedRelease,
  initialItem,
  selectedRelease,
  isDigitalMedium,
}: {
  title: string
  status: OwnedItemStatus | ''
  scopeId: string | undefined
  scopedRelease: ReleaseRecord | undefined
  initialItem: OwnedItemRecord | undefined
  selectedRelease: ReleaseRecord | undefined
  isDigitalMedium: boolean
}) {
  const initialReleaseId =
    initialItem?.releaseId ?? initialItem?.targetId ?? initialItem?.target?.id
  const validScope =
    !scopedRelease ||
    (scopeId === scopedRelease.id &&
      (!initialReleaseId || initialReleaseId === scopedRelease.id))
  const validStatus = Boolean(status && status !== 'Not recorded')
  let requiredMessage = validStatus
    ? 'Select an existing release.'
    : 'Select an ownership status.'
  if (title.trim().length === 0) requiredMessage = 'Item name is required.'
  if (!validScope)
    requiredMessage =
      'This copy belongs to a different release. Reopen the editor.'
  return {
    ...formLabels(
      Boolean(scopedRelease),
      Boolean(initialItem),
      isDigitalMedium,
    ),
    isValid:
      title.trim().length > 0 &&
      Boolean(selectedRelease) &&
      validScope &&
      validStatus,
    requiredMessage,
  }
}
