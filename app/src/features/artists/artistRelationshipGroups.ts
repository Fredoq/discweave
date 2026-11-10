import type { CatalogLinkData } from '../catalog/catalogLinks'
import type { RelationRecord } from '../relations/relationsData'
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

type RelationshipContext = {
  byId: Map<string, ArtistRecord>
  byName: Map<string, ArtistRecord[]>
  groups: ArtistRelationshipGroup[]
  references: ArtistRelationshipReference[]
  connections: Connection[]
}

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
  const context: RelationshipContext = {
    byId,
    byName: indexArtistNames(byId.values()),
    groups: titles.map((title) => ({ key: title, title, items: [] })),
    references: [],
    connections: [],
  }

  addExplicitRelationships(context, artist.id, catalogData.relations ?? [])
  addAliasFamily(context, artist.id, graph)
  addArtistNotes(context, artist)
  addReverseNotes(context, artist)

  return {
    groups: context.groups.filter((group) => group.items.length > 0),
    references: context.references,
  }
}

function indexArtistNames(artists: Iterable<ArtistRecord>) {
  const byName = new Map<string, ArtistRecord[]>()
  for (const artist of artists) {
    const name = normalizeName(artist.name)
    if (name) byName.set(name, [...(byName.get(name) ?? []), artist])
  }
  return byName
}

function linkedItem(
  groups: ArtistRelationshipGroup[],
  target: ArtistRecord,
  index: number,
) {
  const group = groups[index]
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

function explicitConnection(
  artistId: string,
  relation: RelationRecord,
  byId: Map<string, ArtistRecord>,
): Connection | null {
  const { sourceLink, targetLink } = relation
  if (
    sourceLink?.kind !== 'artist' ||
    targetLink?.kind !== 'artist' ||
    sourceLink.id === targetLink.id ||
    !byId.has(sourceLink.id) ||
    !byId.has(targetLink.id)
  )
    return null

  const type = normalizeType(relation.relationType)
  if (sourceLink.id === artistId)
    return { artistId: targetLink.id, type, direction: 'outgoing' }
  if (targetLink.id === artistId)
    return { artistId: sourceLink.id, type, direction: 'incoming' }
  return null
}

function addExplicitRelationships(
  context: RelationshipContext,
  artistId: string,
  relations: RelationRecord[],
) {
  for (const relation of relations) {
    const connection = explicitConnection(artistId, relation, context.byId)
    if (!connection) continue

    const { type, direction } = connection
    context.connections.push(connection)
    const item = linkedItem(
      context.groups,
      context.byId.get(connection.artistId)!,
      groupIndex(type, direction),
    )
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
}

function addAliasFamily(
  context: RelationshipContext,
  artistId: string,
  graph: ArtistGraph,
) {
  for (const relative of graph.familyById.get(artistId)?.artists ?? []) {
    if (relative.id === artistId || !context.byId.has(relative.id)) continue
    const item = linkedItem(context.groups, relative, 0)
    if (!item.notes.length) {
      addNote(
        item.notes,
        'Related identity',
        'Connected through an alias family; no direct alias relationship.',
        'indirect',
      )
    }
  }
}

function attachNote(
  context: RelationshipContext,
  target: ArtistRecord,
  relation: ArtistRelation,
  direction: Direction,
) {
  const type = normalizeType(relation.type)
  if (
    !context.connections.some(
      (connection) =>
        connection.artistId === target.id &&
        connection.type === type &&
        connection.direction === direction,
    )
  )
    return false

  const item = linkedItem(context.groups, target, groupIndex(type, direction))
  addNote(
    item.notes,
    relationLabel(relation.type, direction),
    relation.detail,
    direction,
  )
  return true
}

function addReference(
  context: RelationshipContext,
  label: string,
  relation: ArtistRelation,
  direction: Direction,
) {
  const matches = context.byName.get(normalizeName(label)) ?? []
  const status = matches.length > 1 ? 'Ambiguous name' : 'Unlinked'
  const key = JSON.stringify([label, status])
  let reference = context.references.find((reference) => reference.key === key)
  if (!reference) {
    reference = { key, label, status, notes: [] }
    context.references.push(reference)
  }
  addNote(
    reference.notes,
    relationLabel(relation.type, direction),
    relation.detail,
    direction,
  )
}

function addArtistNotes(context: RelationshipContext, artist: ArtistRecord) {
  for (const relation of artist.relations) {
    const matches = context.byName.get(normalizeName(relation.target)) ?? []
    const direction = relation.direction ?? 'outgoing'
    if (
      matches.length === 1 &&
      attachNote(context, matches[0], relation, direction)
    )
      continue
    addReference(context, relation.target, relation, direction)
  }
}

function addReverseNotes(context: RelationshipContext, artist: ArtistRecord) {
  // Reverse name-only notes can enrich a proven edge, never establish one.
  const selectedName = normalizeName(artist.name)
  const selectedMatches = context.byName.get(selectedName) ?? []
  if (selectedMatches.length !== 1 || selectedMatches[0].id !== artist.id)
    return

  for (const candidate of context.byId.values()) {
    if (candidate.id !== artist.id) {
      addReverseArtistNotes(context, candidate, selectedName)
    }
  }
}

function addReverseArtistNotes(
  context: RelationshipContext,
  candidate: ArtistRecord,
  selectedName: string,
) {
  for (const relation of candidate.relations) {
    if (normalizeName(relation.target) !== selectedName) continue
    const direction =
      relation.direction === 'incoming' ? 'outgoing' : 'incoming'
    if (!attachNote(context, candidate, relation, direction)) {
      addReference(context, candidate.name, relation, direction)
    }
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
