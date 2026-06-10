import type { OwnedItemRecord } from '../../ownedItems/ownedItemsData'
import { activeDictionaries } from './catalogDefaults'
import { toOwnedItemRecord } from './catalogEntityMappers'
import { getList, sendJson } from './httpClient'
import {
  pageSize,
  type ListResponse,
  type OwnedItemDto,
  type UpdateDigitalFileRequest,
} from './catalogTypes'

export type OwnedItemInventoryParams = {
  status?: string
  medium?: string
  condition?: string
  storageLocation?: string
  inventoryView?: string
  offset?: number
}

export async function loadOwnedItemInventory(
  params: OwnedItemInventoryParams = {},
): Promise<ListResponse<OwnedItemRecord>> {
  const query = new URLSearchParams(ownedItemInventoryQueryParams(params))
  query.set('limit', String(pageSize))
  query.set('offset', String(params.offset ?? 0))
  const response = await getList<OwnedItemDto>(
    `/api/owned-items?${query.toString()}`,
  )

  return {
    ...response,
    items: response.items.map((item) =>
      toOwnedItemRecord(item, new Map(), new Map(), [], [], activeDictionaries),
    ),
  }
}

export async function updateOwnedItemDigitalFile(
  ownedItemId: string,
  request: UpdateDigitalFileRequest,
) {
  return sendJson<OwnedItemDto>(
    `/api/owned-items/${encodeURIComponent(ownedItemId)}/digital-file`,
    'PATCH',
    request,
  )
}

function ownedItemInventoryQueryParams(params: OwnedItemInventoryParams) {
  const result: Record<string, string> = {}

  for (const [key, value] of Object.entries(params)) {
    if (typeof value !== 'string') {
      continue
    }

    const trimmed = value.trim()
    if (trimmed) {
      result[key] = trimmed
    }
  }

  return result
}
