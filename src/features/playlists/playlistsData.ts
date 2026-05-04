export type PlaylistType = 'Manual' | 'Smart'

export type PlaylistTrack = {
  id: string
  title: string
  artist: string
  release: {
    id: string
    title: string
    artist: string
    year: string
    label: string
  }
  trackNumber: string
  duration: string
  tags: string[]
  fileFormat: string
  media: string[]
  ownershipStatus: string[]
  availability: string
}

export type LinkedReleaseAvailability = {
  releaseId: string
  title: string
  artist: string
  year: string
  media: string[]
  ownershipStatus: string[]
  availability: string
}

type PlaylistRuleSet = {
  summary: string
  criteria: string[]
}

type ManualSelection = {
  source: string
  note: string
}

type BasePlaylistRecord = {
  id: string
  name: string
  description: string
  curator: string
  updatedAt: string
  yearRange: string
  ruleHints: string[]
  tracks: PlaylistTrack[]
  linkedReleases: LinkedReleaseAvailability[]
}

export type PlaylistRecord =
  | (BasePlaylistRecord & {
      type: 'Manual'
      manualSelection: ManualSelection
    })
  | (BasePlaylistRecord & {
      type: 'Smart'
      smartRules: PlaylistRuleSet
    })

export const playlistRecords: PlaylistRecord[] = [
  {
    id: 'late-night-lossless',
    name: 'Late night lossless shelf',
    type: 'Manual',
    description:
      'Hand-picked quiet tracks from verified files and physical copies.',
    curator: 'Default collection',
    updatedAt: 'Mock update',
    yearRange: '1992-2000s',
    ruleHints: [
      'manual selection',
      'lossless',
      'archive core',
      'physical copy',
    ],
    manualSelection: {
      source: 'Manual track selection',
      note: 'Tracks are selected by the collector; no automatic catalog rule adds or removes entries.',
    },
    tracks: [
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
        tags: ['lossless', 'album version', 'IDM'],
        fileFormat: 'FLAC',
        media: ['Digital', 'CD'],
        ownershipStatus: ['Owned'],
        availability: 'Verified FLAC file and CD copy in CD shelf B1.',
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
        tags: ['remix', 'dance-punk', 'credit graph'],
        fileFormat: 'MP3',
        media: ['Digital'],
        ownershipStatus: ['Owned'],
        availability: 'Imported MP3 folder is owned, metadata cleanup remains.',
      },
    ],
    linkedReleases: [
      {
        releaseId: 'selected-ambient-works-85-92',
        title: 'Selected Ambient Works 85-92',
        artist: 'Aphex Twin',
        year: '1992',
        media: ['Digital', 'CD'],
        ownershipStatus: ['Owned'],
        availability: 'Digital library and CD shelf B1 are available.',
      },
      {
        releaseId: 'the-dfa-remix',
        title: 'The DFA Remix',
        artist: 'The DFA',
        year: '2000s',
        media: ['Digital'],
        ownershipStatus: ['Owned'],
        availability: 'Digital folder available with incomplete metadata.',
      },
      {
        releaseId: 'unfiled-white-label',
        title: 'Unfiled white label',
        artist: 'Unknown artist',
        year: 'Unknown year',
        media: ['Vinyl'],
        ownershipStatus: ['Not recorded'],
        availability:
          'Free-text playlist note only; no catalog release exists yet.',
      },
    ],
  },
  {
    id: 'lossless-idm-digital',
    name: 'Lossless IDM digital',
    type: 'Smart',
    description:
      'Smart playlist for electronic catalog entries where lossless digital files are known.',
    curator: 'Smart criteria',
    updatedAt: 'Generated from mock catalog',
    yearRange: '1990-1999',
    ruleHints: [
      'tags include lossless',
      'media digital',
      'file format FLAC',
      'IDM',
    ],
    smartRules: {
      summary: 'Tags and file criteria select lossless digital IDM tracks.',
      criteria: [
        'Tags include lossless or IDM.',
        'Medium includes Digital.',
        'File format is FLAC.',
        'Ownership status is Owned.',
      ],
    },
    tracks: [
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
        tags: ['lossless', 'album version', 'IDM'],
        fileFormat: 'FLAC',
        media: ['Digital', 'CD'],
        ownershipStatus: ['Owned'],
        availability: 'Matched by FLAC file and owned digital copy.',
      },
    ],
    linkedReleases: [
      {
        releaseId: 'selected-ambient-works-85-92',
        title: 'Selected Ambient Works 85-92',
        artist: 'Aphex Twin',
        year: '1992',
        media: ['Digital', 'CD'],
        ownershipStatus: ['Owned'],
        availability: 'Owned as verified local files and a CD copy.',
      },
    ],
  },
  {
    id: 'needs-digitization-physical',
    name: 'Needs digitization physical',
    type: 'Smart',
    description:
      'Smart playlist for physical media that exists in the collection without a verified digital copy.',
    curator: 'Smart criteria',
    updatedAt: 'Generated from mock ownership state',
    yearRange: '1980-1989',
    ruleHints: [
      'ownership status needs digitization',
      'missing digital copy',
      'vinyl',
      'transfer queue',
    ],
    smartRules: {
      summary:
        'Ownership and availability criteria find physical tracks waiting for transfer.',
      criteria: [
        'Ownership status is Needs digitization.',
        'Medium is vinyl or another physical carrier.',
        'Digital state is missing or not verified.',
        'Track has a linked release with a concrete owned copy.',
      ],
    },
    tracks: [
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
        tags: ['12-inch', 'post-punk', 'needs transfer'],
        fileFormat: 'None recorded',
        media: ['12-inch vinyl'],
        ownershipStatus: ['Needs digitization'],
        availability:
          'Owned vinyl copy exists on Shelf A3, but no verified local file is recorded.',
      },
    ],
    linkedReleases: [
      {
        releaseId: 'blue-monday',
        title: 'Blue Monday',
        artist: 'New Order',
        year: '1983',
        media: ['12-inch vinyl'],
        ownershipStatus: ['Needs digitization'],
        availability:
          'Physical item is available; digital availability is missing until transfer.',
      },
    ],
  },
]
