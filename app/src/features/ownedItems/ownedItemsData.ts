export type OwnedItemStatus =
  | 'Owned'
  | 'Wanted'
  | 'Sold'
  | 'Needs digitization'
  | 'Not recorded'

export type OwnedItemTargetRecord = {
  type: 'Release'
  id: string
  title: string
  subtitle: string
  releaseId?: string
  releaseTitle?: string
}

export type OwnedItemMediumType =
  | 'digital'
  | 'vinyl'
  | 'cd'
  | 'cassette'
  | 'other'

export type DigitalFileCoverageRecord = {
  digitalTrackFileLinkId: string
  releaseTrackId: string
  trackId?: string
  trackTitle: string
  position: string
  disc?: string
  side?: string
  localAudioFileId: string
  path: string
  format: string
  codec: string
  quality: string
  size: string
  modifiedAt: string
  contentHash: string
  duration: string
  bitrate: string
  sampleRate: string
  channels: string
}

export type DigitalCopyDetailsRecord = {
  releaseTrackCount: number
  linkedFileCount: number
  missingFileCount: number
  files: DigitalFileCoverageRecord[]
}

export type PhysicalCopyDetailsRecord = {
  formatDescription?: string
  discCount?: number
  tapeType?: string
  name?: string
  storageLocation: string
  condition: string
}

export type OwnedItemRecord = {
  id: string
  title: string
  targetType?: 'Release'
  targetId?: string
  target?: OwnedItemTargetRecord
  releaseId?: string
  releaseTitle: string
  artist: string
  medium: string
  mediumType?: OwnedItemMediumType
  digitalDetails?: DigitalCopyDetailsRecord
  physicalDetails?: PhysicalCopyDetailsRecord
  status: OwnedItemStatus
  statusTone: 'green' | 'amber' | 'blue' | 'gray'
  storage: string
  condition: string
  acquisition: string
  copyNotes: string
  linkedType: 'Release'
  fileFormat: string
  digitalState: string
  digitizationState: string
  tags: string[]
  inventorySignals?: string[]
}

export const inventoryViewOptions = [
  {
    label: 'Physical without digital',
    value: 'physicalWithoutDigital',
  },
  {
    label: 'Lossy without lossless',
    value: 'lossyWithoutLossless',
  },
  {
    label: 'Wanted not owned',
    value: 'wantedNotOwned',
  },
  {
    label: 'Needs digitization',
    value: 'needsDigitization',
  },
] as const

export const collectorSignalLabels: Record<string, string> = {
  digitalWithoutPhysical: 'Digital without physical',
  losslessAvailable: 'Lossless available',
  lossyWithoutLossless: 'Lossy without lossless',
  missingCredits: 'Missing credits',
  needsDigitization: 'Needs digitization',
  owned: 'Owned',
  physicalWithoutDigital: 'Physical without digital',
  wanted: 'Wanted',
  wantedNotOwned: 'Wanted not owned',
}

export function formatCollectorSignal(value: string) {
  return (
    collectorSignalLabels[value] ??
    value.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  )
}

export function isDigitalOwnedItem(item: OwnedItemRecord) {
  return item.mediumType === 'digital' || isDigitalMediumLabel(item.medium)
}

export function isDigitalMediumLabel(value: string) {
  const normalized = value.trim().toLowerCase()

  return (
    normalized === 'digital' ||
    normalized.includes('digital') ||
    normalized.includes('flac') ||
    normalized.includes('alac') ||
    normalized.includes('mp3')
  )
}

export function ownedItemLocationSummary(item: OwnedItemRecord) {
  if (isDigitalOwnedItem(item)) {
    const linkedFileCount = item.digitalDetails?.linkedFileCount ?? 0
    if (linkedFileCount > 0) {
      return `${linkedFileCount} local file${linkedFileCount === 1 ? '' : 's'} linked`
    }

    return 'Digital copy'
  }

  return item.physicalDetails?.storageLocation || item.storage
}

export function ownedItemStateSummary(item: OwnedItemRecord) {
  if (isDigitalOwnedItem(item)) {
    return item.digitalState
  }

  return item.physicalDetails?.condition || item.condition
}

