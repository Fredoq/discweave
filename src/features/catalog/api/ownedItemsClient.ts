import type { OwnedItemRecord } from '../../ownedItems/ownedItemsData'
import { activeDictionaries } from './catalogDefaults'
import { toOwnedItemRecord } from './catalogEntityMappers'
import { getList } from './httpClient'
import { pageSize, type ListResponse, type OwnedItemDto } from './catalogTypes'

export type OwnedItemInventoryParams = {
  status?: string
  medium?: string
  condition?: string
  storageLocation?: string
  inventoryView?: string
}

export async function loadOwnedItemInventory(
  params: OwnedItemInventoryParams = {},
): Promise<ListResponse<OwnedItemRecord>> {
  const query = new URLSearchParams(ownedItemInventoryQueryParams(params))
  query.set('limit', String(pageSize))
  query.set('offset', '0')
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

function ownedItemInventoryQueryParams(params: OwnedItemInventoryParams) {
  const result: Record<string, string> = {}

  for (const [key, value] of Object.entries(params)) {
    const trimmed = value?.trim()
    if (trimmed) {
      result[key] = trimmed
    }
  }

  return result
}
