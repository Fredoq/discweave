import {
  assertNoCollectionIds,
  CatalogApiError,
  sendJson,
} from '../catalog/api/httpClient'

export type LabelDiscogsPreferences = {
  discogsLabelId: string | null
  discogsLabelName: string | null
  prefixes: string[]
}
export type DiscogsLabelCandidate = { externalId: string; name: string }
export type LabelDiscogsRelease = {
  externalId: string
  catalogNumber: string
  artist: string
  title: string
  year: number
  format: string
  matchKind: 'exact' | 'possible' | 'unmatched'
  matches: {
    releaseId: string
    title: string
    inCollection: boolean
    wanted: boolean
  }[]
}
export type LabelDiscogsPage = {
  items: LabelDiscogsRelease[]
  page: number
  pageSize: number
  total: number
  pages: number
  discogsLabelId: string
  discogsLabelName: string
}
const base = (id: string) => `/api/labels/${encodeURIComponent(id)}/discogs`
async function read<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { credentials: 'include', signal })
  if (!response.ok) throw await CatalogApiError.fromResponse(response)
  const value = (await response.json()) as T
  assertNoCollectionIds(value)
  return value
}
export const labelDiscogsApi = {
  preferences: (id: string, signal: AbortSignal) =>
    read<LabelDiscogsPreferences>(`${base(id)}/preferences`, signal),
  search: (id: string, query: string, signal: AbortSignal) =>
    read<{ items: DiscogsLabelCandidate[]; total: number | null }>(
      `${base(id)}/search?${new URLSearchParams({ query })}`,
      signal,
    ),
  save: (
    id: string,
    discogsLabelId: string | null,
    prefixes: string[],
    signal: AbortSignal,
  ) =>
    sendJson<LabelDiscogsPreferences>(
      `${base(id)}/preferences`,
      'PUT',
      { discogsLabelId, prefixes },
      { signal },
    ),
  page: (id: string, page: number, signal: AbortSignal) =>
    read<LabelDiscogsPage>(`${base(id)}/catalog?page=${page}`, signal),
}
