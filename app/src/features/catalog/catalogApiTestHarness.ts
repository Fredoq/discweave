import { afterEach, beforeEach, vi } from 'vitest'
import {
  clearCatalogForTests,
  defaultCatalogDictionaries,
  defaultRatingCriteria,
} from './catalogApi'

export function setupCatalogApiAdapterTests() {
  beforeEach(() => {
    Object.defineProperty(globalThis, '__discweaveUseRealCatalogApi', {
      configurable: true,
      value: true,
    })
  })

  afterEach(() => {
    Reflect.deleteProperty(globalThis, '__discweaveUseRealCatalogApi')
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

export type ReleaseOwnedCopyRequestPayload = {
  status?: string
  medium?: {
    type?: string
    description?: string | null
    discCount?: number | null
  }
  condition?: string | null
  storageLocation?: string | null
}

export type ReleaseRequestPayload = {
  tracklist?: Array<Record<string, unknown>>
  ownedCopy?: ReleaseOwnedCopyRequestPayload | null
  ownedCopies?: ReleaseOwnedCopyRequestPayload[]
}

export type OwnedItemRequestPayload = {
  releaseId?: string
  status?: string
  medium?: {
    type?: string
    description?: string | null
    discCount?: number | null
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
