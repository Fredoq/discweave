import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  loadReviewWorkbenchItems,
  refreshReviewWorkbench,
  type ReviewWorkbenchListResponse,
  type ReviewWorkbenchRefreshResponse,
} from './reviewWorkbenchApi'
import type { ReviewWorkbenchFilters } from './reviewWorkbenchFilters'
import { useReviewWorkbenchQueue } from './useReviewWorkbenchQueue'

vi.mock('./reviewWorkbenchApi', () => ({
  loadReviewWorkbenchItems: vi.fn(),
  refreshReviewWorkbench: vi.fn(),
  updateReviewWorkbenchItemState: vi.fn(),
}))

const filters: ReviewWorkbenchFilters = {
  focus: 'actionable',
  state: 'active',
  sort: 'default',
  offset: 0,
}
const summary = { active: 0, open: 0, reopened: 0, dismissed: 0, resolved: 0 }
const refreshed: ReviewWorkbenchRefreshResponse = {
  generatedSignals: 0,
  created: 0,
  updated: 0,
  systemResolved: 0,
  summary,
}
const page: ReviewWorkbenchListResponse = {
  items: [],
  limit: 100,
  offset: 0,
  total: 0,
  summary,
  categoryCounts: {
    duplicateCandidates: 0,
    missingMetadata: 0,
    formatGaps: 0,
    relationGaps: 0,
    importCleanup: 0,
  },
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(refreshReviewWorkbench).mockResolvedValue(refreshed)
  vi.mocked(loadReviewWorkbenchItems).mockResolvedValue(page)
})
afterEach(cleanup)

it.each([
  { ...filters, focus: 'optional' as const },
  { ...filters, offset: 100 },
])(
  'recovers an initial refresh failure on navigation to %j without Retry',
  async (nextFilters) => {
    vi.mocked(refreshReviewWorkbench).mockRejectedValueOnce(
      new Error('offline'),
    )
    const { result, rerender } = renderHook(useReviewWorkbenchQueue, {
      initialProps: filters,
    })
    await waitFor(() => expect(result.current.error).toBeTruthy())
    expect(loadReviewWorkbenchItems).not.toHaveBeenCalled()
    rerender(nextFilters)
    await waitFor(() => expect(result.current.list).toEqual(page))
    expect(result.current.error).toBeNull()
    expect(refreshReviewWorkbench).toHaveBeenCalledTimes(2)
    expect(loadReviewWorkbenchItems).toHaveBeenLastCalledWith(nextFilters)
  },
)

it.each([
  { ...filters, focus: 'optional' as const },
  { ...filters, offset: 100 },
])(
  'recovers a manual refresh failure on navigation to %j without Retry',
  async (nextFilters) => {
    const { result, rerender } = renderHook(useReviewWorkbenchQueue, {
      initialProps: filters,
    })
    await waitFor(() => expect(result.current.list).toEqual(page))
    vi.mocked(refreshReviewWorkbench).mockRejectedValueOnce(
      new Error('offline'),
    )
    act(() => result.current.refresh())
    await waitFor(() => expect(result.current.error).toBeTruthy())
    rerender(nextFilters)
    await waitFor(() => expect(result.current.list).toEqual(page))
    expect(result.current.error).toBeNull()
    expect(refreshReviewWorkbench).toHaveBeenCalledTimes(3)
    expect(loadReviewWorkbenchItems).toHaveBeenLastCalledWith(nextFilters)
  },
)

it('recovers a list failure on navigation without repeating a successful refresh', async () => {
  vi.mocked(loadReviewWorkbenchItems).mockRejectedValueOnce(
    new Error('offline'),
  )
  const { result, rerender } = renderHook(useReviewWorkbenchQueue, {
    initialProps: filters,
  })
  await waitFor(() => expect(result.current.error).toBeTruthy())
  const nextFilters = { ...filters, offset: 100 }
  rerender(nextFilters)
  await waitFor(() => expect(result.current.list).toEqual(page))
  expect(result.current.error).toBeNull()
  expect(refreshReviewWorkbench).toHaveBeenCalledTimes(1)
  expect(loadReviewWorkbenchItems).toHaveBeenLastCalledWith(nextFilters)
})

it('keeps a newer refresh cached when an older in-flight refresh rejects', async () => {
  const older = deferred<ReviewWorkbenchRefreshResponse>()
  const newer = deferred<ReviewWorkbenchRefreshResponse>()
  const { result, rerender } = renderHook(useReviewWorkbenchQueue, {
    initialProps: filters,
  })
  await waitFor(() => expect(result.current.list).toEqual(page))
  vi.mocked(refreshReviewWorkbench)
    .mockReturnValueOnce(older.promise)
    .mockReturnValueOnce(newer.promise)
  // A queued consumer callback can retain the last ready render's handler.
  const refresh = result.current.refresh
  act(() => refresh())
  // Separate act calls flush each effect, attaching both rejection handlers.
  expect(result.current.loading).toBe(true)
  act(() => refresh())
  expect(refreshReviewWorkbench).toHaveBeenCalledTimes(3)
  await act(async () => {
    older.reject(new Error('The superseded refresh failed'))
    await older.promise.catch(() => undefined)
  })
  const nextFilters = { ...filters, focus: 'optional' as const }
  rerender(nextFilters)
  expect(result.current.loading).toBe(true)
  expect(result.current.error).toBeNull()
  expect(refreshReviewWorkbench).toHaveBeenCalledTimes(3)
  expect(loadReviewWorkbenchItems).toHaveBeenCalledTimes(1)
  await act(async () => {
    newer.resolve(refreshed)
    await newer.promise
  })
  await waitFor(() => expect(result.current.list).toEqual(page))
  expect(loadReviewWorkbenchItems).toHaveBeenLastCalledWith(nextFilters)
  expect(refreshReviewWorkbench).toHaveBeenCalledTimes(3)
})

it('coalesces repeated manual refreshes into one observed request', async () => {
  const pending = deferred<ReviewWorkbenchRefreshResponse>()
  const { result, rerender } = renderHook(useReviewWorkbenchQueue, {
    initialProps: filters,
  })
  await waitFor(() => expect(result.current.list).toEqual(page))
  vi.mocked(refreshReviewWorkbench).mockReturnValueOnce(pending.promise)
  act(() => {
    result.current.refresh()
    result.current.refresh()
  })
  expect(result.current.loading).toBe(true)
  expect(refreshReviewWorkbench).toHaveBeenCalledTimes(2)
  await act(async () => {
    pending.reject(new Error('Refresh failed'))
    await pending.promise.catch(() => undefined)
  })
  await waitFor(() => expect(result.current.error).toBeTruthy())
  rerender({ ...filters, offset: 100 })
  await waitFor(() => expect(result.current.list).toEqual(page))
  expect(result.current.error).toBeNull()
  expect(refreshReviewWorkbench).toHaveBeenCalledTimes(3)
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}
