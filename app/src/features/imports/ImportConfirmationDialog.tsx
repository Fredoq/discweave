import type {
  ImportIssue,
  ReleaseImportConfirmationPreflight,
  ReleaseImportDraft,
} from '../catalog/catalogApi'

export function ImportConfirmationDialog({
  draft,
  isConfirming,
  preflight,
  onCancel,
  onConfirm,
}: {
  draft: ReleaseImportDraft
  isConfirming: boolean
  preflight: ReleaseImportConfirmationPreflight
  onCancel: () => void
  onConfirm: () => void
}) {
  const headingId = 'import-confirmation-dialog-title'
  const summary = preflight.summary

  return (
    <div className="imports-confirmation-backdrop">
      <section
        aria-labelledby={headingId}
        aria-modal="true"
        className="imports-confirmation-dialog"
        role="dialog"
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
      </section>
    </div>
  )
}

function SummaryMetric({ value }: { value: string }) {
  return (
    <span className="imports-confirmation-metric">
      <strong>{value}</strong>
    </span>
  )
}

function IssueList({
  heading,
  issues,
}: {
  heading: string
  issues: ImportIssue[]
}) {
  return (
    <section className="imports-confirmation-section imports-confirmation-issues">
      <div className="imports-confirmation-section-heading">
        <h3>{heading}</h3>
      </div>
      <div className="imports-issue-list" role="status">
        {issues.map((issue) => (
          <p key={`${issue.severity}-${issue.code}-${issue.message}`}>
            <strong>{issue.severity}</strong> {issue.message}
          </p>
        ))}
      </div>
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
  return outcome === 'newRelease'
    ? 'New release'
    : outcome === 'exactDuplicate'
      ? 'Duplicate match'
      : outcome === 'partialDuplicate'
        ? 'Partial duplicate'
        : 'Blocked'
}

function outcomeClass(outcome: ReleaseImportConfirmationPreflight['outcome']) {
  return outcome === 'blocked'
    ? 'status-red'
    : outcome === 'newRelease'
      ? 'status-green'
      : 'status-amber'
}
