import type {
  EntityRating,
  ExternalSourceReference,
} from '../catalog/catalogApi'

export type ArtistType = 'Person' | 'Band' | 'Project' | 'Alias' | 'Collective'

export type ArtistRelation = {
  type: string
  target: string
  detail: string
}

export type ArtistCredit = {
  role: string
  target: string
  scope: string
}

export type ArtistRecord = {
  id: string
  name: string
  type: ArtistType
  aliases: string[]
  members: string[]
  relationHint: string
  creditHint: string
  relations: ArtistRelation[]
  credits: ArtistCredit[]
  tags: string[]
  summary: string
  ratings?: EntityRating[]
  externalSources?: ExternalSourceReference[]
}

export const artistRecords: ArtistRecord[] = [
  {
    id: 'aphex-twin',
    name: 'Aphex Twin',
    type: 'Alias',
    aliases: ['Richard D. James', 'AFX'],
    members: [],
    relationHint: 'Alias of Richard D. James, related to AFX',
    creditHint: 'Main artist, producer, composer',
    relations: [
      {
        type: 'Alias',
        target: 'Richard D. James',
        detail:
          'Primary catalog identity for selected ambient and IDM releases.',
      },
      {
        type: 'Alias',
        target: 'AFX',
        detail: 'Sibling project used for acid and EP-focused releases.',
      },
    ],
    credits: [
      {
        role: 'Main artist',
        target: 'Selected Ambient Works 85-92',
        scope: 'Release',
      },
      {
        role: 'Composer',
        target: 'Polynomial-C',
        scope: 'Track',
      },
      {
        role: 'Producer',
        target: 'Selected Ambient Works 85-92',
        scope: 'Release',
      },
    ],
    tags: ['ambient', 'idm', 'alias graph'],
    summary:
      'Artist identity used to navigate aliases, production credits and track-level composition links.',
  },
  {
    id: 'the-dfa',
    name: 'The DFA',
    type: 'Project',
    aliases: ['DFA'],
    members: ['James Murphy', 'Tim Goldsworthy'],
    relationHint: 'Production project connected to LCD Soundsystem',
    creditHint: 'Remixer, producer',
    relations: [
      {
        type: 'Member',
        target: 'James Murphy',
        detail: 'Core member and production credit.',
      },
      {
        type: 'Member',
        target: 'Tim Goldsworthy',
        detail: 'Core member and production credit.',
      },
      {
        type: 'Collaboration',
        target: 'LCD Soundsystem',
        detail: 'Shared production and label-adjacent project context.',
      },
    ],
    credits: [
      {
        role: 'Remixer',
        target: 'The DFA Remix',
        scope: 'Credit index',
      },
      {
        role: 'Producer',
        target: 'Dance-punk singles',
        scope: 'Release group',
      },
    ],
    tags: ['remix', 'producer', 'dance-punk'],
    summary:
      'Project-level artist record centered on remix and producer discovery across the archive.',
  },
  {
    id: 'new-order',
    name: 'New Order',
    type: 'Band',
    aliases: [],
    members: [
      'Bernard Sumner',
      'Peter Hook',
      'Stephen Morris',
      'Gillian Gilbert',
    ],
    relationHint: 'Band members linked to Joy Division history',
    creditHint: 'Main artist, producer',
    relations: [
      {
        type: 'Member',
        target: 'Bernard Sumner',
        detail: 'Band member and primary performer credit.',
      },
      {
        type: 'Related group',
        target: 'Joy Division',
        detail: 'Historical relation for member navigation.',
      },
    ],
    credits: [
      {
        role: 'Main artist',
        target: 'Blue Monday',
        scope: 'Release',
      },
      {
        role: 'Producer',
        target: 'Blue Monday',
        scope: 'Release',
      },
    ],
    tags: ['post-punk', 'synth-pop', 'band'],
    summary:
      'Band record for release ownership, member lookup and producer credit navigation.',
  },
]
