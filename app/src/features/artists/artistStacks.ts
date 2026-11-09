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
  function connect(source: string, target: string, label: string) {
    const artist = byId.get(target)
    if (!artist || source === target || !byId.has(source)) return
    const items = connections.get(source) ?? []
    if (
      !items.some((item) => item.artist.id === target && item.label === label)
    ) {
      items.push({ artist, label })
      connections.set(source, items)
    }
  }
  for (const relation of relations) {
    if (
      relation.sourceLink?.kind !== 'artist' ||
      relation.targetLink?.kind !== 'artist'
    )
      continue
    const source = relation.sourceLink.id
    const target = relation.targetLink.id
    if (!byId.has(source) || !byId.has(target) || source === target) continue
    const type = relation.relationType.toLowerCase().replace(/[\s_-]/g, '')
    if (type === 'aliasof') {
      connect(source, target, 'Alias of')
      connect(target, source, 'Aliases')
      aliases.set(source, new Set([...(aliases.get(source) ?? []), target]))
      aliases.set(target, new Set([...(aliases.get(target) ?? []), source]))
      aliasTargets.add(target)
      aliasSources.add(source)
    } else {
      connect(
        source,
        target,
        type === 'memberof' ? 'Member of' : relation.relationType,
      )
      connect(
        target,
        source,
        type === 'memberof' ? 'Members' : `${relation.relationType} (incoming)`,
      )
    }
  }
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
  return { connections, familyById }
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
