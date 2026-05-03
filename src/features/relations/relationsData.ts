export type RelationRecord = {
  id: string
  source: string
  sourceType: string
  target: string
  targetType: string
  relationType: string
  role: string
  context: string
  evidence: string
  linkedEntity: string
  linkedEntityType: 'Artist' | 'Release' | 'Track'
  direction: string
  searchHints: string[]
}

export const relationRecords: RelationRecord[] = [
  {
    id: 'richard-d-james-aphex-twin',
    source: 'Richard D. James',
    sourceType: 'Person',
    target: 'Aphex Twin',
    targetType: 'Alias',
    relationType: 'Alias',
    role: 'Artist identity',
    context:
      'Person and project identity relation used to find credits recorded under either name.',
    evidence: 'Appears in artist aliases and Selected Ambient Works credits.',
    linkedEntity: 'Aphex Twin',
    linkedEntityType: 'Artist',
    direction: 'Bidirectional lookup',
    searchHints: ['alias', 'composer', 'producer', 'aphex twin'],
  },
  {
    id: 'the-dfa-lcd-soundsystem',
    source: 'The DFA',
    sourceType: 'Production team',
    target: 'LCD Soundsystem',
    targetType: 'Artist',
    relationType: 'Remix of',
    role: 'Remixer',
    context:
      'Remixer relation connecting The DFA credit appearances to LCD Soundsystem tracks.',
    evidence: 'Yeah (Pretentious Mix)',
    linkedEntity: 'Yeah (Pretentious Mix)',
    linkedEntityType: 'Track',
    direction: 'Source credit points to target track artist',
    searchHints: ['dfa', 'remixer', 'lcd soundsystem', 'yeah', 'producer'],
  },
  {
    id: 'new-order-blue-monday',
    source: 'Blue Monday 12-inch vinyl',
    sourceType: 'Owned item',
    target: 'Blue Monday',
    targetType: 'Release',
    relationType: 'Concrete copy of',
    role: 'Ownership link',
    context:
      'Owned copy relation keeps a physical item connected to the logical single release.',
    evidence: 'Shelf A3 item marked as needs digitization.',
    linkedEntity: 'Blue Monday',
    linkedEntityType: 'Release',
    direction: 'Owned item points to release',
    searchHints: ['new order', 'vinyl', 'needs digitization', 'factory'],
  },
]
