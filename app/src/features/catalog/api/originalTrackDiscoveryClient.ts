import type {
  ExternalOriginalCandidateListDto,
  ExternalOriginalCandidateRequestDto,
  LocalOriginalCandidateListDto,
} from './catalogDtoTypes'
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
  signal: AbortSignal
}>

export function findExternalOriginalCandidates(
  trackId: string,
  options: FindExternalOriginalCandidatesOptions,
): Promise<ExternalOriginalCandidateListDto> {
  const body: ExternalOriginalCandidateRequestDto = options.providerCodes
    ? { providerCodes: options.providerCodes }
    : {}
  return sendJson(
    `/api/tracks/${encodeURIComponent(trackId)}/original-candidates/external`,
    'POST',
    body,
    { signal: options.signal },
  )
}
