export type OwnedItemStatus =
  | 'Owned'
  | 'Wanted'
  | 'Sold'
  | 'Needs digitization'
  | 'Not recorded'

export type OwnedItemRecord = {
  id: string
  title: string
  releaseId?: string
  releaseTitle: string
  artist: string
  medium: string
  status: OwnedItemStatus
  statusTone: 'green' | 'amber' | 'blue' | 'gray'
  storage: string
  condition: string
  acquisition: string
  copyNotes: string
  linkedType: 'Release' | 'Track'
  fileFormat: string
  digitalState: string
  digitizationState: string
  tags: string[]
}

export const ownedItemRecords: OwnedItemRecord[] = [
  {
    id: 'selected-ambient-works-cd',
    title: 'Selected Ambient Works CD',
    releaseId: 'selected-ambient-works-85-92',
    releaseTitle: 'Selected Ambient Works 85-92',
    artist: 'Aphex Twin',
    medium: 'CD',
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
    releaseId: 'blue-monday',
    releaseTitle: 'Blue Monday',
    artist: 'New Order',
    medium: '12-inch vinyl',
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
    releaseId: 'the-dfa-remix',
    releaseTitle: 'The DFA Remix',
    artist: 'The DFA',
    medium: 'Digital',
    status: 'Owned',
    statusTone: 'blue',
    storage: 'Digital library',
    condition: 'Metadata incomplete',
    acquisition: 'Imported folder',
    copyNotes:
      'Digital copy retained for remixer and producer credit navigation while metadata is cleaned up.',
    linkedType: 'Release',
    fileFormat: 'MP3',
    digitalState: 'Imported MP3 files',
    digitizationState: 'Digital source only',
    tags: ['digital', 'remixer index', 'metadata cleanup'],
  },
]
