import { describe, expect, it } from 'vitest'
import { applyTrackStackRelation } from './catalogTrackStackState'
import { defaultCatalogDictionaries } from '../features/catalog/catalogApi'
import type {
  CatalogState,
  TrackRelationDto,
} from '../features/catalog/catalogApi'
import type { StackRelationCommand } from '../features/catalog/api/ownedRelationsClient'
import type { TrackRecord } from '../features/tracks/tracksData'

describe('applyTrackStackRelation', () => {
  it('upserts a response into both tracks and the relation graph', () => {
    const state = catalogState()
    const relation = relationResponse()
    const command: StackRelationCommand = {
      sourceTrackId: 'source-track',
      targetRootTrackId: 'target-track',
      relationTypeCode: 'remixOf',
      markTargetAsOriginal: true,
    }

    const first = applyTrackStackRelation(state, relation, command)
    if (!first) throw new Error('Expected relation to apply')
    const second = applyTrackStackRelation(first, relation, command)
    if (!second) throw new Error('Expected repeated relation to apply')

    expect(second.relations).toHaveLength(1)
    expect(second.tracks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'source-track',
          relations: [expect.objectContaining({ relationId: 'relation-1' })],
        }),
        expect.objectContaining({
          id: 'target-track',
          isOriginal: true,
          relations: [expect.objectContaining({ relationId: 'relation-1' })],
        }),
      ]),
    )
  })

  it('rejects a response whose endpoints are not loaded', () => {
    const result = applyTrackStackRelation(
      catalogState(),
      { ...relationResponse(), targetTrackId: 'missing-track' },
      {
        sourceTrackId: 'source-track',
        targetRootTrackId: 'missing-track',
        relationTypeCode: 'remixOf',
        markTargetAsOriginal: false,
      },
    )

    expect(result).toBeNull()
  })
})

function catalogState(): CatalogState {
  return {
    artists: [],
    labels: [],
    releases: [],
    tracks: [track('source-track', 'Source'), track('target-track', 'Target')],
    ownedItems: [],
    relations: [],
    playlists: [],
    dictionaries: defaultCatalogDictionaries,
  }
}

function track(id: string, title: string): TrackRecord {
  return {
    id,
    title,
    artist: 'Artist',
    release: {
      title: 'Release',
      artist: 'Artist',
      year: '2026',
      label: 'Label',
    },
    trackNumber: '1',
    duration: '3:00',
    relationHint: '',
    tags: [],
    credits: [],
    releaseAppearances: [],
    relations: [],
    digitalFiles: [],
  }
}

function relationResponse(): TrackRelationDto {
  return {
    id: 'relation-1',
    sourceTrackId: 'source-track',
    targetTrackId: 'target-track',
    type: 'remixOf',
    sourceTrackTitle: 'Source',
    targetTrackTitle: 'Target',
  }
}
