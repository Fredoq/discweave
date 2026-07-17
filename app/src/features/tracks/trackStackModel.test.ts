import { describe, expect, it } from 'vitest'
import type { TrackStackDto } from '../catalog/api/catalogDtoTypes'
import { defaultCatalogDictionaries } from '../catalog/catalogApi'
import type { RelationRecord } from '../relations/relationsData'
import {
  buildStackRelationCommand,
  buildTrackStackRows,
  canDragStackTrack,
  existingStackRelationTypeCode,
  hasStackPath,
  isEligibleStackSource,
  stackRelationTypeOptions,
  stackRelationTypeValues,
} from './trackStackModel'
import type { TrackRecord } from './tracksData'

describe('track stack assignment model', () => {
  it('allows a top-level track with no members to start stack assignment', () => {
    const { localRows, serverRows, source } = projections()
    expect(isEligibleStackSource(source, localRows)).toBe(true)
    expect(isEligibleStackSource(source, serverRows)).toBe(true)
  })

  it('rejects a stack root that has members', () => {
    const { localRows, root, serverRows } = projections()
    expect(isEligibleStackSource(root, localRows)).toBe(false)
    expect(isEligibleStackSource(root, serverRows)).toBe(false)
  })

  it('rejects a track that is a member of another stack', () => {
    const { localRows, member, serverRows } = projections()
    expect(isEligibleStackSource(member, localRows)).toBe(false)
    expect(isEligibleStackSource(member, serverRows)).toBe(false)
  })

  it('keeps all relation helpers disabled when stack settings are empty', () => {
    const { member, relations, root } = projections()
    expect(stackRelationTypeOptions([], defaultCatalogDictionaries)).toEqual([])
    expect([
      ...stackRelationTypeValues([], defaultCatalogDictionaries),
    ]).toEqual([])
    expect(
      hasStackPath(
        member.id,
        root.id,
        relations,
        [],
        defaultCatalogDictionaries,
      ),
    ).toBe(false)
    expect(
      hasStackPath(root.id, root.id, relations, [], defaultCatalogDictionaries),
    ).toBe(false)
    expect(
      existingStackRelationTypeCode(
        member.id,
        root.id,
        relations,
        [],
        defaultCatalogDictionaries,
      ),
    ).toBeNull()
  })

  it('only lets a standalone row original start a drag', () => {
    const { localRows, member, root, source } = projections()
    const sourceRow = localRows.find((row) => row.original.id === source.id)!
    const rootRow = localRows.find((row) => row.original.id === root.id)!

    expect(canDragStackTrack(source, sourceRow, localRows)).toBe(true)
    expect(canDragStackTrack(root, rootRow, localRows)).toBe(false)
    expect(canDragStackTrack(member, rootRow, localRows)).toBe(false)
  })

  it('builds the identifier command with an explicit promotion flag', () => {
    expect(
      buildStackRelationCommand(
        'source-track',
        'destination-root',
        'remixOf',
        false,
      ),
    ).toEqual({
      sourceTrackId: 'source-track',
      targetRootTrackId: 'destination-root',
      relationTypeCode: 'remixOf',
      markTargetAsOriginal: false,
    })
  })
})

function projections() {
  const source = track('source-track', 'Source Track')
  const root = track('destination-root', 'Destination Root', true)
  const member = track('destination-member', 'Destination Member')
  const tracks = [source, root, member]
  const relations = [relation(member, root)]
  const dto = stackDto(root, member)

  return {
    source,
    root,
    member,
    relations,
    localRows: buildTrackStackRows({
      dictionaries: defaultCatalogDictionaries,
      relations,
      serverStacks: null,
      stackRelationTypeCodes: ['versionOf'],
      tracks,
    }),
    serverRows: buildTrackStackRows({
      dictionaries: defaultCatalogDictionaries,
      relations,
      serverStacks: [dto],
      stackRelationTypeCodes: ['versionOf'],
      tracks,
    }),
  }
}

function track(id: string, title: string, isOriginal = false): TrackRecord {
  return {
    id,
    title,
    artist: 'Test Artist',
    release: {
      title: 'Test Release',
      artist: 'Test Artist',
      year: '1998',
      label: 'Test Label',
    },
    trackNumber: '1',
    duration: '3:46',
    isOriginal,
    relationHint: '',
    tags: [],
    credits: [],
    releaseAppearances: [],
    relations: [],
    digitalFiles: [],
  }
}

function relation(source: TrackRecord, target: TrackRecord): RelationRecord {
  return {
    id: 'relation-version',
    source: source.title,
    sourceLink: { kind: 'track', id: source.id },
    sourceType: 'Track',
    target: target.title,
    targetLink: { kind: 'track', id: target.id },
    targetType: 'Track',
    relationType: 'versionOf',
    role: '',
    context: '',
    evidence: '',
    linkedEntity: target.title,
    linkedEntityLink: { kind: 'track', id: target.id },
    linkedEntityType: 'Track',
    direction: '',
    searchHints: [],
  }
}

function stackDto(root: TrackRecord, member: TrackRecord): TrackStackDto {
  return {
    originalTrackId: root.id,
    originalTitle: root.title,
    originalVersionYear: 1998,
    memberCount: 1,
    hasCycleIssue: false,
    members: [
      {
        trackId: member.id,
        title: member.title,
        versionYear: 1998,
        relationType: 'versionOf',
        depth: 1,
        isDirect: true,
      },
    ],
    issues: [],
  }
}
