import type { ListResponse, TrackStackTargetDto } from './catalogTypes'
import { getList } from './httpClient'

export type TrackStackTargetSearchRequest = Readonly<{
  sourceTrackId: string
  search?: string
  offset?: number
  limit?: number
}>

export async function searchTrackStackTargets(
  request: TrackStackTargetSearchRequest,
  options: Readonly<{ signal?: AbortSignal }> = {},
): Promise<ListResponse<TrackStackTargetDto>> {
  const params = new URLSearchParams({
    sourceTrackId: request.sourceTrackId,
    offset: String(request.offset ?? 0),
    limit: String(request.limit ?? 20),
  })
  if (request.search !== undefined) params.set('search', request.search)

  return getList<TrackStackTargetDto>(
    `/api/tracks/stack-targets?${params.toString()}`,
    {
      signal: options.signal,
      treatNotFoundAsEmpty: false,
    },
  )
}
