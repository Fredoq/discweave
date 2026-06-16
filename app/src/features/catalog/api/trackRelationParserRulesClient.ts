import { defaultTrackRelationParserRules } from './catalogDefaults'
import { getAllPages, sendDelete, sendJson } from './httpClient'
import {
  getInitialCatalogStateForTests,
  updateTestCatalogState,
} from './testCatalogStore'
import type {
  TrackRelationParserRule,
  TrackRelationParserRuleRequest,
} from './catalogTypes'

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
