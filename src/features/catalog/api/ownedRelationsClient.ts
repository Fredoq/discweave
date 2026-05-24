import type { OwnedItemRecord } from '../../ownedItems/ownedItemsData'
import type { RelationRecord } from '../../relations/relationsData'
import { sendDelete, sendJson } from './httpClient'
import { updateTestCatalogState } from './testCatalogStore'
import { unlinkRelationRecord } from './stateMutationHelpers'
import {
  toArtistRelationTypeCode,
  toConditionCode,
  toMediumRequest,
  toOwnershipStatusCode,
  toTrackRelationTypeCode,
} from './catalogRequestMappers'
import type { OwnedItemDto } from './catalogTypes'

export async function createOwnedItem(item: OwnedItemRecord) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      ownedItems: [...state.ownedItems, item],
    }))
  ) {
    return
  }

  if (!item.releaseId) {
    throw new Error(
      'Owned items must be linked to an existing release before saving.',
    )
  }

  await createOwnedItemForRelease(
    item.releaseId,
    item.medium,
    item.status,
    item.condition,
    item.storage,
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

  await sendJson(`/api/owned-items/${item.id}`, 'PUT', {
    status: toOwnershipStatusCode(item.status),
    condition: toConditionCode(item.condition),
    storageLocation: item.storage,
  })
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

async function createOwnedItemForRelease(
  releaseId: string,
  medium: string,
  status: string,
  condition: string,
  storageLocation: string,
) {
  return sendJson<OwnedItemDto>('/api/owned-items', 'POST', {
    targetType: 'release',
    targetId: releaseId,
    status: toOwnershipStatusCode(status),
    medium: toMediumRequest(medium),
    condition: toConditionCode(condition),
    storageLocation,
  })
}