export function digitalCoverageSummary(
  details: DigitalCopyDetailsRecord | undefined,
) {
  if (!details) {
    return 'Digital copy recorded'
  }

  if (details.releaseTrackCount > 0) {
    return `${details.linkedFileCount} / ${details.releaseTrackCount} files linked`
  }

  if (details.linkedFileCount > 0) {
    return `${details.linkedFileCount} local file${details.linkedFileCount === 1 ? '' : 's'} linked`
  }

  return 'No local files linked'
}

export const ownedItemRecords: OwnedItemRecord[] = [
  {
    id: 'selected-ambient-works-cd',
    title: 'Selected Ambient Works CD',
    targetType: 'Release',
    targetId: 'selected-ambient-works-85-92',
    releaseId: 'selected-ambient-works-85-92',
    releaseTitle: 'Selected Ambient Works 85-92',
    artist: 'Aphex Twin',
    medium: 'CD',
    mediumType: 'cd',
    physicalDetails: {
      discCount: 1,
      storageLocation: 'CD shelf B1',
      condition: 'Very Good',
    },
    status: 'Owned',
    statusTone: 'green',
    storage: 'CD shelf B1',
    condition: 'Very Good',
    acquisition: 'Personal collection',
    copyNotes:
      'Physical CD copy stored separately from release metadata and linked to the default collection.',
    linkedType: 'Release',
    fileFormat: 'FLAC',
    digitalState: 'Verified FLAC rip',
    digitizationState: 'Digital copy verified',
    tags: ['lossless', 'physical copy', 'archive core'],
  },
  {
    id: 'blue-monday-vinyl',
    title: 'Blue Monday vinyl',
    targetType: 'Release',
    targetId: 'blue-monday',
    releaseId: 'blue-monday',
    releaseTitle: 'Blue Monday',
    artist: 'New Order',
    medium: '12-inch vinyl',
    mediumType: 'vinyl',
    physicalDetails: {
      formatDescription: '12-inch vinyl',
      storageLocation: 'Shelf A3',
      condition: 'Sleeve: Good, Media: Very Good',
    },
    status: 'Needs digitization',
    statusTone: 'amber',
    storage: 'Shelf A3',
    condition: 'Sleeve: Good, Media: Very Good',
    acquisition: 'Used shop copy',
    copyNotes:
      'Concrete owned copy waiting for a careful transfer before file metadata can be verified.',
    linkedType: 'Release',
    fileFormat: 'None recorded',
    digitalState: 'No verified local file',
    digitizationState: 'Needs digitization',
    tags: ['vinyl', '12-inch', 'needs transfer'],
  },
  {
    id: 'dfa-remix-digital',
    title: 'The DFA Remix digital folder',
    targetType: 'Release',
    targetId: 'the-dfa-remix',
    releaseId: 'the-dfa-remix',
    releaseTitle: 'The DFA Remix',
    artist: 'The DFA',
    medium: 'Digital',
    mediumType: 'digital',
    digitalDetails: {
      releaseTrackCount: 1,
      linkedFileCount: 1,
      missingFileCount: 0,
      files: [
        {
          digitalTrackFileLinkId: 'link-yeah-pretentious-mix-file',
          releaseTrackId: 'release-track-yeah-pretentious-mix',
          trackId: 'yeah-pretentious-mix',
          trackTitle: 'Yeah (Pretentious Mix)',
          position: '8',
          localAudioFileId: 'local-yeah-pretentious-mix-file',
          path: '/archive/lcd-soundsystem/dfa-remix/08-yeah-pretentious-mix.mp3',
          format: 'MP3',
          codec: 'MP3',
          quality: 'Lossy',
          size: 'Not recorded',
          modifiedAt: 'Not recorded',
          contentHash: 'sha256: sample-yeah-pretentious-mix',
          duration: '11:06',
          bitrate: '320 kbps',
          sampleRate: 'Not recorded',
          channels: 'Not recorded',
        },
      ],
    },
    status: 'Owned',
    statusTone: 'blue',
    storage: 'Digital copy',
    condition: '1 / 1 files linked',
    acquisition: 'Imported folder',
    copyNotes:
      'Digital copy retained for remixer and producer credit navigation while metadata is cleaned up.',
    linkedType: 'Release',
    fileFormat: 'MP3',
    digitalState: '1 / 1 files linked',
    digitizationState: 'Digital source only',
    tags: ['digital', 'remixer index', 'metadata cleanup'],
  },
]
