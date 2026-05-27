import type { OwnedItemRecord } from '../../ownedItems/ownedItemsData'
import type { RelationRecord } from '../../relations/relationsData'
import { activeDictionaries } from './catalogDefaults'
import {
  toArtistRelationRecord,
  toTrackRelationRecord,
} from './catalogEntityMappers'
import { getJson, sendDelete, sendJson } from './httpClient'
import { updateTestCatalogState } from './testCatalogStore'
import { unlinkRelationRecord } from './stateMutationHelpers'
import {
  toArtistRelationTypeCode,
  toConditionCode,
  toMediumRequest,
  toOwnershipStatusCode,
  toTrackRelationTypeCode,
} from './catalogRequestMappers'
import type {
  ArtistDto,
  ArtistRelationDto,
  OwnedItemDto,
  TrackDto,
  TrackRelationDto,
} from './catalogTypes'

export async function loadRelationDetail(
  relationId: string,
): Promise<RelationRecord | null> {
  const encodedId = encodeURIComponent(relationId)
  const artistRelation = await getJson<ArtistRelationDto>(
    `/api/artist-relations/${encodedId}`,
  )

  if (artistRelation) {
    return toArtistRelationRecord(
      artistRelation,
      new Map<string, ArtistDto>(),
      activeDictionaries,
    )
  }

  const trackRelation = await getJson<TrackRelationDto>(
    `/api/track-relations/${encodedId}`,
  )

  if (!trackRelation) {
    return null
  }

  return toTrackRelationRecord(
    trackRelation,
    new Map<string, TrackDto>(),
    activeDictionaries,
  )
}

export async function createOwnedItem(item: OwnedItemRecord) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      ownedItems: [...state.ownedItems, item],
    }))
  ) {
    return
  }

  await sendJson<OwnedItemDto>(
    '/api/owned-items',
    'POST',
    ownedItemRequestPayload(item),
  )
}

export async function updateOwnedItem(item: OwnedItemRecord) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      ownedItems: state.ownedItems.map((record) =>
        record.id === item.id ? item : record,
      ),
    }))
  ) {
    return
  }

  await sendJson(
    `/api/owned-items/${item.id}`,
    'PUT',
    ownedItemRequestPayload(item),
  )
}

export async function deleteOwnedItem(itemId: string) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      ownedItems: state.ownedItems.filter((item) => item.id !== itemId),
      relations: state.relations.map((relation) =>
        unlinkRelationRecord(relation, 'ownedItem', itemId),
      ),
    }))
  ) {
    return
  }

  await sendDelete(`/api/owned-items/${itemId}`, `owned-item:${itemId}`)
}

export async function createRelation(relation: RelationRecord) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      relations: [...state.relations, relation],
    }))
  ) {
    return
  }

  if (
    relation.sourceLink?.kind === 'artist' &&
    relation.targetLink?.kind === 'artist'
  ) {
    await sendJson('/api/artist-relations', 'POST', {
      sourceArtistId: relation.sourceLink.id,
      targetArtistId: relation.targetLink.id,
      type: toArtistRelationTypeCode(relation.relationType),
      startYear: null,
      endYear: null,
    })
    return
  }

  if (
    relation.sourceLink?.kind === 'track' &&
    relation.targetLink?.kind === 'track'
  ) {
    await sendJson('/api/track-relations', 'POST', {
      sourceTrackId: relation.sourceLink.id,
      targetTrackId: relation.targetLink.id,
      type: toTrackRelationTypeCode(relation.relationType),
    })
    return
  }

  throw new Error(
    'Relations must link two existing artists or two existing tracks before saving.',
  )
}

export async function updateRelation(relation: RelationRecord) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      relations: state.relations.map((record) =>
        record.id === relation.id ? relation : record,
      ),
    }))
  ) {
    return
  }

  if (
    relation.sourceLink?.kind === 'artist' &&
    relation.targetLink?.kind === 'artist'
  ) {
    await sendJson(`/api/artist-relations/${relation.id}`, 'PUT', {
      sourceArtistId: relation.sourceLink.id,
      targetArtistId: relation.targetLink.id,
      type: toArtistRelationTypeCode(relation.relationType),
      startYear: null,
      endYear: null,
    })
    return
  }

  if (
    relation.sourceLink?.kind === 'track' &&
    relation.targetLink?.kind === 'track'
  ) {
    await sendJson(`/api/track-relations/${relation.id}`, 'PUT', {
      sourceTrackId: relation.sourceLink.id,
      targetTrackId: relation.targetLink.id,
      type: toTrackRelationTypeCode(relation.relationType),
    })
    return
  }

  throw new Error(
    'Relations must link two existing artists or two existing tracks before saving.',
  )
}

export async function deleteRelation(relation: RelationRecord) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      relations: state.relations
        .filter((record) => record.id !== relation.id)
        .map((record) => unlinkRelationRecord(record, 'relation', relation.id)),
    }))
  ) {
    return
  }

  if (
    relation.sourceLink?.kind === 'artist' &&
    relation.targetLink?.kind === 'artist'
  ) {
    await sendDelete(
      `/api/artist-relations/${relation.id}`,
      `artist-relation:${relation.id}`,
    )
    return
  }

  if (
    relation.sourceLink?.kind === 'track' &&
    relation.targetLink?.kind === 'track'
  ) {
    await sendDelete(
      `/api/track-relations/${relation.id}`,
      `track-relation:${relation.id}`,
    )
    return
  }

  throw new Error(
    'Only artist and track relations can be deleted through the API.',
  )
}

function ownedItemRequestPayload(item: OwnedItemRecord) {
  const target = ownedItemTargetRequest(item)

  return {
    ...target,
    status: toOwnershipStatusCode(item.status),
    medium: toMediumRequest(item.medium),
    condition: toConditionCode(item.condition),
    storageLocation: item.storage,
  }
}

function ownedItemTargetRequest(item: OwnedItemRecord) {
  const targetType =
    item.targetType === 'Track' || item.linkedType === 'Track'
      ? 'track'
      : 'release'
  const targetId =
    targetType === 'track' ? item.targetId : (item.targetId ?? item.releaseId)

  if (!targetId) {
    throw new Error(
      'Owned items must be linked to an existing release or track before saving.',
    )
  }

  return {
    targetType,
    targetId,
  }
}
