import type { CreditRole } from '../catalog/creditRoles'
import type {
  EntityRating,
  ExternalSourceReference,
} from '../catalog/catalogApi'

export type ReleaseType = string

export type OwnedCopy = {
  id: string
  medium: string
  status: 'Owned' | 'Wanted' | 'Sold' | 'Needs digitization'
  storage: string
  condition: string
  note: string
}

export type ReleaseArtistCredit = {
  artistId?: string
  artist: string
  role: CreditRole
  roles?: CreditRole[]
}

export type ReleaseLabel = {
  labelId?: string
  name: string
  catalogNumber?: string
  hasNoCatalogNumber: boolean
}

export type ReleaseCoverImage = {
  url: string
  contentType: string
  originalFileName: string
  sizeBytes: number
  sourceType: string
}

export type ReleaseTracklistRow = {
  releaseTrackId?: string
  trackId?: string
  isReleaseOnly: boolean
  title: string
  position: string
  disc?: string
  side?: string
  duration?: string
  artistCredits: ReleaseArtistCredit[]
}

export type ReleaseTracklistSubmissionRow = {
  trackMode?: 'releaseOnly'
  trackId?: string
  title: string
  position: string
  disc?: string
  side?: string
  duration: string
  versionYear?: string
  inheritReleaseArtistCredits: boolean
  artistCredits: ReleaseArtistCredit[]
}

export type ReleaseRecord = {
  id: string
  title: string
  artistId?: string
  artist: string
  artistCredits?: ReleaseArtistCredit[]
  type: ReleaseType
  year: string
  releaseDate?: string
  label: string
  labels?: ReleaseLabel[]
  isVariousArtists?: boolean
  notOnLabel?: boolean
  genres: string[]
  tags: string[]
  releaseNotes: string
  tracklist?: ReleaseTracklistRow[]
  ownedCopies: OwnedCopy[]
  coverImage?: ReleaseCoverImage
  externalSources?: ExternalSourceReference[]
  ratings?: EntityRating[]
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
        storage: '1 local file linked',
        condition: '1 / 1 files linked',
        note: 'Mock digital release copy used to show release-to-owned-copy separation.',
      },
    ],
  },
]
