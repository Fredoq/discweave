import type { CatalogDictionaries, TrackStackDto } from '../catalog/catalogApi'
import type { RelationRecord } from '../relations/relationsData'
import type { TrackRecord } from './tracksData'

export const productStackRelationTypeCodes = ['remixOf', 'versionOf'] as const
export const defaultTrackStackRelationTypeCodes = [
  ...productStackRelationTypeCodes,
]

type ProductStackRelationTypeCode =
  (typeof productStackRelationTypeCodes)[number]

type TrackStackMember = {
  track: TrackRecord
  relationType: string
  depth: number
  isDirect: boolean
}

type TrackStackMemberGroup = {
  key: ProductStackRelationTypeCode | 'other'
  label: string
  members: TrackStackMember[]
}

type TrackStackRow = {
  id: string
  original: TrackRecord
  members: TrackStackMember[]
  hasCycleIssue: boolean
}

type StackRelationTypeOption = {
  code: string
  label: string
}

export function trackStackMemberGroups(
  members: TrackStackMember[],
  dictionaries: CatalogDictionaries,
): TrackStackMemberGroup[] {
  const remixMembers: TrackStackMember[] = []
  const versionMembers: TrackStackMember[] = []
  const otherMembers: TrackStackMember[] = []

  for (const member of members) {
    const relationTypeCode = normalizeTrackRelationTypeCode(
      member.relationType,
      dictionaries,
    )

    if (relationTypeCode === 'remixOf') {
      remixMembers.push(member)
    } else if (relationTypeCode === 'versionOf') {
      versionMembers.push(member)
    } else {
      otherMembers.push(member)
    }
  }

  const groups: TrackStackMemberGroup[] = [
    { key: 'remixOf', label: 'Remixes', members: remixMembers },
    { key: 'versionOf', label: 'Versions', members: versionMembers },
    { key: 'other', label: 'Other relations', members: otherMembers },
  ]

  return groups.filter((group) => group.members.length > 0)
}

export function normalizeTrackRelationTypeCode(
  relationType: string,
  dictionaries: CatalogDictionaries,
) {
  const normalized = relationType.trim().toLowerCase()
  const dictionaryEntry = dictionaries.trackRelationType.find(
    (entry) =>
      entry.code.toLowerCase() === normalized ||
      entry.name.toLowerCase() === normalized,
  )

  return dictionaryEntry?.code ?? relationType
}

export function trackRelationTypeDisplay(
  relationType: string,
  dictionaries: CatalogDictionaries,
) {
  const relationTypeCode = normalizeTrackRelationTypeCode(
    relationType,
    dictionaries,
  )
  return (
    dictionaries.trackRelationType.find(
      (entry) => entry.code === relationTypeCode,
    )?.name ?? relationType
  )
}

export function stackRelationTypeOptions(
  stackRelationTypeCodes: string[],
  dictionaries: CatalogDictionaries,
): StackRelationTypeOption[] {
  const relationTypeCodes =
    stackRelationTypeCodes.length > 0
      ? stackRelationTypeCodes
      : [...productStackRelationTypeCodes]

  const options: StackRelationTypeOption[] = []
  const seenCodes = new Set<string>()
  for (const relationTypeCode of relationTypeCodes) {
    const code = normalizeTrackRelationTypeCode(relationTypeCode, dictionaries)
    if (seenCodes.has(code)) {
      continue
    }

    seenCodes.add(code)
    options.push({
      code,
      label: stackRelationTypeChoiceLabel(code, dictionaries),
    })
  }

  return options
}

export function stackRelationTypeChoiceLabel(
  relationTypeCode: string,
  dictionaries: CatalogDictionaries,
) {
  const code = normalizeTrackRelationTypeCode(relationTypeCode, dictionaries)
  if (code === 'remixOf') {
    return 'Remix'
  }
  if (code === 'versionOf') {
    return 'Version'
  }

  return (
    dictionaries.trackRelationType.find((entry) => entry.code === code)?.name ??
    relationTypeCode
  )
}

