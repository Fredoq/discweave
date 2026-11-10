import type { CatalogLinkData } from '../catalog/catalogLinks'
import type { ArtistGraph } from './artistConnectionGroups'
import type { ArtistRecord, ArtistRelation } from './artistsData'
import { buildArtistGraph } from './artistStacks'

export type ArtistRelationshipNote = {
  key: string
  role: string
  detail: string
  direction: 'incoming' | 'outgoing' | 'indirect'
}

export type ArtistRelationshipItem = {
  key: string
  artistId: string
  label: string
  type: ArtistRecord['type']
  notes: ArtistRelationshipNote[]
}

export type ArtistRelationshipGroup = {
  key: string
  title: string
  items: ArtistRelationshipItem[]
}

export type ArtistRelationshipReference = {
  key: string
  label: string
  status: 'Unlinked' | 'Ambiguous name'
  notes: ArtistRelationshipNote[]
}

type Direction = 'incoming' | 'outgoing'
type Connection = {
  artistId: string
  type: string
  direction: Direction
}

const titles = [
  'Identities & Aliases',
  'Groups & Projects',
  'Members',
  'Other connections',
] as const

export function buildArtistRelationshipGroups(
  artist: ArtistRecord,
  catalogData: CatalogLinkData,
  graph: ArtistGraph = buildArtistGraph(
    catalogData.artists,
    catalogData.relations ?? [],
  ),
): {
  groups: ArtistRelationshipGroup[]
  references: ArtistRelationshipReference[]
} {
  const byId = new Map(catalogData.artists.map((record) => [record.id, record]))
  const byName = new Map<string, ArtistRecord[]>()

  for (const record of byId.values()) {
    const name = normalizeName(record.name)
    if (name) byName.set(name, [...(byName.get(name) ?? []), record])
  }

  const groups = titles.map((title) => ({
    key: title,
    title,
    items: [] as ArtistRelationshipItem[],
  }))
  const references: ArtistRelationshipReference[] = []
  const connections: Connection[] = []

  function linkedItem(target: ArtistRecord, groupIndex: number) {
    const group = groups[groupIndex]
    let item = group.items.find((item) => item.artistId === target.id)
    if (!item) {
      item = {
        key: JSON.stringify([group.key, target.id]),
        artistId: target.id,
        label: target.name,
        type: target.type,
        notes: [],
      }
      group.items.push(item)
    }
    return item
  }

  for (const relation of catalogData.relations ?? []) {
    if (
      relation.sourceLink?.kind !== 'artist' ||
      relation.targetLink?.kind !== 'artist' ||
      relation.sourceLink.id === relation.targetLink.id ||
      !byId.has(relation.sourceLink.id) ||
      !byId.has(relation.targetLink.id)
    )
      continue

    const direction =
      relation.sourceLink.id === artist.id
        ? 'outgoing'
        : relation.targetLink.id === artist.id
          ? 'incoming'
          : null
    if (!direction) continue

    const targetId =
      direction === 'outgoing' ? relation.targetLink.id : relation.sourceLink.id
    const type = normalizeType(relation.relationType)
    connections.push({ artistId: targetId, type, direction })
    const item = linkedItem(byId.get(targetId)!, groupIndex(type, direction))
    addNote(
      item.notes,
      relationLabel(relation.relationType, direction),
      relation.context,
      direction,
    )
    if (relation.role && relation.role !== relation.relationType) {
      addNote(item.notes, relation.role, relation.context, direction)
    }
  }

  for (const relative of graph.familyById.get(artist.id)?.artists ?? []) {
    if (relative.id === artist.id || !byId.has(relative.id)) continue
    const item = linkedItem(relative, 0)
    if (!item.notes.length) {
      addNote(
        item.notes,
        'Related identity',
        'Connected through an alias family; no direct alias relationship.',
        'indirect',
      )
    }
  }

  function attachNote(
    target: ArtistRecord,
    relation: ArtistRelation,
    direction: Direction,
  ) {
    const type = normalizeType(relation.type)
    if (
      !connections.some(
        (connection) =>
          connection.artistId === target.id &&
          connection.type === type &&
          connection.direction === direction,
      )
    )
      return false

    const item = linkedItem(target, groupIndex(type, direction))
    addNote(
      item.notes,
      relationLabel(relation.type, direction),
      relation.detail,
      direction,
    )
    return true
  }

  function addReference(
    label: string,
    relation: ArtistRelation,
    direction: Direction,
  ) {
    const matches = byName.get(normalizeName(label)) ?? []
    const status = matches.length > 1 ? 'Ambiguous name' : 'Unlinked'
    const key = JSON.stringify([label, status])
    let reference = references.find((reference) => reference.key === key)
    if (!reference) {
      reference = { key, label, status, notes: [] }
      references.push(reference)
    }
    addNote(
      reference.notes,
      relationLabel(relation.type, direction),
      relation.detail,
      direction,
    )
  }

  for (const relation of artist.relations) {
    const matches = byName.get(normalizeName(relation.target)) ?? []
    const direction = relation.direction ?? 'outgoing'
    if (matches.length === 1 && attachNote(matches[0], relation, direction))
      continue
    addReference(relation.target, relation, direction)
  }

  // Reverse name-only notes can enrich a proven edge, never establish one.
  const selectedMatches = byName.get(normalizeName(artist.name)) ?? []
  if (selectedMatches.length === 1 && selectedMatches[0].id === artist.id) {
    for (const candidate of byId.values()) {
      if (candidate.id === artist.id) continue
      for (const relation of candidate.relations) {
        if (normalizeName(relation.target) !== normalizeName(artist.name))
          continue
        const direction =
          relation.direction === 'incoming' ? 'outgoing' : 'incoming'
        if (!attachNote(candidate, relation, direction)) {
          addReference(candidate.name, relation, direction)
        }
      }
    }
  }

  return {
    groups: groups.filter((group) => group.items.length > 0),
    references,
  }
}

function groupIndex(type: string, direction: Direction) {
  if (type === 'aliasof') return 0
  if (type === 'memberof') return direction === 'outgoing' ? 1 : 2
  return 3
}

function relationLabel(type: string, direction: Direction) {
  const normalized = normalizeType(type)
  if (normalized === 'aliasof')
    return direction === 'outgoing' ? 'Alias of' : 'Aliases'
  if (normalized === 'memberof')
    return direction === 'outgoing' ? 'Member of' : 'Member'
  return type
}

function addNote(
  notes: ArtistRelationshipNote[],
  role: string,
  detail: string,
  direction: ArtistRelationshipNote['direction'],
) {
  const key = JSON.stringify([role, detail, direction])
  if (!notes.some((note) => note.key === key))
    notes.push({ key, role, detail, direction })
}

function normalizeName(value: string) {
  return value.trim().toLowerCase()
}

function normalizeType(value: string) {
  return value.toLowerCase().replace(/[\s_-]/g, '')
}
