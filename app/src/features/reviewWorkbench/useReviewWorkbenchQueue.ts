import { useEffect, useRef, useState } from 'react'
import {
  loadReviewWorkbenchItems,
  refreshReviewWorkbench,
  updateReviewWorkbenchItemState,
  type ReviewWorkbenchItem,
  type ReviewWorkbenchListResponse,
  type ReviewWorkbenchUpdateState,
} from './reviewWorkbenchApi'
import type { ReviewWorkbenchFilters } from './reviewWorkbenchFilters'

type QueueResult = {
  filters: ReviewWorkbenchFilters
  revision: number
  list?: ReviewWorkbenchListResponse
  error?: string
}

export function useReviewWorkbenchQueue(filters: ReviewWorkbenchFilters) {
  const [result, setResult] = useState<QueueResult | null>(null)
  const [revision, setRevision] = useState(0)
  const [pendingStableKey, setPendingStableKey] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const refreshPromise = useRef<Promise<unknown> | null>(null)
  const mutationPending = useRef(false)

  useEffect(() => {
    let current = true
    refreshPromise.current ??= refreshReviewWorkbench()
    const refresh = refreshPromise.current
    async function load() {
      try {
        await refresh
        if (!current) return
        const list = await loadReviewWorkbenchItems(filters)
        if (current) setResult({ filters, revision, list })
      } catch {
        if (current)
          setResult({
            filters,
            revision,
            error: 'Review Workbench data could not be loaded.',
          })
      }
    }
    void load()
    return () => {
      current = false
    }
  }, [filters, revision])

  const currentResult =
    result?.filters === filters && result.revision === revision ? result : null

  function refresh() {
    if (!currentResult || mutationPending.current) return
    refreshPromise.current = refreshReviewWorkbench()
    setMutationError(null)
    setRevision((value) => value + 1)
  }

  async function updateState(
    item: ReviewWorkbenchItem,
    state: ReviewWorkbenchUpdateState,
  ) {
    if (mutationPending.current) return
    mutationPending.current = true
    setPendingStableKey(item.stableKey)
    setMutationError(null)
    try {
      await updateReviewWorkbenchItemState(item.stableKey, state)
      // Reload the current URL, never the page captured before the mutation.
      setRevision((value) => value + 1)
    } catch {
      setMutationError('Review Workbench item could not be updated.')
    } finally {
      mutationPending.current = false
      setPendingStableKey(null)
    }
  }

  return {
    list: currentResult?.list,
    error: currentResult?.error ?? mutationError,
    loading: currentResult === null,
    pendingStableKey,
    refresh,
    updateState,
  }
}