export function canDragStackTrack(
  track: TrackRecord,
  stack: TrackStackRow,
  stackMemberTrackIds: Set<string>,
) {
  return (
    track.id === stack.original.id &&
    stack.members.length === 0 &&
    !stackMemberTrackIds.has(track.id)
  )
}

export function canDropOnStack(sourceTrack: TrackRecord, stack: TrackStackRow) {
  return sourceTrack.id !== stack.original.id
}

export function trackStackRootClassName(
  isSelected: boolean,
  isDropTarget: boolean,
  isHighlighted = false,
) {
  return [
    'track-stack-root',
    isSelected ? 'is-selected' : '',
    isDropTarget ? 'is-drop-target' : '',
    isHighlighted ? 'is-highlighted' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

export function trackStackMemberClassName(
  isSelected: boolean,
  isHighlighted: boolean,
) {
  return [
    'track-stack-member',
    isSelected ? 'is-selected' : '',
    isHighlighted ? 'is-highlighted' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

export function hasStackPath(
  sourceTrackId: string,
  targetTrackId: string,
  relations: RelationRecord[],
  stackRelationTypeCodes: string[],
  dictionaries: CatalogDictionaries,
) {
  const relationTypeCodes =
    stackRelationTypeCodes.length > 0
      ? stackRelationTypeCodes
      : [...productStackRelationTypeCodes]
  const stackRelationTypeCodeSet = new Set(
    relationTypeCodes.map((code) =>
      normalizeTrackRelationTypeCode(code, dictionaries),
    ),
  )
  const outgoing = new Map<string, string[]>()

  for (const relation of relations) {
    const relationTypeCode = normalizeTrackRelationTypeCode(
      relation.relationType,
      dictionaries,
    )
    if (!stackRelationTypeCodeSet.has(relationTypeCode)) {
      continue
    }

    const sourceId =
      relation.sourceLink?.kind === 'track' ? relation.sourceLink.id : null
    const targetId =
      relation.targetLink?.kind === 'track' ? relation.targetLink.id : null
    if (!sourceId || !targetId) {
      continue
    }

    outgoing.set(sourceId, [...(outgoing.get(sourceId) ?? []), targetId])
  }

  const visited = new Set<string>()
  const queue = [sourceTrackId]
  while (queue.length > 0) {
    const trackId = queue.shift()
    if (!trackId || visited.has(trackId)) {
      continue
    }
    if (trackId === targetTrackId) {
      return true
    }

    visited.add(trackId)
    queue.push(...(outgoing.get(trackId) ?? []))
  }

  return false
}

export function stackRelationTypeValues(
  stackRelationTypeCodes: string[],
  dictionaries: CatalogDictionaries,
) {
  const relationTypeCodes =
    stackRelationTypeCodes.length > 0
      ? stackRelationTypeCodes
      : [...productStackRelationTypeCodes]
  const values = new Set<string>()
  for (const relationTypeCode of relationTypeCodes) {
    const code = normalizeTrackRelationTypeCode(relationTypeCode, dictionaries)
    values.add(code)
    const name = dictionaries.trackRelationType.find(
      (entry) => entry.code === code,
    )?.name
    if (name) {
      values.add(name)
    }
  }
  for (const entry of dictionaries.trackRelationType) {
    if (
      values.has(entry.code) ||
      values.has(normalizeTrackRelationTypeCode(entry.name, dictionaries))
    ) {
      values.add(entry.name)
    }
  }
  return values
}

export function buildTrackStacks(
  tracks: TrackRecord[],
  relations: RelationRecord[],
  relationTypeValues: Set<string>,
) {
  const tracksById = new Map(tracks.map((track) => [track.id, track]))
  const incoming = new Map<string, RelationRecord[]>()
  for (const relation of relations) {
    if (!relationTypeValues.has(relation.relationType)) {
      continue
    }
    const sourceTrackId =
      relation.sourceLink?.kind === 'track' ? relation.sourceLink.id : null
    const targetTrackId =
      relation.targetLink?.kind === 'track' ? relation.targetLink.id : null
    if (!sourceTrackId || !targetTrackId || !tracksById.has(sourceTrackId)) {
      continue
    }
    incoming.set(targetTrackId, [
      ...(incoming.get(targetTrackId) ?? []),
      relation,
    ])
  }

  const originals = tracks.filter((track) => track.isOriginal)
  const roots = originals.length > 0 ? originals : tracks
  const memberIds = new Set<string>()
  const stacks = roots.map((root) => {
    const { hasCycleIssue, members } = collectStackMembers(
      root,
      incoming,
      tracksById,
    )
    members.forEach((member) => memberIds.add(member.track.id))
    return {
      id: root.id,
      original: root,
      members,
      hasCycleIssue,
    }
  })
  if (originals.length === 0) {
    return stacks
  }

  return [
    ...stacks,
    ...tracks
      .filter((track) => !track.isOriginal && !memberIds.has(track.id))
      .map((track) => ({
        id: track.id,
        original: track,
        members: [],
        hasCycleIssue: false,
      })),
  ]
}

export function buildTrackStacksFromServer(
  stackDtos: TrackStackDto[],
  tracks: TrackRecord[],
) {
  const tracksById = new Map(tracks.map((track) => [track.id, track]))
  const stackedTrackIds = new Set<string>()
  const rows: TrackStackRow[] = []

  for (const stackDto of stackDtos) {
    const original = tracksById.get(stackDto.originalTrackId)
    if (!original) {
      continue
    }

    stackedTrackIds.add(original.id)

    const members = stackDto.members.flatMap((memberDto) => {
      const track = tracksById.get(memberDto.trackId)
      if (!track) {
        return []
      }

      stackedTrackIds.add(track.id)

      return [
        {
          track,
          relationType: memberDto.relationType,
          depth: memberDto.depth,
          isDirect: memberDto.isDirect,
        },
      ]
    })

    rows.push({
      id: original.id,
      original,
      members,
      hasCycleIssue: stackDto.hasCycleIssue,
    })
  }

  return [
    ...rows,
    ...tracks
      .filter((track) => !stackedTrackIds.has(track.id))
      .map((track) => ({
        id: track.id,
        original: track,
        members: [],
        hasCycleIssue: false,
      })),
  ]
}

function collectStackMembers(
  root: TrackRecord,
  incoming: Map<string, RelationRecord[]>,
  tracksById: Map<string, TrackRecord>,
) {
  const members: TrackStackMember[] = []
  const visited = new Set<string>()
  let hasCycleIssue = false
  const queue: Array<{ trackId: string; depth: number; path: string[] }> = [
    { trackId: root.id, depth: 0, path: [root.id] },
  ]

  while (queue.length > 0) {
    const node = queue.shift()
    if (!node) {
      continue
    }
    for (const relation of incoming.get(node.trackId) ?? []) {
      const sourceTrackId =
        relation.sourceLink?.kind === 'track' ? relation.sourceLink.id : null
      if (!sourceTrackId || node.path.includes(sourceTrackId)) {
        hasCycleIssue = true
        continue
      }
      const track = tracksById.get(sourceTrackId)
      if (!track || visited.has(sourceTrackId)) {
        continue
      }
      visited.add(sourceTrackId)
      members.push({
        track,
        relationType: relation.relationType,
        depth: node.depth + 1,
        isDirect: node.depth === 0,
      })
      queue.push({
        trackId: sourceTrackId,
        depth: node.depth + 1,
        path: [...node.path, sourceTrackId],
      })
    }
  }

  return {
    hasCycleIssue,
    members: members.toSorted((left, right) => {
      return (
        left.depth - right.depth ||
        left.track.title.localeCompare(right.track.title)
      )
    }),
  }
}
