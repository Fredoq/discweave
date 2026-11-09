import { useEffect, useMemo } from 'react'
import { DateAddedSortSelect } from '../catalog/DateAddedSortSelect'
import { saveDateAddedSort } from '../catalog/dateAddedSort'
import { ReviewWorkbenchTable } from './ReviewWorkbenchTable'
import {
  categoryOptions,
  focusOptions,
  parseReviewWorkbenchFilters,
  reviewWorkbenchUrl,
  stateOptions,
} from './reviewWorkbenchFilters'
import { targetHref } from './reviewWorkbenchNavigation'
import { useReviewWorkbenchQueue } from './useReviewWorkbenchQueue'
import './review-workbench.css'

type ReviewWorkbenchWorkspaceProps = {
  onCatalogChanged?: () => void
  locationSearch: string
  onNavigateToUrl: (href: string, options?: { replace?: boolean }) => boolean
}

export function ReviewWorkbenchWorkspace({
  locationSearch,
  onNavigateToUrl,
  onCatalogChanged,
}: Readonly<ReviewWorkbenchWorkspaceProps>) {
  const filters = useMemo(
    () => parseReviewWorkbenchFilters(locationSearch),
    [locationSearch],
  )
  const { list, error, loading, pendingStableKey, refresh, updateState } =
    useReviewWorkbenchQueue(filters)
  useEffect(() => {
    saveDateAddedSort('review-workbench', filters.sort)
  }, [filters.sort])

  const lastOffset = list
    ? Math.max(0, Math.ceil(list.total / list.limit) - 1) * list.limit
    : 0
  const outOfRange = Boolean(
    list && filters.offset > 0 && filters.offset >= list.total,
  )
  useEffect(() => {
    if (outOfRange)
      onNavigateToUrl(
        reviewWorkbenchUrl(locationSearch, 'offset', String(lastOffset)),
        { replace: true },
      )
  }, [outOfRange, lastOffset, locationSearch, onNavigateToUrl])

  function navigate(key: string, value: string) {
    onNavigateToUrl(reviewWorkbenchUrl(locationSearch, key, value))
  }
  const busy = loading || pendingStableKey !== null || outOfRange

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
            <p>
              Review possible problems first. Optional metadata and collection
              goals are available under Optional completeness.
            </p>
          </div>
          <button
            className="button button-secondary button-compact"
            type="button"
            disabled={busy}
            onClick={refresh}
          >
            Refresh queue
          </button>
        </div>
        <div className="review-workbench-body">
          <div className="review-workbench-filters" aria-label="Review filters">
            <label>
              <span>Review focus</span>
              <select
                aria-label="Review focus"
                value={filters.focus}
                onChange={(event) =>
                  navigate('focus', event.currentTarget.value)
                }
              >
                {focusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <DateAddedSortSelect
              value={filters.sort}
              onChange={(value) => navigate('sort', value)}
            />
            <label>
              <span>Review category</span>
              <select
                aria-label="Review category"
                value={filters.category ?? ''}
                onChange={(event) =>
                  navigate('category', event.currentTarget.value)
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
                  navigate('state', event.currentTarget.value)
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
          {loading || outOfRange ? (
            <output className="review-workbench-status" aria-live="polite">
              Loading review queue…
            </output>
          ) : null}
          {error ? (
            <div className="review-workbench-error" role="alert">
              <p>{error}</p>
              <button
                className="button button-secondary button-compact"
                type="button"
                disabled={busy}
                onClick={refresh}
              >
                Retry
              </button>
            </div>
          ) : null}
          {list && !outOfRange ? (
            <>
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
              <p className="review-workbench-status">
                State totals cover this focus. Category totals cover all pages
                for the selected focus and state.
              </p>
              <div
                className="metric-strip review-workbench-category-summary"
                aria-label="Review category counts"
              >
                {categoryOptions.map((category) =>
                  category.value ? (
                    <Metric
                      key={category.value}
                      count={list.categoryCounts?.[category.value] ?? 0}
                      label={category.label.toLowerCase()}
                    />
                  ) : null,
                )}
              </div>
              <nav
                className="review-workbench-pagination"
                aria-label="Review queue pagination"
              >
                <output aria-live="polite">
                  {list.total === 0
                    ? '0 results'
                    : `${list.offset + 1}–${list.offset + list.items.length} of ${list.total} results`}
                </output>
                <button
                  className="button button-secondary button-compact"
                  type="button"
                  aria-label="Previous page"
                  disabled={busy || list.offset === 0}
                  onClick={() =>
                    navigate(
                      'offset',
                      String(Math.max(0, list.offset - list.limit)),
                    )
                  }
                >
                  Previous
                </button>
                <button
                  className="button button-secondary button-compact"
                  type="button"
                  aria-label="Next page"
                  disabled={busy || list.offset + list.limit >= list.total}
                  onClick={() =>
                    navigate('offset', String(list.offset + list.limit))
                  }
                >
                  Next
                </button>
              </nav>
              <ReviewWorkbenchTable
                items={list.items}
                onChanged={() => {
                  onCatalogChanged?.()
                  refresh()
                }}
                onOpenTarget={(item) => {
                  const href = targetHref(item)
                  if (href) onNavigateToUrl(href)
                }}
                onUpdateState={(item, state) => {
                  void updateState(item, state)
                }}
                pendingStableKey={pendingStableKey}
              />
            </>
          ) : null}
        </div>
      </section>
    </section>
  )
}

function Metric({ count, label }: Readonly<{ count: number; label: string }>) {
  return (
    <span className="badge badge-tag">
      {count} {label}
    </span>
  )
}
