import {
  defaultCatalogDictionaries,
  type CatalogState,
  type TrackDto,
  type TrackRelationDto,
} from '../features/catalog/catalogApi'
import {
  toTrackRelation,
  toTrackRelationRecord,
} from '../features/catalog/api/catalogEntityMappers'
import type { StackRelationCommand } from '../features/catalog/api/ownedRelationsClient'
import type { TrackRelation } from '../features/tracks/tracksData'

export function applyTrackStackRelation(
  state: CatalogState,
  relation: TrackRelationDto,
  command: StackRelationCommand,
): CatalogState | null {
  if (!relation.id) {
    return null
  }

  const dictionaries = state.dictionaries ?? defaultCatalogDictionaries

  const sourceTrack = state.tracks.find(
    (track) => track.id === relation.sourceTrackId,
  )
  const targetTrack = state.tracks.find(
    (track) => track.id === relation.targetTrackId,
  )
  if (!sourceTrack || !targetTrack) {
    return null
  }

  const relationWithTitles: TrackRelationDto = {
    ...relation,
    sourceTrackTitle: relation.sourceTrackTitle ?? sourceTrack.title,
    targetTrackTitle: relation.targetTrackTitle ?? targetTrack.title,
  }
  const tracksById = new Map<string, TrackDto>()
  const relationRecord = toTrackRelationRecord(
    relationWithTitles,
    tracksById,
    dictionaries,
  )
  const sourceRelation = toTrackRelation(
    relationWithTitles,
    sourceTrack.id,
    tracksById,
    dictionaries,
  )
  const targetRelation = toTrackRelation(
    relationWithTitles,
    targetTrack.id,
    tracksById,
    dictionaries,
  )

  return {
    ...state,
    tracks: state.tracks.map((track) => {
      if (track.id === sourceTrack.id) {
        return {
          ...track,
          relations: upsertTrackRelation(track.relations, sourceRelation),
        }
      }
      if (track.id === targetTrack.id) {
        return {
          ...track,
          isOriginal: command.markTargetAsOriginal ? true : track.isOriginal,
          relations: upsertTrackRelation(track.relations, targetRelation),
        }
      }
      return track
    }),
    relations: upsertRelationRecord(state.relations, relationRecord),
  }
}

function upsertRelationRecord(
  relations: CatalogState['relations'],
  nextRelation: CatalogState['relations'][number],
) {
  const existingIndex = relations.findIndex(
    (relation) => relation.id === nextRelation.id,
  )
  if (existingIndex < 0) {
    return [...relations, nextRelation]
  }

  return relations.map((relation, index) =>
    index === existingIndex ? nextRelation : relation,
  )
}

function upsertTrackRelation(
  relations: TrackRelation[],
  nextRelation: TrackRelation,
) {
  const existingIndex = relations.findIndex(
    (relation) => relation.relationId === nextRelation.relationId,
  )
  if (existingIndex < 0) {
    return [...relations, nextRelation]
  }

  return relations.map((relation, index) =>
    index === existingIndex ? nextRelation : relation,
  )
}
