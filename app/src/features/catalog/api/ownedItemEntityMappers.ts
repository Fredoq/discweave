import type {
  OwnedItemRecord,
  OwnedItemTargetRecord,
} from '../../ownedItems/ownedItemsData'
import type { ReleaseRecord } from '../../releases/releasesData'
import type { TrackRecord } from '../../tracks/tracksData'
import {
  conditionLabel,
  isManualDigitalPlaceholder,
  mediumLabel,
  ownershipStatusLabel,
  statusToneFor,
} from './catalogValueMappers'
import type {
  CatalogDictionaries,
  OwnedItemDto,
  OwnedItemTargetDto,
  ReleaseDto,
  TrackDto,
} from './catalogTypes'

export function toOwnedItemRecord(
  item: OwnedItemDto,
  releasesById: Map<string, ReleaseDto>,
  tracksById: Map<string, TrackDto>,
  releases: ReleaseRecord[],
  tracks: TrackRecord[],
  dictionaries: CatalogDictionaries,
): OwnedItemRecord {
  const release =
    item.targetType === 'release' ? releasesById.get(item.targetId) : undefined
  const track =
    item.targetType === 'track' ? tracksById.get(item.targetId) : undefined
  const target = toOwnedItemTargetRecord(item.target)
  const releaseRecord = release
    ? releases.find((record) => record.id === release.id)
    : undefined
  const trackRecord = track
    ? tracks.find((record) => record.id === track.id)
    : undefined
  const status = ownershipStatusLabel(item.status)

  return {
    id: item.id,
    title: release?.title ?? track?.title ?? target?.title ?? 'Owned item',
    targetType: item.targetType === 'track' ? 'Track' : 'Release',
    targetId: item.targetId,
    target,
    releaseId: release?.id ?? trackRecord?.release.id ?? target?.releaseId,
    releaseTitle:
      release?.title ??
      trackRecord?.release.title ??
      target?.releaseTitle ??
      'Unlinked catalog item',
    artist:
      releaseRecord?.artist ??
      trackRecord?.artist ??
      target?.subtitle ??
      'Unknown artist',
    medium: mediumLabel(item.medium, dictionaries),
    status,
    statusTone: statusToneFor(status),
    storage: item.storageLocation ?? 'No storage recorded',
    condition: conditionLabel(item.condition),
    acquisition: 'Not recorded',
    copyNotes: '',
    linkedType: item.targetType === 'track' ? 'Track' : 'Release',
    fileFormat:
      item.medium.format && !isManualDigitalPlaceholder(item.medium)
        ? item.medium.format.toUpperCase()
        : 'None recorded',
    digitalState:
      item.medium.type === 'digital'
        ? isManualDigitalPlaceholder(item.medium)
          ? 'Digital copy recorded'
          : 'Digital file recorded'
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
    type: target.type === 'track' ? 'Track' : 'Release',
    id: target.id,
    title: target.title,
    subtitle: target.subtitle ?? '',
    releaseId:
      target.releaseId ??
      (target.type === 'release' ? target.id : undefined) ??
      undefined,
    releaseTitle:
      target.releaseTitle ??
      (target.type === 'release' ? target.title : undefined) ??
      undefined,
  }
}
