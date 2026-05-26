import {
  CatalogApiError,
  getAllPages,
  sendDelete,
  sendJson,
} from './httpClient'
import {
  buildCatalogDictionaries,
  defaultCatalogDictionaries,
  defaultRatingCriteria,
  dictionaryKinds,
  setActiveDictionaries,
} from './catalogDefaults'
import { updateTestCatalogState } from './testCatalogStore'
import type {
  CatalogDictionaries,
  DictionaryEntry,
  DictionaryKind,
  EntityRating,
  RatingCriterion,
  RatingTargetType,
  RatingValueDto,
} from './catalogTypes'

export type DictionaryEntryRequest = {
  kind: DictionaryKind
  code: string
  name: string
  sortOrder?: number
  isActive?: boolean
  mediaProfile?: string | null
}

export type DictionaryEntryUpdateRequest = {
  name: string
  sortOrder?: number
  isActive?: boolean
  mediaProfile?: string | null
}

export type RatingCriterionRequest = {
  code: string
  name: string
  targetTypes: RatingTargetType[]
  sortOrder?: number
  isActive?: boolean
}

export type RatingCriterionUpdateRequest = {
  name: string
  targetTypes: RatingTargetType[]
  sortOrder?: number
  isActive?: boolean
}

export async function loadSettingsDictionaries() {
  const response = await getAllPages<DictionaryEntry>(
    '/api/settings/dictionaries',
  )
  const dictionaries = buildCatalogDictionaries(response.items)
  setActiveDictionaries(dictionaries)

  return dictionaries
}

export async function loadRatingCriteria() {
  const response = await getAllPages<RatingCriterion>('/api/rating-criteria')

  return response.items
}

export async function createDictionaryEntry(request: DictionaryEntryRequest) {
  if (
    updateDictionaryState((dictionaries) => ({
      ...dictionaries,
      [request.kind]: [
        ...dictionaries[request.kind],
        {
          id: `${request.kind}:${request.code}`,
          kind: request.kind,
          code: request.code,
          name: request.name,
          sortOrder: request.sortOrder ?? 100,
          isActive: request.isActive ?? true,
          isBuiltin: false,
          isProtected: false,
          mediaProfile: request.mediaProfile,
        },
      ],
    }))
  ) {
    return
  }

  const created = await sendJson<DictionaryEntry>(
    '/api/settings/dictionaries',
    'POST',
    request,
  )
  updateDictionaryState((dictionaries) => ({
    ...dictionaries,
    [created.kind]: [...dictionaries[created.kind], created],
  }))
}

export async function updateDictionaryEntry(
  entryId: string,
  request: DictionaryEntryUpdateRequest,
) {
  if (
    updateDictionaryState((dictionaries) => {
      for (const kind of dictionaryKinds) {
        if (dictionaries[kind].some((entry) => entry.id === entryId)) {
          return {
            ...dictionaries,
            [kind]: dictionaries[kind].map((entry) =>
              entry.id === entryId
                ? {
                    ...entry,
                    name: request.name,
                    sortOrder: request.sortOrder ?? entry.sortOrder,
                    isActive: request.isActive ?? entry.isActive,
                    mediaProfile:
                      entry.kind === 'mediaType'
                        ? request.mediaProfile
                        : entry.mediaProfile,
                  }
                : entry,
            ),
          }
        }
      }

      return dictionaries
    })
  ) {
    return
  }

  const updated = await sendJson<DictionaryEntry>(
    `/api/settings/dictionaries/${entryId}`,
    'PUT',
    request,
  )
  updateDictionaryState((dictionaries) => ({
    ...dictionaries,
    [updated.kind]: dictionaries[updated.kind].map((entry) =>
      entry.id === updated.id ? updated : entry,
    ),
  }))
}

export async function deleteDictionaryEntry(entry: DictionaryEntry) {
  if (
    updateDictionaryState((dictionaries) => ({
      ...dictionaries,
      [entry.kind]: dictionaries[entry.kind].filter(
        (currentEntry) => currentEntry.id !== entry.id,
      ),
    }))
  ) {
    return
  }

  await sendDelete(
    `/api/settings/dictionaries/${entry.id}`,
    `dictionary-entry:${entry.id}`,
  )
  updateDictionaryState((dictionaries) => ({
    ...dictionaries,
    [entry.kind]: dictionaries[entry.kind].filter(
      (currentEntry) => currentEntry.id !== entry.id,
    ),
  }))
}

