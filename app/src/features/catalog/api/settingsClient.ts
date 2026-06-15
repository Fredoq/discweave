import {
  CatalogApiError,
  getAllPages,
  getJson,
  sendDelete,
  sendJson,
} from './httpClient'
import {
  buildCatalogDictionaries,
  defaultCatalogDictionaries,
  defaultRatingCriteria,
  defaultTagRoleMappings,
  defaultTrackRelationParserRules,
  dictionaryKinds,
  setActiveDictionaries,
  setActiveTagRoleMappings,
} from './catalogDefaults'
import {
  getInitialCatalogStateForTests,
  updateTestCatalogState,
} from './testCatalogStore'
import type {
  CatalogDictionaries,
  DictionaryEntry,
  DictionaryKind,
  EntityRating,
  NamingProfile,
  NamingProfileRequest,
  RatingCriterion,
  RatingTargetType,
  RatingValueDto,
  ReleaseNamingOverride,
  ReleaseNamingOverrideRequest,
  TagRoleMapping,
  TagRoleMappingRequest,
  TrackRelationParserRule,
  TrackRelationParserRuleRequest,
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

export async function loadNamingProfiles() {
  return getAllPages<NamingProfile>('/api/settings/naming-profiles')
}

export async function loadTagRoleMappings() {
  const testCatalogState = getInitialCatalogStateForTests()
  if (testCatalogState) {
    const items = testCatalogState.tagRoleMappings ?? defaultTagRoleMappings
    setActiveTagRoleMappings(items)

    return {
      items,
      limit: items.length,
      offset: 0,
      total: items.length,
    }
  }

  const response = await getAllPages<TagRoleMapping>(
    '/api/settings/tag-role-mappings',
  )
  setActiveTagRoleMappings(response.items)

  return response
}

export async function loadTrackRelationParserRules() {
  const testCatalogState = getInitialCatalogStateForTests()
  if (testCatalogState) {
    const items =
      testCatalogState.trackRelationParserRules ??
      defaultTrackRelationParserRules

    return {
      items,
      limit: items.length,
      offset: 0,
      total: items.length,
    }
  }

  return getAllPages<TrackRelationParserRule>(
    '/api/settings/track-relation-parser-rules',
  )
}

export async function createTagRoleMapping(request: TagRoleMappingRequest) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      tagRoleMappings: [
        ...(state.tagRoleMappings ?? defaultTagRoleMappings),
        {
          id: `tag-role-mapping:${request.creditRoleCode}`,
          creditRoleCode: request.creditRoleCode,
          tagField: request.tagField,
          sortOrder: request.sortOrder ?? 100,
          isActive: request.isActive ?? true,
          isBuiltin: false,
        },
      ],
    }))
  ) {
    return
  }

  const created = await sendJson<TagRoleMapping>(
    '/api/settings/tag-role-mappings',
    'POST',
    request,
  )
  updateTestCatalogState((state) => ({
    ...state,
    tagRoleMappings: [
      ...(state.tagRoleMappings ?? defaultTagRoleMappings),
      created,
    ],
  }))

  return created
}

export async function createTrackRelationParserRule(
  request: TrackRelationParserRuleRequest,
) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      trackRelationParserRules: [
        ...(state.trackRelationParserRules ?? defaultTrackRelationParserRules),
        {
          id: `track-relation-parser-rule:${request.relationTypeCode}:${request.alias}`,
          relationTypeCode: request.relationTypeCode,
          alias: request.alias,
          matchMode: request.matchMode,
          confidence: request.confidence,
          direction: request.direction,
          sortOrder: request.sortOrder ?? 100,
          isActive: request.isActive ?? true,
          isBuiltin: false,
        },
      ],
    }))
  ) {
    return
  }

  const created = await sendJson<TrackRelationParserRule>(
    '/api/settings/track-relation-parser-rules',
    'POST',
    request,
  )
  updateTestCatalogState((state) => ({
    ...state,
    trackRelationParserRules: [
      ...(state.trackRelationParserRules ?? defaultTrackRelationParserRules),
      created,
    ],
  }))

  return created
}

