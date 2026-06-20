import { useEffect, useMemo, useRef, useState } from 'react'
import {
  loadReviewWorkbenchItems,
  refreshReviewWorkbench,
  updateReviewWorkbenchItemState,
  type ReviewWorkbenchItem,
  type ReviewWorkbenchListResponse,
  type ReviewWorkbenchStateFilter,
  type ReviewWorkbenchUpdateState,
  type ReviewWorkbenchVisibleCategory,
} from './reviewWorkbenchApi'
import { ReviewWorkbenchTable } from './ReviewWorkbenchTable'
import { targetHref } from './reviewWorkbenchNavigation'
import './review-workbench.css'

type ReviewWorkbenchWorkspaceProps = {
  locationSearch: string
  onNavigateToUrl: (href: string) => boolean
}

type WorkbenchStatus = 'loading' | 'ready' | 'error'

const categoryOptions: {
  label: string
  value: ReviewWorkbenchVisibleCategory | ''
}[] = [
  { label: 'All', value: '' },
  { label: 'Duplicate candidates', value: 'duplicateCandidates' },
  { label: 'Missing metadata', value: 'missingMetadata' },
  { label: 'Format gaps', value: 'formatGaps' },
  { label: 'Relation gaps', value: 'relationGaps' },
  { label: 'Import cleanup', value: 'importCleanup' },
]

const stateOptions: { label: string; value: ReviewWorkbenchStateFilter }[] = [
  { label: 'Active', value: 'active' },
  { label: 'Open', value: 'open' },
  { label: 'Reopened', value: 'reopened' },
  { label: 'Dismissed', value: 'dismissed' },
  { label: 'Resolved', value: 'resolved' },
]

const categoryMetricLabels: Record<ReviewWorkbenchVisibleCategory, string> = {
  duplicateCandidates: 'duplicate candidates',
  missingMetadata: 'missing metadata',
  formatGaps: 'format gaps',
  relationGaps: 'relation gaps',
  importCleanup: 'import cleanup',
}

const defaultListResponse: ReviewWorkbenchListResponse = {
  items: [],
  limit: 100,
  offset: 0,
  total: 0,
  summary: {
    active: 0,
    dismissed: 0,
    open: 0,
    reopened: 0,
    resolved: 0,
  },
}

