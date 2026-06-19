import type {
  OwnedItemRecord,
  OwnedItemTargetRecord,
} from '../../ownedItems/ownedItemsData'
import type { ReleaseRecord } from '../../releases/releasesData'
import {
  conditionLabel,
  mediumLabel,
  ownedItemCondition,
  ownedItemStorageLocation,
  ownershipStatusLabel,
  statusToneFor,
} from './catalogValueMappers'
import type {
  CatalogDictionaries,
  OwnedItemDto,
  OwnedItemTargetDto,
  ReleaseDto,
} from './catalogTypes'

export function toOwnedItemRecord(
  item: OwnedItemDto,
  releasesById: Map<string, ReleaseDto>,
  releases: ReleaseRecord[],
  dictionaries: CatalogDictionaries,
): OwnedItemRecord {
  const release = releasesById.get(item.releaseId)
  const target = toOwnedItemTargetRecord({
    type: 'release',
    id: item.releaseId,
    title: item.release.title,
  })
  const releaseRecord = release
    ? releases.find((record) => record.id === release.id)
    : undefined
  const status = ownershipStatusLabel(item.status)
  const condition = ownedItemCondition(item)
  const storageLocation = ownedItemStorageLocation(item)
  const digitalFiles = item.details.digital?.files ?? []
  const fileFormats = [
    ...new Set(
      digitalFiles
        .map((file) => file.format?.trim().toUpperCase())
        .filter((format): format is string => Boolean(format)),
    ),
  ]

  return {
    id: item.id,
    title: release?.title ?? item.release.title,
    targetType: 'Release',
    targetId: item.releaseId,
    target,
    releaseId: item.releaseId,
    releaseTitle: release?.title ?? item.release.title,
    artist: releaseRecord?.artist ?? target?.subtitle ?? 'Unknown artist',
    medium: mediumLabel(item.medium, dictionaries),
    status,
    statusTone: statusToneFor(status),
    storage: storageLocation ?? 'No storage recorded',
    condition: conditionLabel(condition),
    acquisition: 'Not recorded',
    copyNotes: '',
    linkedType: 'Release',
    fileFormat:
      fileFormats.length > 0 ? fileFormats.join(', ') : 'None recorded',
    digitalState:
      item.medium.type === 'digital'
        ? item.details.digital && item.details.digital.linkedFileCount > 0
          ? `${item.details.digital.linkedFileCount} local file${item.details.digital.linkedFileCount === 1 ? '' : 's'} linked`
          : 'Digital copy recorded'
        : 'No digital file recorded',
    digitizationState:
      status === 'Needs digitization'
        ? 'Needs digitization'
        : 'No digitization state recorded',
    tags: [],
    inventorySignals: item.inventorySignals ?? [],
  }
}

function toOwnedItemTargetRecord(
  target: OwnedItemTargetDto | null | undefined,
): OwnedItemTargetRecord | undefined {
  if (!target) {
    return undefined
  }

  return {
    type: 'Release',
    id: target.id,
    title: target.title,
    subtitle: target.subtitle ?? '',
    releaseId: target.releaseId ?? target.id,
    releaseTitle: target.releaseTitle ?? target.title,
  }
}
