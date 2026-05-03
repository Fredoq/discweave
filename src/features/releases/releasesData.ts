export type ReleaseType = 'Album' | 'Single' | 'EP' | 'Compilation' | 'Other'

export type OwnedCopy = {
  id: string
  medium: string
  status: 'Owned' | 'Wanted' | 'Sold' | 'Needs digitization'
  storage: string
  condition: string
  note: string
}

export type ReleaseRecord = {
  id: string
  title: string
  artist: string
  type: ReleaseType
  year: string
  label: string
  genres: string[]
  tags: string[]
  releaseNotes: string
  ownedCopies: OwnedCopy[]
}

export const releaseRecords: ReleaseRecord[] = [
  {
    id: 'selected-ambient-works-85-92',
    title: 'Selected Ambient Works 85-92',
    artist: 'Aphex Twin',
    type: 'Album',
    year: '1992',
    label: 'Warp',
    genres: ['Ambient', 'IDM'],
    tags: ['archive core', 'lossless'],
    releaseNotes:
      'Logical album release used as the anchor for tracks, credits and owned copies.',
    ownedCopies: [
      {
        id: 'saw-digital',
        medium: 'Digital',
        status: 'Owned',
        storage: 'Digital library',
        condition: 'Verified FLAC metadata',
        note: 'Lossless local files with track metadata.',
      },
      {
        id: 'saw-cd',
        medium: 'CD',
        status: 'Owned',
        storage: 'CD shelf B1',
        condition: 'Very Good',
        note: 'Physical copy stored separately from release metadata.',
      },
    ],
  },
  {
    id: 'blue-monday',
    title: 'Blue Monday',
    artist: 'New Order',
    type: 'Single',
    year: '1983',
    label: 'Factory',
    genres: ['Synth-pop', 'Post-punk'],
    tags: ['12-inch', 'version candidate'],
    releaseNotes:
      'Single release with a concrete vinyl copy that still needs digitization.',
    ownedCopies: [
      {
        id: 'blue-monday-vinyl',
        medium: '12-inch vinyl',
        status: 'Needs digitization',
        storage: 'Shelf A3',
        condition: 'Sleeve: Good, Media: Very Good',
        note: 'Owned physical item waiting for a digital transfer.',
      },
    ],
  },
  {
    id: 'the-dfa-remix',
    title: 'The DFA Remix',
    artist: 'The DFA',
    type: 'Compilation',
    year: '2000s',
    label: 'Various',
    genres: ['Dance-punk', 'Remix'],
    tags: ['remixer index', 'producer credits'],
    releaseNotes:
      'Compilation-style reference release for navigating remixer and producer credits.',
    ownedCopies: [
      {
        id: 'dfa-digital',
        medium: 'Digital',
        status: 'Owned',
        storage: 'Digital library',
        condition: 'Metadata incomplete',
        note: 'Mock copy used to show release-to-owned-copy separation.',
      },
    ],
  },
]
