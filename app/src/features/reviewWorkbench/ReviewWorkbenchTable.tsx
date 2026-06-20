import type {
  ReviewWorkbenchItem,
  ReviewWorkbenchUpdateState,
  ReviewWorkbenchVisibleCategory,
} from './reviewWorkbenchApi'
import {
  resolveReviewWorkbenchTarget,
  targetHref,
} from './reviewWorkbenchNavigation'

type ReviewWorkbenchTableProps = Readonly<{
  items: readonly ReviewWorkbenchItem[]
  onOpenTarget: (item: ReviewWorkbenchItem) => void
  onUpdateState: (
    item: ReviewWorkbenchItem,
    state: ReviewWorkbenchUpdateState,
  ) => void
  pendingStableKey: string | null
}>

const categoryLabels: Record<ReviewWorkbenchVisibleCategory, string> = {
  duplicateCandidates: 'Duplicate candidates',
  missingMetadata: 'Missing metadata',
  formatGaps: 'Format gaps',
  relationGaps: 'Relation gaps',
  importCleanup: 'Import cleanup',
}

const stateTone: Record<string, string> = {
  open: 'amber',
  reopened: 'blue',
  dismissed: 'gray',
  resolved: 'green',
}

export function ReviewWorkbenchTable({
  items,
  onOpenTarget,
  onUpdateState,
  pendingStableKey,
}: ReviewWorkbenchTableProps) {
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
            const targetIsUnavailable = !targetIsAvailable
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
                      disabled={targetIsUnavailable}
                      title={
                        targetIsUnavailable
                          ? 'Target navigation is unavailable for this item.'
                          : undefined
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
                    {targetIsUnavailable ? (
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

function primaryTargetLabel(item: ReviewWorkbenchItem) {
  const target = resolveReviewWorkbenchTarget(item)
  if (!target) {
    return 'No target'
  }

  const label = target.title ?? target.id
  const extraCount = item.targets.filter(
    (candidate) => candidate.kind !== target.kind || candidate.id !== target.id,
  ).length
  return extraCount > 0 ? `${label} + ${extraCount} more` : label
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

function isVisibleCategory(
  category: string | null,
): category is ReviewWorkbenchVisibleCategory {
  return (
    category === 'duplicateCandidates' ||
    category === 'missingMetadata' ||
    category === 'formatGaps' ||
    category === 'relationGaps' ||
    category === 'importCleanup'
  )
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
