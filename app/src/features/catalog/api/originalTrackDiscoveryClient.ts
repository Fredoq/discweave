import type {
  ExternalOriginalCandidateListDto,
  ExternalOriginalCandidateRequestDto,
  ExternalOriginalCandidateSearchMode,
  ExternalReleaseDraftRequestDto,
  LocalOriginalCandidateListDto,
} from './catalogDtoTypes'
import type { ReleaseImportSession } from './catalogImportTypes'
import { assertNoCollectionIds, CatalogApiError, sendJson } from './httpClient'

export type ListLocalOriginalCandidatesOptions = Readonly<{
  signal: AbortSignal
}>

export async function listLocalOriginalCandidates(
  trackId: string,
  options: ListLocalOriginalCandidatesOptions,
): Promise<LocalOriginalCandidateListDto> {
  const response = await fetch(
    `/api/tracks/${encodeURIComponent(trackId)}/original-candidates/local`,
    {
      credentials: 'include',
      method: 'GET',
      signal: options.signal,
    },
  )

  if (!response.ok) {
    throw await CatalogApiError.fromResponse(response)
  }

  const body = (await response.json()) as LocalOriginalCandidateListDto
  assertNoCollectionIds(body)
  return body
}

export type FindExternalOriginalCandidatesOptions = Readonly<{
  providerCodes?: readonly string[]
  searchMode?: ExternalOriginalCandidateSearchMode
  signal: AbortSignal
}>

export function findExternalOriginalCandidates(
  trackId: string,
  options: FindExternalOriginalCandidatesOptions,
): Promise<ExternalOriginalCandidateListDto> {
  const body: ExternalOriginalCandidateRequestDto = {
    ...(options.providerCodes ? { providerCodes: options.providerCodes } : {}),
    ...(options.searchMode ? { searchMode: options.searchMode } : {}),
  }
  return sendJson(
    `/api/tracks/${encodeURIComponent(trackId)}/original-candidates/external`,
    'POST',
    body,
    { signal: options.signal },
  )
}

export type CreateExternalReleaseDraftOptions = Readonly<{
  signal: AbortSignal
}>

export function createExternalReleaseDraft(
  request: ExternalReleaseDraftRequestDto,
  options: CreateExternalReleaseDraftOptions,
): Promise<ReleaseImportSession> {
  return sendJson('/api/imports/external-release-drafts', 'POST', request, {
    signal: options.signal,
  })
}
