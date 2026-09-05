import { useMemo, useState } from 'react'

export type DateAddedSort = 'default' | 'addedNewest' | 'addedOldest'

type DatedRecord = { id: string; recordId?: string; createdAt?: string }

export function dateAdded(record: DatedRecord): number | null {
  if (record.createdAt) {
    const timestamp = Date.parse(record.createdAt)
    if (Number.isFinite(timestamp)) return timestamp
  }
  const id = record.recordId ?? record.id
  // UUIDv7 stores creation time in its first 48 bits; legacy IDs have no date.
  return /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  )
    ? Number.parseInt(id.slice(0, 13).replace('-', ''), 16)
    : null
}

export function sortByDateAdded<T>(
  records: T[],
  sort: DateAddedSort,
  getDate: (record: T) => number | null,
): T[] {
  if (sort === 'default') return records
  return records
    .map((record) => ({ record, date: getDate(record) }))
    .sort((left, right) => {
      if (left.date === null) return right.date === null ? 0 : 1
      if (right.date === null) return -1
      return (left.date - right.date) * (sort === 'addedNewest' ? -1 : 1)
    })
    .map(({ record }) => record)
}

export function readSavedDateAddedSort(workspace: string): DateAddedSort {
  try {
    const value = window.localStorage.getItem(`discweave.sort.${workspace}`)
    return value === 'addedNewest' || value === 'addedOldest'
      ? value
      : 'default'
  } catch {
    return 'default'
  }
}

export function saveDateAddedSort(workspace: string, sort: DateAddedSort) {
  try {
    window.localStorage.setItem(`discweave.sort.${workspace}`, sort)
  } catch {
    // Sorting still works when browser storage is unavailable.
  }
}

export function useDateAddedSortPreference(workspace: string) {
  const [sort, setSort] = useState(() => readSavedDateAddedSort(workspace))
  function updateSort(value: DateAddedSort) {
    saveDateAddedSort(workspace, value)
    setSort(value)
  }
  return [sort, updateSort] as const
}

export function useDateAddedSort<T extends DatedRecord>(
  records: T[],
  workspace: string,
) {
  const [sort, setSort] = useDateAddedSortPreference(workspace)
  const sortedRecords = useMemo(
    () => sortByDateAdded(records, sort, dateAdded),
    [records, sort],
  )
  return { sort, setSort, sortedRecords }
}
