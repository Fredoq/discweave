import { useEffect, useState } from 'react'
import { searchCatalog } from '../catalog/catalogApi'
import type { EntitySuggestion, SearchEntityType } from '../catalog/catalogApi'

const suggestionDelayMs = 180
const minimumQueryLength = 2

export function useImportEntitySuggestions(
  query: string,
  entityType: Extract<SearchEntityType, 'artist' | 'label'>,
) {
  const [suggestionState, setSuggestionState] = useState<{
    entityType: Extract<SearchEntityType, 'artist' | 'label'>
    query: string
    suggestions: EntitySuggestion[]
  }>({ entityType, query: '', suggestions: [] })
  const normalizedQuery = query.trim()

  useEffect(() => {
    if (normalizedQuery.length < minimumQueryLength) {
      return
    }

    let isCurrent = true
    const timeout = window.setTimeout(() => {
      void searchCatalog({
        entityType,
        limit: 5,
        query: normalizedQuery,
      })
        .then((response) => {
          if (!isCurrent) {
            return
          }

          setSuggestionState({
            entityType,
            query: normalizedQuery,
            suggestions: response.items.map((item) => ({
              id: item.id,
              name: item.title,
              match: item.matchedFields[0] ?? 'search',
              identityHint: item.identityHint ?? null,
            })),
          })
        })
        .catch(() => {
          if (isCurrent) {
            setSuggestionState({
              entityType,
              query: normalizedQuery,
              suggestions: [],
            })
          }
        })
    }, suggestionDelayMs)

    return () => {
      isCurrent = false
      window.clearTimeout(timeout)
    }
  }, [entityType, normalizedQuery])

  if (
    normalizedQuery.length < minimumQueryLength ||
    suggestionState.entityType !== entityType ||
    suggestionState.query !== normalizedQuery
  ) {
    return []
  }

  return suggestionState.suggestions
}
