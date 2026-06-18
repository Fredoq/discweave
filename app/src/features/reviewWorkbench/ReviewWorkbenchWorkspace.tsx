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
]

const stateOptions: { label: string; value: ReviewWorkbenchStateFilter }[] = [
  { label: 'Active', value: 'active' },
  { label: 'Open', value: 'open' },
  { label: 'Reopened', value: 'reopened' },
  { label: 'Dismissed', value: 'dismissed' },
  { label: 'Resolved', value: 'resolved' },
]

const categoryLabels: Record<ReviewWorkbenchVisibleCategory, string> = {
  duplicateCandidates: 'Duplicate candidates',
  missingMetadata: 'Missing metadata',
  formatGaps: 'Format gaps',
  relationGaps: 'Relation gaps',
}

const categoryMetricLabels: Record<ReviewWorkbenchVisibleCategory, string> = {
  duplicateCandidates: 'duplicate candidates',
  missingMetadata: 'missing metadata',
  formatGaps: 'format gaps',
  relationGaps: 'relation gaps',
}

const stateTone: Record<string, string> = {
  open: 'amber',
  reopened: 'blue',
  dismissed: 'gray',
  resolved: 'green',
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
}: ReviewWorkbenchWorkspaceProps) {
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

  useEffect(() => {
    let isCurrent = true

    async function loadInitialQueue() {
      setStatus('loading')
      setError(null)

      try {
        await refreshReviewWorkbench()
        const loadedList = await loadReviewWorkbenchItems(filters)
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
    // Run refresh only when the workspace first opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const loadedList = await loadReviewWorkbenchItems(filters)
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
      const loadedList = await loadReviewWorkbenchItems(filters)
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
    onNavigateToUrl(`/review-workbench${query ? `?${query}` : ''}`)
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
            <p className="review-workbench-status" role="status">
              Loading review queue…
            </p>
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

          {status !== 'error' ? (
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
}

function ReviewWorkbenchTable({
  items,
  onOpenTarget,
  onUpdateState,
  pendingStableKey,
}: {
  items: ReviewWorkbenchItem[]
  onOpenTarget: (item: ReviewWorkbenchItem) => void
  onUpdateState: (
    item: ReviewWorkbenchItem,
    state: ReviewWorkbenchUpdateState,
  ) => void
  pendingStableKey: string | null
}) {
  if (items.length === 0) {
    return (
      <p className="review-workbench-empty">
        No review items match these filters.
      </p>
    )
  }

  return (
    <div className="table-scroll">
      <table className="catalog-table workspace-table review-workbench-table">
        <colgroup>
          <col className="review-workbench-col-issue" />
          <col className="review-workbench-col-category" />
          <col className="review-workbench-col-state" />
          <col className="review-workbench-col-reason" />
          <col className="review-workbench-col-detector" />
          <col className="review-workbench-col-target" />
          <col className="review-workbench-col-seen" />
          <col className="review-workbench-col-actions" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Issue</th>
            <th scope="col">Category</th>
            <th scope="col">State</th>
            <th scope="col">Reason</th>
            <th scope="col">Detector</th>
            <th scope="col">Target</th>
            <th scope="col">Seen</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const targetIsAvailable = Boolean(targetHref(item))
            const isPending = pendingStableKey === item.stableKey

            return (
              <tr className="review-workbench-row" key={item.stableKey}>
                <td data-label="Issue">
                  <strong>{item.title}</strong>
                  <span>{subtypeLabel(item.subtype)}</span>
                </td>
                <td data-label="Category">{categoryLabel(item.category)}</td>
                <td data-label="State">
                  <span
                    className={`badge status-badge status-${
                      stateTone[item.state] ?? 'gray'
                    }`}
                  >
                    {stateLabel(item.state)}
                  </span>
                </td>
                <td data-label="Reason">{reasonLabel(item.reason)}</td>
                <td data-label="Detector">
                  {sourceDetectorLabel(item.sourceDetector)}
                </td>
                <td data-label="Target">{primaryTargetLabel(item)}</td>
                <td data-label="Seen">
                  <span>{dateLabel(item.lastSeenAt)}</span>
                  <span>{dateLabel(item.updatedAt)}</span>
                </td>
                <td data-label="Actions">
                  <div className="review-workbench-actions">
                    <button
                      className="button button-secondary button-compact"
                      type="button"
                      aria-label={`Open target ${item.title}`}
                      disabled={!targetIsAvailable}
                      title={
                        targetIsAvailable
                          ? undefined
                          : 'Target navigation is unavailable for this item.'
                      }
                      onClick={() => onOpenTarget(item)}
                    >
                      Open target
                    </button>
                    {item.state === 'dismissed' || item.state === 'resolved' ? (
                      <button
                        className="button button-secondary button-compact"
                        type="button"
                        aria-label={`Reopen ${item.title}`}
                        disabled={isPending}
                        onClick={() => onUpdateState(item, 'reopened')}
                      >
                        Reopen
                      </button>
                    ) : (
                      <>
                        <button
                          className="button button-secondary button-compact"
                          type="button"
                          aria-label={`Dismiss ${item.title}`}
                          disabled={isPending}
                          onClick={() => onUpdateState(item, 'dismissed')}
                        >
                          Dismiss
                        </button>
                        <button
                          className="button button-secondary button-compact"
                          type="button"
                          aria-label={`Resolve ${item.title}`}
                          disabled={isPending}
                          onClick={() => onUpdateState(item, 'resolved')}
                        >
                          Resolve
                        </button>
                      </>
                    )}
                    {!targetIsAvailable ? (
                      <span className="review-workbench-unavailable">
                        Target unavailable
                      </span>
                    ) : null}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Metric({ count, label }: { count: number; label: string }) {
  return (
    <span className="badge badge-tag">
      {count} {label}
    </span>
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

function targetHref(item: ReviewWorkbenchItem) {
  const target = item.navigationTarget ?? item.targets[0]?.navigationTarget
  const fallbackTarget = item.targets[0]
  const kind = target?.kind ?? fallbackTarget?.kind
  const id = target?.id ?? fallbackTarget?.id

  if (!kind || !id) {
    return null
  }

  if (kind === 'release') {
    return `/releases?release=${encodeURIComponent(id)}`
  }

  if (kind === 'track') {
    return `/tracks?track=${encodeURIComponent(id)}`
  }

  if (kind === 'ownedItem') {
    return `/owned-items?ownedItem=${encodeURIComponent(id)}`
  }

  return null
}

function primaryTargetLabel(item: ReviewWorkbenchItem) {
  const target = item.targets[0]
  if (!target) {
    return 'No target'
  }

  const extraCount = item.targets.length - 1
  return extraCount > 0 ? `${target.title} + ${extraCount} more` : target.title
}

function categoryLabel(category: string) {
  return isVisibleCategory(category)
    ? categoryLabels[category]
    : titleCase(category)
}

function stateLabel(state: string) {
  return titleCase(state)
}

function subtypeLabel(subtype: string) {
  return splitIdentifier(subtype)
}

function reasonLabel(reason: string) {
  return splitIdentifier(reason)
}

function sourceDetectorLabel(sourceDetector: string) {
  return splitIdentifier(sourceDetector)
}

function splitIdentifier(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase())
}

function titleCase(value: string) {
  return value.replace(/^\w/, (letter) => letter.toUpperCase())
}

function dateLabel(value?: string | null) {
  if (!value) {
    return 'Not seen yet'
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
