import { describe, expect, it } from 'vitest'
import type { CatalogLinkData } from '../catalog/catalogLinks'
import type { RelationRecord } from '../relations/relationsData'
import type { ArtistRecord, ArtistRelation } from './artistsData'
import { buildArtistRelationshipGroups } from './artistRelationshipGroups'

function artist(
  id: string,
  name = id,
  relations: ArtistRelation[] = [],
): ArtistRecord {
  return {
    id,
    name,
    relations,
    type: 'Person',
    identityHint: null,
    aliases: [],
    members: [],
    relationHint: '',
    creditHint: '',
    credits: [],
    tags: [],
    summary: '',
  }
}

function edge(
  source: string,
  target: string,
  relationType = 'Member of',
  context = '',
  role = '',
): RelationRecord {
  return {
    id: JSON.stringify([source, target, relationType, context, role]),
    source,
    target,
    sourceLink: { kind: 'artist', id: source },
    targetLink: { kind: 'artist', id: target },
    sourceType: 'Artist',
    targetType: 'Artist',
    relationType,
    role,
    context,
    evidence: '',
    linkedEntity: '',
    linkedEntityType: 'Artist',
    direction: '',
    searchHints: [],
  }
}

function data(
  artists: ArtistRecord[],
  relations: RelationRecord[] = [],
): CatalogLinkData {
  return {
    artists,
    relations,
    releases: [],
    tracks: [],
    ownedItems: [],
  }
}

function note(
  target: string,
  detail: string,
  type = 'Member of',
  direction?: ArtistRelation['direction'],
): ArtistRelation {
  return { target, detail, type, direction }
}

