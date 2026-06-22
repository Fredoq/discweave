import type {
  ImportIssue,
  ReleaseImportConfirmationPreflight,
  ReleaseImportDraft,
} from '../catalog/catalogApi'

type ImportConfirmationDialogProps = Readonly<{
  draft: ReleaseImportDraft
  isConfirming: boolean
  preflight: ReleaseImportConfirmationPreflight
  onCancel: () => void
  onConfirm: () => void
}>

type SummaryMetricProps = Readonly<{
  value: string
}>

type IssueListProps = Readonly<{
  heading: string
  issues: ImportIssue[]
}>

export function ImportConfirmationDialog({
  draft,
  isConfirming,
  preflight,
  onCancel,
  onConfirm,
}: ImportConfirmationDialogProps) {
  const headingId = 'import-confirmation-dialog-title'
  const summary = preflight.summary

  return (
    <div className="imports-confirmation-backdrop">
      <dialog
        open
        aria-labelledby={headingId}
        aria-modal="true"
        className="imports-confirmation-dialog"
      >
        <div className="imports-confirmation-header">
          <div>
            <p className="section-label">Import preflight</p>
            <h2 id={headingId}>Confirm import draft</h2>
            <p>{draft.title}</p>
          </div>
          <span
            className={`badge status-badge ${outcomeClass(preflight.outcome)}`}
          >
            {outcomeLabel(preflight.outcome)}
          </span>
        </div>

        <div
          className="imports-confirmation-metrics"
          aria-label="Preflight summary"
        >
          <SummaryMetric
            value={formatCount(summary.includedTrackCount, 'included track')}
          />
          <SummaryMetric
            value={formatCount(summary.skippedTrackCount, 'skipped track')}
          />
          <SummaryMetric
            value={formatCount(summary.duplicateTrackCount, 'duplicate match')}
          />
        </div>

        {preflight.blockingErrors.length > 0 ? (
          <IssueList
            heading="Blocking errors"
            issues={preflight.blockingErrors}
          />
        ) : null}

        <section className="imports-confirmation-section">
          <div className="imports-confirmation-section-heading">
            <h3>Expected catalog writes</h3>
            <p>
              Review the read-only preflight plan before committing changes.
            </p>
          </div>
          {preflight.actions.length > 0 ? (
            <ul className="imports-confirmation-actions">
              {preflight.actions.map((action) => (
                <li key={`${action.kind}-${action.action}`}>
                  <strong>{action.count}</strong>
                  <span>{action.label}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="imports-status">No catalog writes are planned.</p>
          )}
        </section>

        <section className="imports-confirmation-section">
          <div className="imports-confirmation-section-heading">
            <h3>Track plan</h3>
            <p>
              {formatCount(preflight.tracks.length, 'draft track')} reviewed.
            </p>
          </div>
          <div className="imports-confirmation-track-list">
            {preflight.tracks.slice(0, 6).map((track) => (
              <div
                key={track.draftTrackId}
                className="imports-confirmation-track"
              >
                <span>{track.position ?? '—'}</span>
                <strong>{track.title}</strong>
                <small>
                  Track: {actionLabel(track.trackAction)} · File:{' '}
                  {actionLabel(track.localFileAction)} · Link:{' '}
                  {actionLabel(track.fileLinkAction)}
                </small>
              </div>
            ))}
          </div>
        </section>

        {preflight.issues.length > 0 ? (
          <IssueList heading="Warnings and issues" issues={preflight.issues} />
        ) : null}

        <div className="imports-confirmation-footer">
          <button
            className="button button-secondary"
            disabled={isConfirming}
            type="button"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="button button-primary"
            disabled={!preflight.canConfirm || isConfirming}
            type="button"
            onClick={onConfirm}
          >
            {isConfirming ? 'Confirming import' : 'Confirm import'}
          </button>
        </div>
      </dialog>
    </div>
  )
}

function SummaryMetric({ value }: SummaryMetricProps) {
  return (
    <span className="imports-confirmation-metric">
      <strong>{value}</strong>
    </span>
  )
}

function IssueList({ heading, issues }: IssueListProps) {
  return (
    <section className="imports-confirmation-section imports-confirmation-issues">
      <div className="imports-confirmation-section-heading">
        <h3>{heading}</h3>
      </div>
      <output className="imports-issue-list">
        {issues.map((issue) => (
          <span
            className="imports-issue-item"
            key={`${issue.severity}-${issue.code}-${issue.message}`}
          >
            <strong>{issue.severity}</strong> {issue.message}
          </span>
        ))}
      </output>
    </section>
  )
}

function formatCount(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function actionLabel(action: string) {
  return action === 'relink' ? 'relink moved file' : action
}

function outcomeLabel(outcome: ReleaseImportConfirmationPreflight['outcome']) {
  switch (outcome) {
    case 'newRelease':
      return 'New release'
    case 'exactDuplicate':
      return 'Duplicate match'
    case 'partialDuplicate':
      return 'Partial duplicate'
    case 'blocked':
      return 'Blocked'
  }
}

function outcomeClass(outcome: ReleaseImportConfirmationPreflight['outcome']) {
  switch (outcome) {
    case 'blocked':
      return 'status-red'
    case 'newRelease':
      return 'status-green'
    case 'exactDuplicate':
    case 'partialDuplicate':
      return 'status-amber'
  }
}
