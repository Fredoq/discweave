import type { CreditRole } from '../catalog/creditRoles'
import type {
  EntityRating,
  ExternalSourceReference,
} from '../catalog/catalogApi'
import type { ReleaseCoverImage, ReleaseLabel } from '../releases/releasesData'

export type TrackCredit = {
  artistId?: string
  role: CreditRole
  roles?: CreditRole[]
  artist: string
  scope: string
}

export type TrackRelation = {
  type: string
  target: string
  targetId?: string
  relationId?: string
  detail: string
  direction?: 'outgoing' | 'incoming'
}

export type TrackReleaseAppearance = {
  releaseId?: string
  coverImage?: ReleaseCoverImage
  releaseTitle: string
  releaseArtist: string
  year: string
  label: string
  position: string
  disc?: string
  side?: string
  duration: string
}

export type LocalFileMetadata = {
  ownedItemId?: string
  format: string
  path: string
  bitrate: string
  sampleRate: string
  channels: string
  importedAt: string
  checksum: string
}

export type TrackRecord = {
  id: string
  title: string
  artistId?: string
  artist: string
  release: {
    id?: string
    title: string
    artist: string
    year: string
    releaseDate?: string
    label: string
    labels?: ReleaseLabel[]
    catalogNumber?: string
    genres?: string[]
  }
  trackNumber: string
  disc?: string
  side?: string
  duration: string
  relationHint: string
  genres?: string[]
  tags: string[]
  inheritReleaseArtistCredits?: boolean
  releaseTrackArtistCredits?: TrackCredit[]
  credits: TrackCredit[]
  releaseAppearances: TrackReleaseAppearance[]
  relations: TrackRelation[]
  fileMetadata: LocalFileMetadata
  ratings?: EntityRating[]
  externalSources?: ExternalSourceReference[]
}

export const trackRecords: TrackRecord[] = [
  {
    id: 'polynomial-c',
    title: 'Polynomial-C',
    artist: 'Aphex Twin',
    release: {
      id: 'selected-ambient-works-85-92',
      title: 'Selected Ambient Works 85-92',
      artist: 'Aphex Twin',
      year: '1992',
      label: 'Warp',
    },
    trackNumber: '3',
    duration: '4:44',
    relationHint: 'Appears on release, composer credit, lossless file',
    tags: ['lossless', 'album version', 'IDM'],
    credits: [
      {
        role: 'Composer',
        artist: 'Richard D. James',
        scope: 'Track-level composition credit.',
      },
      {
        role: 'Performer',
        artist: 'Aphex Twin',
        scope: 'Primary track artist on the release.',
      },
    ],
    releaseAppearances: [
      {
        releaseId: 'selected-ambient-works-85-92',
        releaseTitle: 'Selected Ambient Works 85-92',
        releaseArtist: 'Aphex Twin',
        year: '1992',
        label: 'Warp',
        position: '3',
        duration: '4:44',
      },
    ],
    relations: [
      {
        type: 'Appears on',
        target: 'Selected Ambient Works 85-92',
        detail: 'Track 3 on the Warp album release.',
      },
      {
        type: 'Version of',
        target: 'Polynomial-C',
        detail: 'Canonical album version for local file matching.',
      },
    ],
    fileMetadata: {
      ownedItemId: 'owned-polynomial-c-file',
      format: 'FLAC',
      path: '/archive/aphex-twin/selected-ambient-works-85-92/03-polynomial-c.flac',
      bitrate: 'Lossless',
      sampleRate: '44.1 kHz / 16-bit',
      channels: 'Stereo',
      importedAt: 'Mock import',
      checksum: 'sha256: sample-polynomial-c',
    },
  },
  {
    id: 'blue-monday',
    title: 'Blue Monday',
    artist: 'New Order',
    release: {
      id: 'blue-monday',
      title: 'Blue Monday',
      artist: 'New Order',
      year: '1983',
      label: 'Factory',
    },
    trackNumber: 'A',
    duration: '07:29',
    relationHint: 'Owned vinyl needs digitization, version candidate',
    tags: ['12-inch', 'post-punk', 'needs transfer'],
    credits: [
      {
        role: 'Main artist',
        artist: 'New Order',
        scope: 'Primary artist credit on the single.',
      },
      {
        role: 'Producer',
        artist: 'New Order',
        scope: 'Production credit recorded at track level.',
      },
    ],
    releaseAppearances: [
      {
        releaseId: 'blue-monday',
        releaseTitle: 'Blue Monday',
        releaseArtist: 'New Order',
        year: '1983',
        label: 'Factory',
        position: 'A',
        duration: '07:29',
      },
    ],
    relations: [
      {
        type: 'Version of',
        target: 'Blue Monday',
        detail: 'Long 12-inch version linked to the single release.',
      },
      {
        type: 'Needs digitization',
        target: 'Blue Monday 12-inch vinyl',
        detail: 'Physical copy exists without a verified digital transfer.',
      },
    ],
    fileMetadata: {
      format: 'WAV',
      path: '/transfers/new-order/blue-monday-a-side.wav',
      bitrate: '1411 kbps',
      sampleRate: '44.1 kHz / 16-bit',
      channels: 'Stereo',
      importedAt: 'Manual transfer placeholder',
      checksum: 'sha256: sample-blue-monday',
    },
  },
  {
    id: 'yeah-pretentious-mix',
    title: 'Yeah (Pretentious Mix)',
    artist: 'LCD Soundsystem',
    release: {
      id: 'the-dfa-remix',
      title: 'The DFA Remix',
      artist: 'The DFA',
      year: '2000s',
      label: 'Various',
    },
    trackNumber: '8',
    duration: '11:06',
    relationHint: 'Remixer and producer credit index',
    tags: ['remix', 'dance-punk', 'credit graph'],
    credits: [
      {
        role: 'Remixer',
        artist: 'The DFA',
        scope: 'Remix credit used for role-based search.',
      },
      {
        role: 'Producer',
        artist: 'James Murphy',
        scope: 'Producer credit stored as a track contribution.',
      },
    ],
    releaseAppearances: [
      {
        releaseId: 'the-dfa-remix',
        releaseTitle: 'The DFA Remix',
        releaseArtist: 'The DFA',
        year: '2000s',
        label: 'Various',
        position: '8',
        duration: '11:06',
      },
    ],
    relations: [
      {
        type: 'Remix of',
        target: 'Yeah',
        detail:
          'Track version connected to the original LCD Soundsystem track.',
      },
      {
        type: 'Credit appearance',
        target: 'The DFA',
        detail: 'Remixer relation for artist graph navigation.',
      },
    ],
    fileMetadata: {
      format: 'MP3',
      path: '/archive/lcd-soundsystem/dfa-remix/08-yeah-pretentious-mix.mp3',
      bitrate: '320 kbps',
      sampleRate: '44.1 kHz',
      channels: 'Stereo',
      importedAt: 'Mock import',
      checksum: 'sha256: sample-yeah-pretentious-mix',
    },
  },
]
