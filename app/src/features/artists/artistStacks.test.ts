import { describe, expect, it } from 'vitest'
import { buildArtistGraph, visibleArtistStacks } from './artistStacks'
import { artistRecords } from './artistsData'
import { relationRecords } from '../relations/relationsData'

const artists = ['Person', 'Alias', 'Band', 'Person'].map((type, index) => ({
  ...artistRecords[0],
  id: String(index),
  name: index === 3 ? 'Alias' : type,
  type: type as (typeof artistRecords)[number]['type'],
}))
function relation(source: string, target: string, type: string) {
  return {
    ...relationRecords[0],
    id: `${source}-${target}`,
    sourceLink: { kind: 'artist' as const, id: source },
    targetLink: { kind: 'artist' as const, id: target },
    relationType: type,
  }
}
describe('artist stacks', () => {
  it('groups only explicit aliases and preserves groups and same-name artists', () => {
    const graph = buildArtistGraph(artists, [
      relation('1', '0', 'AliasOf'),
      relation('0', '2', 'MemberOf'),
    ])
    const stacks = visibleArtistStacks(artists, graph.familyById)
    expect(stacks.map((stack) => stack.root.id)).toEqual(['0', '2', '3'])
    expect(graph.connections.get('2')).toEqual([
      { artist: artists[0], label: 'Members' },
    ])
    expect(visibleArtistStacks([artists[1]], graph.familyById)[0].root.id).toBe(
      '0',
    )
  })
  it('keeps the matching sorted representative without changing family identity', () => {
    const graph = buildArtistGraph(artists, [relation('1', '0', 'Alias of')])
    const stacks = visibleArtistStacks(
      [artists[1], artists[2], artists[0]],
      graph.familyById,
    )
    expect(stacks.map((stack) => stack.representative.id)).toEqual(['1', '2'])
    expect(stacks[0].root.id).toBe('0')
    expect(
      visibleArtistStacks([artists[1]], graph.familyById)[0].representative
        .type,
    ).toBe('Alias')
  })
  it('handles cycles, duplicate relations, self links and unavailable targets', () => {
    const graph = buildArtistGraph(artists, [
      relation('1', '0', 'Alias of'),
      relation('0', '1', 'Alias of'),
      relation('1', '0', 'Alias of'),
      relation('0', '0', 'Alias of'),
      relation('0', 'missing', 'Alias of'),
    ])
    expect(graph.familyById.get('0')?.artists).toHaveLength(2)
    expect(graph.connections.get('1')).toHaveLength(2)
    expect(graph.familyById.has('missing')).toBe(false)
  })
})
