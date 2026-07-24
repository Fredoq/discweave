import type { LocalOriginalCandidateListDto } from './catalogDtoTypes'
import { assertNoCollectionIds, CatalogApiError } from './httpClient'

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
