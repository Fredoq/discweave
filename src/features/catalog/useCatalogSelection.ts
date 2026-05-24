import { useEffect, useMemo, useRef, useState } from 'react'
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
  const pendingSelectedRecordIdRef = useRef<string | null>(null)
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

  useEffect(() => {
    const pendingRecordId = pendingSelectedRecordIdRef.current

    if (
      pendingRecordId &&
      (recordIds.has(pendingRecordId) || requestedRecordId !== pendingRecordId)
    ) {
      pendingSelectedRecordIdRef.current = null
    }
  }, [recordIds, requestedRecordId])

  useEffect(() => {
    if (
      requestedRecordId === null ||
      recordIds.has(requestedRecordId) ||
      requestedRecordId === pendingSelectedRecordIdRef.current
    ) {
      return
    }

    replaceSelectionUrl(routePath, queryParam, selectedRecord?.id ?? '')
  }, [queryParam, recordIds, requestedRecordId, routePath, selectedRecord?.id])

  function selectRecord(recordId: string) {
    pendingSelectedRecordIdRef.current = recordIds.has(recordId)
      ? null
      : recordId
    setSelectedRecordId(recordId)
    pushSelectionUrl(routePath, queryParam, recordId)
  }

  return {
    selectedRecord,
    selectedRecordId: effectiveSelectedRecordId,
    selectRecord,
  }
}

function replaceSelectionUrl(
  routePath: AppRoutePath,
  queryParam: string,
  recordId: string,
) {
  const nextSearchParams = new URLSearchParams()

  if (recordId) {
    nextSearchParams.set(queryParam, recordId)
  }

  const nextUrl = nextSearchParams.toString()
    ? `${routePath}?${nextSearchParams.toString()}`
    : routePath
  const currentUrl = `${window.location.pathname}${window.location.search}`

  if (currentUrl !== nextUrl) {
    window.history.replaceState({}, '', nextUrl)
    window.dispatchEvent(new Event('cratebase:navigation'))
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
