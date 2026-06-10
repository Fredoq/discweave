import { getJson, getList } from './httpClient'
import { pageSize } from './catalogTypes'
import type {
  CatalogGraphContext,
  CatalogLinkLookupItem,
  CatalogLinkLookupParams,
  CatalogSearchParams,
  CatalogSearchResult,
  ListResponse,
  SearchEntityType,
} from './catalogTypes'

export async function searchCatalog(
  params: CatalogSearchParams,
): Promise<ListResponse<CatalogSearchResult>> {
  const searchParams = new URLSearchParams()

  if (params.query?.trim()) {
    searchParams.set('query', params.query.trim())
  }
  if (params.entityType) {
    searchParams.set('entityType', params.entityType)
  }
  if (params.role) {
    searchParams.set('role', params.role)
  }
  if (params.media) {
    searchParams.set('media', params.media)
  }
  if (params.status) {
    searchParams.set('status', params.status)
  }
  if (params.labelId) {
    searchParams.set('labelId', params.labelId)
  }
  if (params.tag) {
    searchParams.set('tag', params.tag)
  }
  if (params.savedView) {
    searchParams.set('savedView', params.savedView)
  }

  searchParams.set('limit', String(params.limit ?? pageSize))
  searchParams.set('offset', String(params.offset ?? 0))

  return getList<CatalogSearchResult>(`/api/search?${searchParams.toString()}`)
}

export async function loadCatalogGraphContext(
  entityType: SearchEntityType,
  entityId: string,
) {
  return getJson<CatalogGraphContext>(
    `/api/catalog-graph/${entityType}/${encodeURIComponent(entityId)}`,
  )
}

export async function loadCatalogLinks({
  query,
  kinds,
  limit,
}: CatalogLinkLookupParams = {}) {
  const params = new URLSearchParams()
  if (query?.trim()) {
    params.set('query', query.trim())
  }
  if (kinds && kinds.length > 0) {
    params.set('kinds', kinds.join(','))
  }
  if (limit !== undefined) {
    params.set('limit', String(limit))
  }

  return (
    (await getJson<{ items: CatalogLinkLookupItem[] }>(
      `/api/catalog-links?${params.toString()}`,
    )) ?? { items: [] }
  )
}
