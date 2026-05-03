export type CatalogEntryType = 'Artist' | 'Release' | 'Track' | 'Owned item'

export type OwnershipStatus =
  | 'Owned'
  | 'Wanted'
  | 'Sold'
  | 'Needs digitization'
  | 'Lossless file'
  | 'Relation focus'

export type CatalogEntry = {
  id: string
  artist: string
  title: string
  type: CatalogEntryType
  year: string
  label: string
  media: string[]
  status: OwnershipStatus
  statusTone: 'green' | 'amber' | 'blue' | 'gray'
  relationHint: string
  credits: string[]
  tags: string[]
  storage: string
  condition: string
  summary: string
}

export const catalogEntries: CatalogEntry[] = [
  {
    id: 'selected-ambient-works-85-92',
    artist: 'Aphex Twin',
    title: 'Selected Ambient Works 85-92',
    type: 'Release',
    year: '1992',
    label: 'Warp',
    media: ['Digital', 'CD'],
    status: 'Owned',
    statusTone: 'green',
    relationHint: 'Main artist, producer, composer',
    credits: ['Main artist', 'Producer', 'Composer'],
    tags: ['ambient', 'idm', 'archive core'],
    storage: 'Digital library, CD shelf B1',
    condition: 'CD: Very Good',
    summary:
      'Album release with digital lossless files and a physical CD copy in the default collection.',
  },
  {
    id: 'polynomial-c',
    artist: 'Aphex Twin',
    title: 'Polynomial-C',
    type: 'Track',
    year: '1992',
    label: 'Warp',
    media: ['Digital', 'CD'],
    status: 'Lossless file',
    statusTone: 'blue',
    relationHint: 'Appears on release, composer credit',
    credits: ['Composer', 'Performer'],
    tags: ['lossless', 'track version'],
    storage: 'Local files /archive/aphex-twin',
    condition: 'Verified FLAC metadata',
    summary:
      'Track-level entry linked to release copies and local lossless audio metadata.',
  },
  {
    id: 'blue-monday',
    artist: 'New Order',
    title: 'Blue Monday',
    type: 'Owned item',
    year: '1983',
    label: 'Factory',
    media: ['12-inch vinyl'],
    status: 'Needs digitization',
    statusTone: 'amber',
    relationHint: '12-inch vinyl, version candidate',
    credits: ['Main artist', 'Producer'],
    tags: ['12-inch', 'post-punk', 'needs transfer'],
    storage: 'Shelf A3',
    condition: 'Sleeve: Good, Media: Very Good',
    summary:
      'A concrete 12-inch vinyl copy that is owned but still waiting for a digital transfer.',
  },
  {
    id: 'the-dfa-remix',
    artist: 'The DFA',
    title: 'The DFA Remix',
    type: 'Artist',
    year: '2000s',
    label: 'Various',
    media: ['Digital', 'Vinyl'],
    status: 'Relation focus',
    statusTone: 'gray',
    relationHint: 'Remixer credit index',
    credits: ['Remixer', 'Producer'],
    tags: ['remix', 'credit graph'],
    storage: 'Credit index',
    condition: 'Reference entity',
    summary:
      'Artist-focused entry used to navigate remixer and producer credits across the collection.',
  },
]