export async function replaceDictionaryEntry(
  entry: DictionaryEntry,
  replacementCode: string,
) {
  if (
    updateDictionaryState((dictionaries) => ({
      ...dictionaries,
      [entry.kind]: dictionaries[entry.kind].filter(
        (currentEntry) => currentEntry.id !== entry.id,
      ),
    }))
  ) {
    return
  }

  await sendJson<DictionaryEntry>(
    `/api/settings/dictionaries/${entry.id}/replace`,
    'POST',
    { replacementCode },
  )
  updateDictionaryState((dictionaries) => ({
    ...dictionaries,
    [entry.kind]: dictionaries[entry.kind].filter(
      (currentEntry) => currentEntry.id !== entry.id,
    ),
  }))
}

export async function createRatingCriterion(request: RatingCriterionRequest) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      ratingCriteria: [
        ...(state.ratingCriteria ?? defaultRatingCriteria),
        {
          id: `rating-criterion:${request.code}`,
          code: request.code,
          name: request.name,
          targetTypes: request.targetTypes,
          sortOrder: request.sortOrder ?? 100,
          isActive: request.isActive ?? true,
          isBuiltin: false,
          isProtected: false,
        },
      ],
    }))
  ) {
    return
  }

  await sendJson<RatingCriterion>('/api/rating-criteria', 'POST', request)
}

export async function updateRatingCriterion(
  criterionId: string,
  request: RatingCriterionUpdateRequest,
) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      ratingCriteria: (state.ratingCriteria ?? defaultRatingCriteria).map(
        (criterion) =>
          criterion.id === criterionId
            ? {
                ...criterion,
                name: request.name,
                targetTypes: request.targetTypes,
                sortOrder: request.sortOrder ?? criterion.sortOrder,
                isActive: request.isActive ?? criterion.isActive,
              }
            : criterion,
      ),
    }))
  ) {
    return
  }

  await sendJson<RatingCriterion>(
    `/api/rating-criteria/${criterionId}`,
    'PUT',
    request,
  )
}

export async function deleteRatingCriterion(criterion: RatingCriterion) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      ratingCriteria: (state.ratingCriteria ?? defaultRatingCriteria).filter(
        (item) => item.id !== criterion.id,
      ),
      ratings: (state.ratings ?? []).filter(
        (rating) => rating.criterionId !== criterion.id,
      ),
    }))
  ) {
    return
  }

  await sendDelete(
    `/api/rating-criteria/${criterion.id}`,
    `rating-criterion:${criterion.id}`,
  )
}

export async function upsertRating(
  targetType: RatingTargetType,
  targetId: string,
  criterionId: string,
  value: number,
) {
  if (!Number.isInteger(value) || value < 1 || value > 10) {
    throw new Error('Rating value must be an integer from 1 to 10')
  }

  if (
    updateTestCatalogState((state) => {
      const ratings = state.ratings ?? []
      const existing = ratings.find(
        (rating) =>
          rating.targetType === targetType &&
          rating.targetId === targetId &&
          rating.criterionId === criterionId,
      )
      const nextRating: EntityRating = {
        id: existing?.id ?? `rating:${criterionId}:${targetType}:${targetId}`,
        criterionId,
        targetType,
        targetId,
        value,
      }

      return {
        ...state,
        ratings: existing
          ? ratings.map((rating) =>
              rating.id === existing.id ? nextRating : rating,
            )
          : [...ratings, nextRating],
      }
    })
  ) {
    return
  }

  await sendJson<RatingValueDto>(
    `/api/ratings/${targetType}/${targetId}/${criterionId}`,
    'PUT',
    { value },
  )
}

export async function deleteRating(
  targetType: RatingTargetType,
  targetId: string,
  criterionId: string,
) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      ratings: (state.ratings ?? []).filter(
        (rating) =>
          !(
            rating.targetType === targetType &&
            rating.targetId === targetId &&
            rating.criterionId === criterionId
          ),
      ),
    }))
  ) {
    return
  }

  const response = await fetch(
    `/api/ratings/${targetType}/${targetId}/${criterionId}`,
    {
      credentials: 'include',
      method: 'DELETE',
    },
  )

  if (!response.ok) {
    throw await CatalogApiError.fromResponse(response)
  }
}

function updateDictionaryState(
  mutator: (dictionaries: CatalogDictionaries) => CatalogDictionaries,
) {
  return updateTestCatalogState((state) => ({
    ...state,
    dictionaries: mutator(state.dictionaries ?? defaultCatalogDictionaries),
  }))
}
