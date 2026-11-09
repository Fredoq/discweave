import type { ArtistRecord } from './artistsData'
import type { RelationRecord } from '../relations/relationsData'

export type ArtistConnection = { artist: ArtistRecord; label: string }
export type ArtistStack = { root: ArtistRecord; artists: ArtistRecord[] }

export function buildArtistGraph(
  artists: ArtistRecord[],
  relations: RelationRecord[],
) {
  const byId = new Map(artists.map((artist) => [artist.id, artist]))
  const connections = new Map<string, ArtistConnection[]>()
  const aliases = new Map<string, Set<string>>()
  const aliasTargets = new Set<string>()
  const aliasSources = new Set<string>()
  for (const relation of relations) {
    const endpoints = artistEndpoints(relation, byId)
    if (!endpoints) continue
    const { source, target } = endpoints
    const type = relation.relationType.toLowerCase().replace(/[\s_-]/g, '')
    const labels = connectionLabels(type, relation.relationType)
    addConnection(connections, {
      from: source,
      artist: byId.get(target)!,
      label: labels.outgoing,
    })
    addConnection(connections, {
      from: target,
      artist: byId.get(source)!,
      label: labels.incoming,
    })
    if (type === 'aliasof') {
      aliases.set(source, new Set([...(aliases.get(source) ?? []), target]))
      aliases.set(target, new Set([...(aliases.get(target) ?? []), source]))
      aliasTargets.add(target)
      aliasSources.add(source)
    }
  }
  const familyById = buildFamilies(
    artists,
    byId,
    aliases,
    aliasSources,
    aliasTargets,
  )
  return { connections, familyById }
}

function artistEndpoints(
  relation: RelationRecord,
  byId: Map<string, ArtistRecord>,
) {
  if (
    relation.sourceLink?.kind !== 'artist' ||
    relation.targetLink?.kind !== 'artist'
  )
    return null
  const source = relation.sourceLink.id
  const target = relation.targetLink.id
  return source !== target && byId.has(source) && byId.has(target)
    ? { source, target }
    : null
}

function connectionLabels(type: string, originalType: string) {
  if (type === 'aliasof') return { outgoing: 'Alias of', incoming: 'Aliases' }
  if (type === 'memberof') return { outgoing: 'Member of', incoming: 'Members' }
  return { outgoing: originalType, incoming: `${originalType} (incoming)` }
}

function addConnection(
  connections: Map<string, ArtistConnection[]>,
  connection: { from: string; artist: ArtistRecord; label: string },
) {
  const { from, artist, label } = connection
  const items = connections.get(from) ?? []
  if (
    items.some((item) => item.artist.id === artist.id && item.label === label)
  )
    return
  items.push({ artist, label })
  connections.set(from, items)
}

function buildFamilies(
  artists: ArtistRecord[],
  byId: Map<string, ArtistRecord>,
  aliases: Map<string, Set<string>>,
  aliasSources: Set<string>,
  aliasTargets: Set<string>,
) {
  const familyById = new Map<string, ArtistStack>()
  for (const artist of artists) {
    if (familyById.has(artist.id)) continue
    const ids = new Set<string>()
    const pending = [artist.id]
    while (pending.length) {
      const id = pending.pop()!
      if (ids.has(id)) continue
      ids.add(id)
      pending.push(...(aliases.get(id) ?? []))
    }
    const family = [...ids].map((id) => byId.get(id)!)
    const root = [...family].sort(
      (a, b) =>
        Number(aliasSources.has(a.id)) - Number(aliasSources.has(b.id)) ||
        Number(aliasTargets.has(b.id)) - Number(aliasTargets.has(a.id)) ||
        Number(b.type === 'Person') - Number(a.type === 'Person') ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    )[0]
    const stack = { root, artists: family }
    family.forEach((member) => familyById.set(member.id, stack))
  }
  return familyById
}

export function visibleArtistStacks(
  artists: ArtistRecord[],
  families: Map<string, ArtistStack>,
) {
  const seen = new Set<string>()
  return artists.flatMap((artist) => {
    const stack = families.get(artist.id) ?? { root: artist, artists: [artist] }
    if (seen.has(stack.root.id)) return []
    seen.add(stack.root.id)
    return [{ ...stack, representative: artist }]
  })
}
