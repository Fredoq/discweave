import { getJson, postEmpty, sendJson } from '../catalog/api/httpClient'

export type ReviewWorkbenchCategory =
  | 'duplicateCandidates'
  | 'missingMetadata'
  | 'formatGaps'
  | 'relationGaps'
  | 'importCleanup'

export type ReviewWorkbenchVisibleCategory = Exclude<
  ReviewWorkbenchCategory,
  'importCleanup'
>

export type ReviewWorkbenchState =
  | 'open'
  | 'dismissed'
  | 'resolved'
  | 'reopened'

export type ReviewWorkbenchStateFilter = ReviewWorkbenchState | 'active'

export type ReviewWorkbenchUpdateState = 'dismissed' | 'resolved' | 'reopened'

export type ReviewWorkbenchNavigationTarget = {
  id: string
  kind: string
  path: string
}

export type ReviewWorkbenchTarget = {
  id: string
  kind: string
  title: string
  subtitle?: string | null
  navigationTarget?: ReviewWorkbenchNavigationTarget | null
}

export type ReviewWorkbenchItem = {
  stableKey: string
  category: ReviewWorkbenchCategory
  subtype: string
  title: string
  state: ReviewWorkbenchState
  reason: string
  sourceDetector: string
  targets: ReviewWorkbenchTarget[]
  lastSeenAt?: string | null
  updatedAt?: string | null
  navigationTarget?: ReviewWorkbenchNavigationTarget | null
}

export type ReviewWorkbenchSummary = {
  active: number
  open: number
  reopened: number
  dismissed: number
  resolved: number
}

export type ReviewWorkbenchRefreshResponse = {
  generatedSignals: number
  created: number
  updated: number
  systemResolved: number
  summary: ReviewWorkbenchSummary
}

export type ReviewWorkbenchListResponse = {
  items: ReviewWorkbenchItem[]
  limit: number
  offset: number
  total: number
  summary: ReviewWorkbenchSummary
}

export type LoadReviewWorkbenchItemsParams = {
  category?: ReviewWorkbenchVisibleCategory
  state?: ReviewWorkbenchStateFilter
  limit?: number
  offset?: number
}

const reviewWorkbenchBasePath = '/api/review-workbench'
const defaultReviewWorkbenchLimit = 100

export async function refreshReviewWorkbench(): Promise<ReviewWorkbenchRefreshResponse> {
  return postEmpty<ReviewWorkbenchRefreshResponse>(
    `${reviewWorkbenchBasePath}/refresh`,
  )
}

export async function loadReviewWorkbenchItems({
  category,
  limit = defaultReviewWorkbenchLimit,
  offset = 0,
  state = 'active',
}: LoadReviewWorkbenchItemsParams = {}): Promise<ReviewWorkbenchListResponse> {
  const params = new URLSearchParams()
  if (category) {
    params.set('category', category)
  }
  params.set('state', state)
  params.set('limit', String(limit))
  params.set('offset', String(offset))

  return (
    (await getJson<ReviewWorkbenchListResponse>(
      `${reviewWorkbenchBasePath}/items?${params.toString()}`,
    )) ?? {
      items: [],
      limit,
      offset,
      total: 0,
      summary: emptyReviewWorkbenchSummary(),
    }
  )
}

export async function updateReviewWorkbenchItemState(
  stableKey: string,
  state: ReviewWorkbenchUpdateState,
): Promise<ReviewWorkbenchItem> {
  return sendJson<ReviewWorkbenchItem>(
    `${reviewWorkbenchBasePath}/items/${encodeURIComponent(stableKey)}/state`,
    'PATCH',
    { state },
  )
}

function emptyReviewWorkbenchSummary(): ReviewWorkbenchSummary {
  return {
    active: 0,
    dismissed: 0,
    open: 0,
    reopened: 0,
    resolved: 0,
  }
}