describe('buildArtistRelationshipGroups', () => {
  it('groups explicit connections by direction and preserves roles and contexts', () => {
    const selected = artist('person')
    const result = buildArtistRelationshipGroups(
      selected,
      data(
        [
          selected,
          artist('alias'),
          artist('band'),
          artist('member'),
          artist('collaborator'),
        ],
        [
          edge('alias', 'person', 'aliasOf', 'Alternate name'),
          edge('person', 'band', 'memberOf', 'First era', 'Guitarist'),
          edge('person', 'band', 'Member of', 'Second era', 'Singer'),
          edge('member', 'person'),
          edge('collaborator', 'person', 'Collaborated with', 'Studio session'),
        ],
      ),
    )
    expect(result.groups.map((group) => group.title)).toEqual([
      'Identities & Aliases',
      'Groups & Projects',
      'Members',
      'Other connections',
    ])
    expect(result.groups[1].items).toHaveLength(1)
    expect(
      result.groups[1].items[0].notes.map(({ role, detail }) => [role, detail]),
    ).toEqual([
      ['Member of', 'First era'],
      ['Guitarist', 'First era'],
      ['Member of', 'Second era'],
      ['Singer', 'Second era'],
    ])
    expect(result.groups[3].items[0].notes[0].direction).toBe('incoming')
  })

  it('retains unique details while deduplicating identical notes', () => {
    const selected = artist('person', 'Person', [
      note('Band', 'First era'),
      note('Band', 'Second era'),
      note('Band', 'First era'),
    ])
    const result = buildArtistRelationshipGroups(
      selected,
      data(
        [selected, artist('band', 'Band')],
        [edge('person', 'band', 'Member of', 'First era')],
      ),
    )
    expect(result.references).toEqual([])
    expect(
      result.groups[0].items[0].notes.map((entry) => entry.detail),
    ).toEqual(['First era', 'Second era'])
  })

  it('does not create a link from a unique name match or alias reference', () => {
    const selected = artist('person', 'Person', [
      note('Band', 'First era'),
      note('Identity', 'Identity note', 'aliasOf'),
    ])
    const result = buildArtistRelationshipGroups(
      selected,
      data([selected, artist('band', 'Band'), artist('identity', 'Identity')]),
    )
    expect(result.groups).toEqual([])
    expect(
      result.references.map(({ label, status }) => [label, status]),
    ).toEqual([
      ['Band', 'Unlinked'],
      ['Identity', 'Unlinked'],
    ])
    expect(result.references[1].notes[0].detail).toBe('Identity note')
  })

  it('keeps ambiguous notes separate even when one matching artist has an explicit edge', () => {
    const selected = artist('person', 'Person', [
      note(' Band ', 'Uncertain era'),
    ])
    const result = buildArtistRelationshipGroups(
      selected,
      data(
        [selected, artist('one', 'Band'), artist('two', 'band')],
        [edge('person', 'one')],
      ),
    )
    expect(result.groups[0].items[0].artistId).toBe('one')
    expect(
      result.groups[0].items[0].notes.map((entry) => entry.detail),
    ).not.toContain('Uncertain era')
    expect(result.references[0].status).toBe('Ambiguous name')
  })

  it('requires the same role and direction to attach notes', () => {
    const selected = artist('person', 'Person', [
      note('Band', 'Reverse membership', 'Member of', 'incoming'),
      note('Band', 'Different role', 'Producer'),
      note('Band', 'Matching direction'),
    ])
    const result = buildArtistRelationshipGroups(
      selected,
      data([selected, artist('band', 'Band')], [edge('person', 'band')]),
    )
    expect(result.references[0].notes.map((entry) => entry.detail)).toEqual([
      'Reverse membership',
      'Different role',
    ])
    expect(result.references[0].notes[0].direction).toBe('incoming')
    expect(
      result.groups[0].items[0].notes.map((entry) => entry.detail),
    ).toContain('Matching direction')
  })

  it('does not infer incoming members from duplicate target names', () => {
    const selected = artist('band-one', 'Band')
    const candidate = artist('member', 'Member', [
      note('Band', 'Name-only membership'),
    ])
    const result = buildArtistRelationshipGroups(
      selected,
      data([selected, artist('band-two', 'Band'), candidate]),
    )
    expect(result).toEqual({ groups: [], references: [] })
    const linked = buildArtistRelationshipGroups(
      selected,
      data(
        [selected, artist('band-two', 'Band'), candidate],
        [edge('member', 'band-one')],
      ),
    )
    expect(
      linked.groups[0].items[0].notes.map((entry) => entry.detail),
    ).not.toContain('Name-only membership')
  })

  it('enriches an incoming explicit membership from uniquely resolved reverse notes', () => {
    const selected = artist('band', 'Band')
    const candidate = artist('member', 'Member', [
      note('Band', 'Guitar era'),
      note('Band', 'Vocal era'),
    ])
    const result = buildArtistRelationshipGroups(
      selected,
      data([selected, candidate], [edge('member', 'band')]),
    )
    expect(result.groups[0].title).toBe('Members')
    expect(
      result.groups[0].items[0].notes.map((entry) => entry.detail),
    ).toEqual(['', 'Guitar era', 'Vocal era'])
    expect(
      result.groups[0].items[0].notes.every(
        (entry) => entry.direction === 'incoming',
      ),
    ).toBe(true)
  })

  it('labels indirect alias-family entries without attaching unsupported direct notes', () => {
    const selected = artist('one', 'One', [
      note('Three', 'Unproven direct alias', 'aliasOf'),
    ])
    const result = buildArtistRelationshipGroups(
      selected,
      data(
        [selected, artist('two', 'Two'), artist('three', 'Three')],
        [edge('one', 'two', 'aliasOf'), edge('three', 'two', 'aliasOf')],
      ),
    )
    const indirect = result.groups[0].items.find(
      (item) => item.artistId === 'three',
    )!
    expect(indirect.notes[0].direction).toBe('indirect')
    expect(indirect.notes[0].detail).toContain('no direct alias relationship')
    expect(result.references[0].notes[0].detail).toBe('Unproven direct alias')
  })

  it('ignores missing, non-artist and self-linked endpoints', () => {
    const selected = artist('person')
    const nonArtist = edge('person', 'band')
    nonArtist.targetLink = { kind: 'release', id: 'band' }
    const unlinked = edge('person', 'band')
    delete unlinked.targetLink
    const result = buildArtistRelationshipGroups(
      selected,
      data(
        [selected, artist('band')],
        [
          edge('person', 'missing'),
          edge('person', 'person'),
          nonArtist,
          unlinked,
        ],
      ),
    )
    expect(result).toEqual({ groups: [], references: [] })
  })

  it('keeps each target once per group and stable keys across input reordering', () => {
    const selected = artist('person')
    const records = [selected, artist('band')]
    const edges = [
      edge('person', 'band'),
      edge('person', 'band', 'Producer', 'Session'),
      edge('person', 'band', 'Collaborator', 'Tour'),
    ]
    const first = buildArtistRelationshipGroups(selected, data(records, edges))
    const second = buildArtistRelationshipGroups(
      selected,
      data([...records].reverse(), [...edges].reverse()),
    )
    expect(first.groups).toHaveLength(2)
    expect(first.groups.every((group) => group.items.length === 1)).toBe(true)
    expect(first.groups.map((group) => group.items[0].key)).toEqual(
      second.groups.map((group) => group.items[0].key),
    )
    expect(
      first.groups[1].items[0].notes.map((entry) => entry.key).sort(),
    ).toEqual(second.groups[1].items[0].notes.map((entry) => entry.key).sort())
  })

  it('preserves distinct unlinked notes, roles and both directions', () => {
    const selected = artist('person', 'Person', [
      note('Unknown', 'First', 'aliasOf'),
      note('Unknown', 'Second', 'aliasOf'),
      note('Unknown', 'First', 'aliasOf', 'incoming'),
      note('Unknown', 'First', 'Producer'),
      note('Unknown', 'First', 'aliasOf'),
    ])
    const result = buildArtistRelationshipGroups(selected, data([selected]))
    expect(result.references).toHaveLength(1)
    expect(result.references[0].notes).toHaveLength(4)
    expect(result.references[0].notes.map((entry) => entry.direction)).toEqual([
      'outgoing',
      'outgoing',
      'incoming',
      'outgoing',
    ])
  })

  it('preserves unlinked reverse membership and alias notes as references', () => {
    const selected = artist('person', 'Person', [
      note('Related', 'Existing incoming note', 'aliasOf', 'incoming'),
    ])
    const candidate = artist('related', 'Related', [
      note('Person', 'Membership detail'),
      note('Person', 'Alias detail', 'aliasOf'),
      note('Person', 'Existing incoming note', 'aliasOf'),
      note('Person', 'Reverse direction', 'Producer', 'incoming'),
    ])
    const result = buildArtistRelationshipGroups(
      selected,
      data([selected, candidate]),
    )
    expect(result.groups).toEqual([])
    expect(result.references).toHaveLength(1)
    expect(result.references[0]).toMatchObject({
      label: 'Related',
      status: 'Unlinked',
    })
    expect(
      result.references[0].notes.map(({ role, detail, direction }) => [
        role,
        detail,
        direction,
      ]),
    ).toEqual([
      ['Aliases', 'Existing incoming note', 'incoming'],
      ['Member', 'Membership detail', 'incoming'],
      ['Aliases', 'Alias detail', 'incoming'],
      ['Producer', 'Reverse direction', 'outgoing'],
    ])
  })

  it('marks reverse references with duplicate candidate names as ambiguous', () => {
    const selected = artist('person', 'Person')
    const result = buildArtistRelationshipGroups(
      selected,
      data([
        selected,
        artist('one', 'Related', [note('Person', 'First detail', 'aliasOf')]),
        artist('two', 'Related', [note('Person', 'Second detail', 'aliasOf')]),
      ]),
    )
    expect(result.groups).toEqual([])
    expect(result.references).toHaveLength(1)
    expect(result.references[0].status).toBe('Ambiguous name')
    expect(result.references[0].notes.map((entry) => entry.detail)).toEqual([
      'First detail',
      'Second detail',
    ])
  })

  it('does not attribute reverse unlinked notes to an ambiguous selected name', () => {
    const selected = artist('one', 'Person')
    const result = buildArtistRelationshipGroups(
      selected,
      data([
        selected,
        artist('two', 'Person'),
        artist('related', 'Related', [
          note('Person', 'Membership detail'),
          note('Person', 'Alias detail', 'aliasOf'),
        ]),
      ]),
    )
    expect(result).toEqual({ groups: [], references: [] })
  })
})
