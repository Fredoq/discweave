import type {
  DigitalCopyDetailsRecord,
  DigitalFileCoverageRecord,
  OwnedItemMediumType,
  OwnedItemRecord,
  OwnedItemTargetRecord,
  PhysicalCopyDetailsRecord,
} from '../../ownedItems/ownedItemsData'
import { digitalCoverageSummary } from '../../ownedItems/ownedItemsData'
import type { ReleaseRecord } from '../../releases/releasesData'
import {
  conditionLabel,
  formatDuration,
  mediumLabel,
  ownedItemCondition,
  ownedItemStorageLocation,
  ownershipStatusLabel,
  statusToneFor,
} from './catalogValueMappers'
import type {
  CatalogDictionaries,
  DigitalFileCoverageDto,
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
  const mediumType = ownedItemMediumType(item.medium.type)
  const digitalDetails = toDigitalCopyDetails(item)
  const physicalDetails = toPhysicalCopyDetails(item, mediumType)
  const digitalState =
    mediumType === 'digital'
      ? digitalCoverageSummary(digitalDetails)
      : 'No digital file recorded'
  const fileFormats = [
    ...new Set(
      (digitalDetails?.files ?? [])
        .map((file) => file.format)
        .filter((format) => format !== 'Not recorded'),
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
    mediumType,
    digitalDetails,
    physicalDetails,
    status,
    statusTone: statusToneFor(status),
    storage:
      mediumType === 'digital'
        ? digitalOwnedItemStorage(digitalDetails)
        : (storageLocation ?? 'No storage recorded'),
    condition:
      mediumType === 'digital' ? digitalState : conditionLabel(condition),
    acquisition: 'Not recorded',
    copyNotes: '',
    linkedType: 'Release',
    fileFormat:
      fileFormats.length > 0 ? fileFormats.join(', ') : 'None recorded',
    digitalState,
    digitizationState:
      status === 'Needs digitization'
        ? 'Needs digitization'
        : 'No digitization state recorded',
    tags: [],
    inventorySignals: item.inventorySignals ?? [],
  }
}

function ownedItemMediumType(value: string): OwnedItemMediumType {
  switch (value) {
    case 'digital':
    case 'vinyl':
    case 'cd':
    case 'cassette':
      return value
    default:
      return 'other'
  }
}

function toDigitalCopyDetails(
  item: OwnedItemDto,
): DigitalCopyDetailsRecord | undefined {
  const details = item.details.digital
  if (!details) {
    return undefined
  }

  return {
    releaseTrackCount: details.releaseTrackCount,
    linkedFileCount: details.linkedFileCount,
    missingFileCount: details.missingFileCount,
    files: details.files.map(toDigitalFileCoverageRecord),
  }
}

function toDigitalFileCoverageRecord(
  file: DigitalFileCoverageDto,
): DigitalFileCoverageRecord {
  return {
    digitalTrackFileLinkId: file.digitalTrackFileLinkId,
    releaseTrackId: file.releaseTrackId,
    trackId: file.trackId ?? undefined,
    trackTitle: file.trackTitle,
    position: file.position.toString(),
    disc: file.disc ?? undefined,
    side: file.side ?? undefined,
    localAudioFileId: file.localAudioFileId,
    path: file.path,
    format: audioText(file.format, { uppercase: true }),
    codec: audioText(file.codec, { uppercase: true }),
    quality: audioText(file.quality),
    size: formatFileSize(file.sizeBytes),
    modifiedAt: file.modifiedAt ?? 'Not recorded',
    contentHash: file.contentHash ?? 'Not recorded',
    duration: formatDuration(file.durationSeconds),
    bitrate: file.bitrateKbps ? `${file.bitrateKbps} kbps` : 'Not recorded',
    sampleRate: file.sampleRateHz
      ? `${formatSampleRate(file.sampleRateHz)} kHz`
      : 'Not recorded',
    channels: formatChannelCount(file.channels),
  }
}

function toPhysicalCopyDetails(
  item: OwnedItemDto,
  mediumType: OwnedItemMediumType,
): PhysicalCopyDetailsRecord | undefined {
  switch (mediumType) {
    case 'vinyl':
      return {
        formatDescription:
          item.details.vinyl?.formatDescription ||
          item.medium.description ||
          'Vinyl',
        storageLocation:
          item.details.vinyl?.storageLocation ?? 'No storage recorded',
        condition: conditionLabel(item.details.vinyl?.condition),
      }
    case 'cd':
      return {
        discCount: item.details.cd?.discCount ?? item.medium.discCount ?? 1,
        storageLocation:
          item.details.cd?.storageLocation ?? 'No storage recorded',
        condition: conditionLabel(item.details.cd?.condition),
      }
    case 'cassette':
      return {
        tapeType: item.details.cassette?.tapeType || 'Cassette',
        storageLocation:
          item.details.cassette?.storageLocation ?? 'No storage recorded',
        condition: conditionLabel(item.details.cassette?.condition),
      }
    case 'other':
      return {
        name: item.details.other?.name || item.medium.description || 'Other',
        storageLocation:
          item.details.other?.storageLocation ?? 'No storage recorded',
        condition: conditionLabel(item.details.other?.condition),
      }
    default:
      return undefined
  }
}

function digitalOwnedItemStorage(
  details: DigitalCopyDetailsRecord | undefined,
) {
  const linkedFileCount = details?.linkedFileCount ?? 0
  if (linkedFileCount > 0) {
    return `${linkedFileCount} local file${linkedFileCount === 1 ? '' : 's'} linked`
  }

  return 'Digital copy'
}

function audioText(
  value: string | null | undefined,
  options: { uppercase?: boolean } = {},
) {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) {
    return 'Not recorded'
  }

  return options.uppercase
    ? trimmed.toUpperCase()
    : trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

function formatFileSize(sizeBytes: number | null | undefined) {
  if (!sizeBytes || sizeBytes <= 0) {
    return 'Not recorded'
  }

  if (sizeBytes < 1024 * 1024) {
    return `${Math.round(sizeBytes / 1024)} KB`
  }

  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`
}

function formatSampleRate(sampleRateHz: number) {
  return Number.isInteger(sampleRateHz / 1000)
    ? `${sampleRateHz / 1000}`
    : (sampleRateHz / 1000).toFixed(1)
}

function formatChannelCount(channels: number | null | undefined) {
  switch (channels) {
    case 1:
      return 'Mono'
    case 2:
      return 'Stereo'
    default:
      return channels ? `${channels} channels` : 'Not recorded'
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
