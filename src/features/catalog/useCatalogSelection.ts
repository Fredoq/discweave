import { useMemo, useState } from 'react'
import type { AppRoutePath } from '../../app/routes'

type CatalogSelectionRecord = {
  id: string
}

type UseCatalogSelectionOptions<TRecord extends CatalogSelectionRecord> = {
  locationSearch: string
  queryParam: string
  records: TRecord[]
  routePath: AppRoutePath
  visibleRecords: TRecord[]
}

export function useCatalogSelection<TRecord extends CatalogSelectionRecord>({
  locationSearch,
  queryParam,
  records,
  routePath,
  visibleRecords,
}: UseCatalogSelectionOptions<TRecord>) {
  const recordIds = useMemo(
    () => new Set(records.map((record) => record.id)),
    [records],
  )
  const [selectedRecordId, setSelectedRecordId] = useState('')
  const requestedRecordId = new URLSearchParams(locationSearch).get(queryParam)
  const effectiveSelectedRecordId =
    requestedRecordId !== null
      ? recordIds.has(requestedRecordId)
        ? requestedRecordId
        : (records[0]?.id ?? '')
      : selectedRecordId && recordIds.has(selectedRecordId)
        ? selectedRecordId
        : (records[0]?.id ?? '')

  const selectedRecord =
    visibleRecords.find((record) => record.id === effectiveSelectedRecordId) ??
    visibleRecords[0] ??
    null

  function selectRecord(recordId: string) {
    setSelectedRecordId(recordId)
    pushSelectionUrl(routePath, queryParam, recordId)
  }

  return {
    selectedRecord,
    selectedRecordId: effectiveSelectedRecordId,
    selectRecord,
  }
}

function pushSelectionUrl(
  routePath: AppRoutePath,
  queryParam: string,
  recordId: string,
) {
  const nextSearchParams = new URLSearchParams()
  nextSearchParams.set(queryParam, recordId)

  const nextUrl = `${routePath}?${nextSearchParams.toString()}`
  const currentUrl = `${window.location.pathname}${window.location.search}`

  if (currentUrl !== nextUrl) {
    window.history.pushState({}, '', nextUrl)
    window.dispatchEvent(new Event('cratebase:navigation'))
  }
}
