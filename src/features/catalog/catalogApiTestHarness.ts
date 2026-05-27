import { afterEach, beforeEach, vi } from 'vitest'
import {
  clearCatalogForTests,
  defaultCatalogDictionaries,
  defaultRatingCriteria,
} from './catalogApi'

export function setupCatalogApiAdapterTests() {
  beforeEach(() => {
    Object.defineProperty(globalThis, '__cratebaseUseRealCatalogApi', {
      configurable: true,
      value: true,
    })
  })

  afterEach(() => {
    Reflect.deleteProperty(globalThis, '__cratebaseUseRealCatalogApi')
    clearCatalogForTests()
    vi.unstubAllGlobals()
  })
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

export function defaultDictionaryListResponse() {
  const items = Object.values(defaultCatalogDictionaries).flat()

  return jsonResponse({
    items,
    limit: 100,
    offset: 0,
    total: items.length,
  })
}

export function defaultRatingCriteriaListResponse() {
  return jsonResponse({
    items: defaultRatingCriteria,
    limit: 100,
    offset: 0,
    total: defaultRatingCriteria.length,
  })
}

export function emptyListResponse() {
  return jsonResponse({ items: [], limit: 100, offset: 0, total: 0 })
}

export function dictionaryListResponse(
  mapEntry: (
    entry: (typeof defaultCatalogDictionaries)[keyof typeof defaultCatalogDictionaries][number],
  ) => (typeof defaultCatalogDictionaries)[keyof typeof defaultCatalogDictionaries][number],
) {
  const items = Object.values(defaultCatalogDictionaries).flat().map(mapEntry)

  return jsonResponse({
    items,
    limit: 100,
    offset: 0,
    total: items.length,
  })
}

export type ReleaseRequestPayload = {
  tracklist?: Array<Record<string, unknown>>
}

export type OwnedItemRequestPayload = {
  targetType?: string
  targetId?: string
  status?: string
  medium?: {
    type?: string
    format?: string
  }
  condition?: string | null
  storageLocation?: string | null
}

export function releaseRequestPayload(init: RequestInit | undefined) {
  return requestPayload<ReleaseRequestPayload>(init)
}

export function requestPayload<T>(init: RequestInit | undefined) {
  if (!init || typeof init.body !== 'string') {
    throw new Error('Expected a JSON request body')
  }

  return JSON.parse(init.body) as T
}