export function ReviewWorkbenchWorkspace({
  locationSearch,
  onNavigateToUrl,
}: Readonly<ReviewWorkbenchWorkspaceProps>) {
  const [status, setStatus] = useState<WorkbenchStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [list, setList] =
    useState<ReviewWorkbenchListResponse>(defaultListResponse)
  const [pendingStableKey, setPendingStableKey] = useState<string | null>(null)
  const initialRefreshCompleted = useRef(false)
  const filters = useMemo(
    () => parseReviewWorkbenchFilters(locationSearch),
    [locationSearch],
  )
  const filtersRef = useRef(filters)

  useEffect(() => {
    filtersRef.current = filters
  }, [filters])

  useEffect(() => {
    let isCurrent = true

    async function loadInitialQueue() {
      setStatus('loading')
      setError(null)

      try {
        await refreshReviewWorkbench()
        const loadedList = await loadCurrentQueue()
        if (!isCurrent) {
          return
        }

        initialRefreshCompleted.current = true
        setList(loadedList)
        setStatus('ready')
      } catch {
        if (!isCurrent) {
          return
        }

        initialRefreshCompleted.current = true
        setError('Review Workbench data could not be loaded.')
        setStatus('error')
      }
    }

    void loadInitialQueue()

    return () => {
      isCurrent = false
    }
  }, [])

  useEffect(() => {
    if (!initialRefreshCompleted.current) {
      return
    }

    let isCurrent = true
    void reloadQueue({ keepStatus: true, isCurrent: () => isCurrent })

    return () => {
      isCurrent = false
    }
  }, [filters.category, filters.offset, filters.state])

  async function reloadQueue({
    isCurrent = () => true,
    keepStatus = false,
  }: {
    isCurrent?: () => boolean
    keepStatus?: boolean
  } = {}) {
    if (!keepStatus) {
      setStatus('loading')
    }
    setError(null)

    try {
      const loadedList = await loadReviewWorkbenchItems(filtersRef.current)
      if (!isCurrent()) {
        return
      }

      setList(loadedList)
      setStatus('ready')
    } catch {
      if (!isCurrent()) {
        return
      }

      setError('Review Workbench data could not be loaded.')
      setStatus('error')
    }
  }

  async function refreshAndReload() {
    setStatus('loading')
    setError(null)

    try {
      await refreshReviewWorkbench()
      const loadedList = await loadCurrentQueue()
      setList(loadedList)
      setStatus('ready')
    } catch {
      setError('Review Workbench data could not be loaded.')
      setStatus('error')
    }
  }

  async function updateState(
    item: ReviewWorkbenchItem,
    state: ReviewWorkbenchUpdateState,
  ) {
    setPendingStableKey(item.stableKey)
    setError(null)

    try {
      await updateReviewWorkbenchItemState(item.stableKey, state)
      await reloadQueue({ keepStatus: true })
    } catch {
      setError('Review Workbench item could not be updated.')
      setStatus('error')
    } finally {
      setPendingStableKey(null)
    }
  }

  function updateFilter(
    key: 'category' | 'state',
    value: ReviewWorkbenchVisibleCategory | ReviewWorkbenchStateFilter | '',
  ) {
    const params = new URLSearchParams(locationSearch)
    if (!value || (key === 'state' && value === 'active')) {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    params.delete('offset')

    const query = params.toString()
    const path = query ? `/review-workbench?${query}` : '/review-workbench'
    onNavigateToUrl(path)
  }

  function openTarget(item: ReviewWorkbenchItem) {
    const href = targetHref(item)
    if (href) {
      onNavigateToUrl(href)
    }
  }

  const categoryCounts = categoryOptions
    .filter(
      (
        option,
      ): option is {
        label: string
        value: ReviewWorkbenchVisibleCategory
      } => Boolean(option.value),
    )
    .map((category) => ({
      ...category,
      count: list.items.filter((item) => item.category === category.value)
        .length,
    }))

  return (
    <section
      className="review-workbench"
      aria-label="Review Workbench workspace"
    >
      <section
        className="panel review-workbench-panel"
        aria-labelledby="review-workbench-title"
      >
        <div className="panel-heading">
          <div>
            <h2 id="review-workbench-title">Collection review queue</h2>
            <p>Generated collection signals with persisted triage state.</p>
          </div>
        </div>

        <div className="review-workbench-body">
          <div
            className="metric-strip review-workbench-summary"
            aria-label="Review state counts"
          >
            <Metric count={list.summary.active} label="active" />
            <Metric count={list.summary.open} label="open" />
            <Metric count={list.summary.reopened} label="reopened" />
            <Metric count={list.summary.dismissed} label="dismissed" />
            <Metric count={list.summary.resolved} label="resolved" />
          </div>

          <div
            className="metric-strip review-workbench-category-summary"
            aria-label="Review category counts"
          >
            {categoryCounts.map((category) => (
              <Metric
                key={category.value}
                count={category.count}
                label={categoryMetricLabels[category.value]}
              />
            ))}
          </div>

          <div className="review-workbench-filters" aria-label="Review filters">
            <label>
              <span>Review category</span>
              <select
                aria-label="Review category"
                value={filters.category ?? ''}
                onChange={(event) =>
                  updateFilter(
                    'category',
                    event.currentTarget.value as
                      | ReviewWorkbenchVisibleCategory
                      | '',
                  )
                }
              >
                {categoryOptions.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Review state</span>
              <select
                aria-label="Review state"
                value={filters.state}
                onChange={(event) =>
                  updateFilter(
                    'state',
                    event.currentTarget.value as ReviewWorkbenchStateFilter,
                  )
                }
              >
                {stateOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {status === 'loading' ? (
            <output className="review-workbench-status" aria-live="polite">
              Loading review queue…
            </output>
          ) : null}

          {status === 'error' ? (
            <div className="review-workbench-error" role="alert">
              <p>{error ?? 'Review Workbench data could not be loaded.'}</p>
              <button
                className="button button-secondary button-compact"
                type="button"
                onClick={() => {
                  void refreshAndReload()
                }}
              >
                Retry
              </button>
            </div>
          ) : null}

          {status === 'loading' || status === 'ready' ? (
            <ReviewWorkbenchTable
              items={list.items}
              onOpenTarget={openTarget}
              onUpdateState={(item, state) => {
                void updateState(item, state)
              }}
              pendingStableKey={pendingStableKey}
            />
          ) : null}
        </div>
      </section>
    </section>
  )

  async function loadCurrentQueue() {
    let requestFilters = filtersRef.current
    let loadedList = await loadReviewWorkbenchItems(requestFilters)

    while (!sameReviewWorkbenchFilters(requestFilters, filtersRef.current)) {
      requestFilters = filtersRef.current
      loadedList = await loadReviewWorkbenchItems(requestFilters)
    }

    return loadedList
  }
}

function Metric({ count, label }: Readonly<{ count: number; label: string }>) {
  return (
    <span className="badge badge-tag">
      {count} {label}
    </span>
  )
}

function sameReviewWorkbenchFilters(
  left: ReturnType<typeof parseReviewWorkbenchFilters>,
  right: ReturnType<typeof parseReviewWorkbenchFilters>,
) {
  return (
    left.category === right.category &&
    left.offset === right.offset &&
    left.state === right.state
  )
}

function parseReviewWorkbenchFilters(locationSearch: string): {
  category?: ReviewWorkbenchVisibleCategory
  offset: number
  state: ReviewWorkbenchStateFilter
} {
  const params = new URLSearchParams(locationSearch)
  const rawCategory = params.get('category')
  const rawState = params.get('state')
  const rawOffset = Number.parseInt(params.get('offset') ?? '0', 10)

  return {
    category: isVisibleCategory(rawCategory) ? rawCategory : undefined,
    offset: Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0,
    state: isStateFilter(rawState) ? rawState : 'active',
  }
}

function isVisibleCategory(
  category: string | null,
): category is ReviewWorkbenchVisibleCategory {
  return (
    category === 'duplicateCandidates' ||
    category === 'missingMetadata' ||
    category === 'formatGaps' ||
    category === 'relationGaps'
  )
}

function isStateFilter(
  state: string | null,
): state is ReviewWorkbenchStateFilter {
  return (
    state === 'active' ||
    state === 'open' ||
    state === 'reopened' ||
    state === 'dismissed' ||
    state === 'resolved'
  )
}