export async function updateTagRoleMapping(
  mappingId: string,
  request: TagRoleMappingRequest,
) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      tagRoleMappings: (state.tagRoleMappings ?? defaultTagRoleMappings).map(
        (mapping) =>
          mapping.id === mappingId
            ? {
                ...mapping,
                creditRoleCode: request.creditRoleCode,
                tagField: request.tagField,
                sortOrder: request.sortOrder ?? mapping.sortOrder,
                isActive: request.isActive ?? mapping.isActive,
              }
            : mapping,
      ),
    }))
  ) {
    return
  }

  const updated = await sendJson<TagRoleMapping>(
    `/api/settings/tag-role-mappings/${mappingId}`,
    'PUT',
    request,
  )
  updateTestCatalogState((state) => ({
    ...state,
    tagRoleMappings: (state.tagRoleMappings ?? defaultTagRoleMappings).map(
      (mapping) => (mapping.id === updated.id ? updated : mapping),
    ),
  }))

  return updated
}

export async function updateTrackRelationParserRule(
  ruleId: string,
  request: TrackRelationParserRuleRequest,
) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      trackRelationParserRules: (
        state.trackRelationParserRules ?? defaultTrackRelationParserRules
      ).map((rule) =>
        rule.id === ruleId
          ? {
              ...rule,
              relationTypeCode: request.relationTypeCode,
              alias: request.alias,
              matchMode: request.matchMode,
              confidence: request.confidence,
              direction: request.direction,
              sortOrder: request.sortOrder ?? rule.sortOrder,
              isActive: request.isActive ?? rule.isActive,
            }
          : rule,
      ),
    }))
  ) {
    return
  }

  const updated = await sendJson<TrackRelationParserRule>(
    `/api/settings/track-relation-parser-rules/${ruleId}`,
    'PUT',
    request,
  )
  updateTestCatalogState((state) => ({
    ...state,
    trackRelationParserRules: (
      state.trackRelationParserRules ?? defaultTrackRelationParserRules
    ).map((rule) => (rule.id === updated.id ? updated : rule)),
  }))

  return updated
}

export async function deleteTagRoleMapping(mapping: TagRoleMapping) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      tagRoleMappings: (state.tagRoleMappings ?? defaultTagRoleMappings).filter(
        (currentMapping) => currentMapping.id !== mapping.id,
      ),
    }))
  ) {
    return
  }

  await sendDelete(
    `/api/settings/tag-role-mappings/${mapping.id}`,
    `tag-role-mapping:${mapping.id}`,
  )
  updateTestCatalogState((state) => ({
    ...state,
    tagRoleMappings: (state.tagRoleMappings ?? defaultTagRoleMappings).filter(
      (currentMapping) => currentMapping.id !== mapping.id,
    ),
  }))
}

export async function deleteTrackRelationParserRule(
  rule: TrackRelationParserRule,
) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      trackRelationParserRules: (
        state.trackRelationParserRules ?? defaultTrackRelationParserRules
      ).filter((currentRule) => currentRule.id !== rule.id),
    }))
  ) {
    return
  }

  await sendDelete(
    `/api/settings/track-relation-parser-rules/${rule.id}`,
    `track-relation-parser-rule:${rule.id}`,
  )
  updateTestCatalogState((state) => ({
    ...state,
    trackRelationParserRules: (
      state.trackRelationParserRules ?? defaultTrackRelationParserRules
    ).filter((currentRule) => currentRule.id !== rule.id),
  }))
}

export async function createNamingProfile(request: NamingProfileRequest) {
  return sendJson<NamingProfile>(
    '/api/settings/naming-profiles',
    'POST',
    request,
  )
}

export async function updateNamingProfile(
  profileId: string,
  request: NamingProfileRequest,
) {
  return sendJson<NamingProfile>(
    `/api/settings/naming-profiles/${profileId}`,
    'PUT',
    request,
  )
}

export async function deleteNamingProfile(profileId: string) {
  await sendDelete(
    `/api/settings/naming-profiles/${profileId}`,
    `naming-profile:${profileId}`,
  )
}

export async function loadReleaseNamingOverride(releaseId: string) {
  return getJson<ReleaseNamingOverride>(
    `/api/releases/${releaseId}/naming-override`,
  )
}

export async function updateReleaseNamingOverride(
  releaseId: string,
  request: ReleaseNamingOverrideRequest,
) {
  return sendJson<ReleaseNamingOverride>(
    `/api/releases/${releaseId}/naming-override`,
    'PUT',
    request,
  )
}

export async function deleteReleaseNamingOverride(releaseId: string) {
  await sendDelete(
    `/api/releases/${releaseId}/naming-override`,
    `release-naming-override:${releaseId}`,
  )
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
