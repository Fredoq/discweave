import type {
  ImportIssue,
  ReleaseImportDraft,
  ReleaseImportScanDiagnostic,
  ReleaseImportScanDiagnosticSummary,
  ReleaseImportSession,
} from '../catalog/catalogApi'

export function ImportSourcePanel({ isDesktop }: { isDesktop: boolean }) {
  if (isDesktop) {
    return (
      <div className="imports-agent-card">
        <div>
          <span>Desktop app</span>
          <strong>Local import enabled</strong>
          <small>
            Choose a folder on this Mac and review parsed drafts here. Desktop
            import sends metadata, hashes, paths and cover artifacts, not audio
            files.
          </small>
        </div>
      </div>
    )
  }

  return (
    <div className="imports-agent-card">
      <div>
        <span>Desktop app</span>
        <strong>Local folder import is desktop-only</strong>
        <small>
          Web review remains available; local folder selection runs in the macOS
          app. Desktop import sends metadata, hashes, paths and cover artifacts,
          not audio files.
        </small>
      </div>
    </div>
  )
}

export function SessionsTable({
  sessions,
  selectedSessionId,
  onSelect,
}: {
  sessions: ReleaseImportSession[]
  selectedSessionId: string
  onSelect: (sessionId: string) => void
}) {
  return (
    <section className="panel catalog-panel">
      <div className="panel-heading">
        <div>
          <h2>Sessions</h2>
          <p>{sessions.length} saved scans</p>
        </div>
      </div>
      <div className="catalog-table-wrap">
        <table className="catalog-table imports-session-table">
          <tbody>
            {sessions.map((session) => {
              const counts = diagnosticSeverityCounts(
                session.diagnosticSummaries,
              )
              return (
                <tr
                  className={
                    session.id === selectedSessionId ? 'is-selected' : undefined
                  }
                  key={session.id}
                >
                  <td data-label="Root">
                    <button
                      aria-current={
                        session.id === selectedSessionId ? 'true' : undefined
                      }
                      className="imports-row-select-button"
                      type="button"
                      onClick={() => {
                        void onSelect(session.id)
                      }}
                    >
                      <span className="row-title">
                        <strong>{session.sourceRoot}</strong>
                      </span>
                    </button>
                  </td>
                  <td data-label="Drafts">{session.draftCount}</td>
                  <td data-label="Tracks">{session.trackCount}</td>
                  <td data-label="Ignored">{session.ignoredFileCount}</td>
                  <td data-label="Warnings">
                    {counts.warning > 0 ? (
                      <span className="badge status-badge status-amber">
                        {counts.warning}
                      </span>
                    ) : (
                      0
                    )}
                  </td>
                  <td data-label="Errors">
                    {counts.error > 0 ? (
                      <span className="badge status-badge status-red">
                        {counts.error}
                      </span>
                    ) : (
                      0
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function ScanReportPanel({
  session,
}: {
  session: ReleaseImportSession
}) {
  const counts = diagnosticSeverityCounts(session.diagnosticSummaries)
  const groups = session.diagnosticSummaries ?? []

  return (
    <section className="panel catalog-panel imports-scan-report-panel">
      <div className="panel-heading">
        <div>
          <h2>Scan report</h2>
          <p>Diagnostic groups for the selected session.</p>
        </div>
      </div>
      <div className="imports-scan-report-body">
        <div className="imports-scan-metrics" aria-label="Scan report metrics">
          <span className="badge status-badge status-gray">
            {scanModeLabel(session.scanMode)}
          </span>
          <span className="badge status-badge status-gray">
            {session.draftCount} {pluralize('draft', session.draftCount)}
          </span>
          <span className="badge status-badge status-gray">
            {session.trackCount} {pluralize('track', session.trackCount)}
          </span>
          <span className="badge status-badge status-gray">
            {session.ignoredFileCount} ignored
          </span>
          <span className="badge status-badge status-amber">
            {counts.warning} {pluralize('warning', counts.warning)}
          </span>
          <span className="badge status-badge status-red">
            {counts.error} {pluralize('error', counts.error)}
          </span>
        </div>

        <section
          className="imports-diagnostic-groups"
          aria-labelledby="scan-diagnostic-groups-heading"
        >
          <div className="imports-diagnostic-groups-heading">
            <h3 id="scan-diagnostic-groups-heading">Diagnostic groups</h3>
          </div>
          {groups.length > 0 ? (
            <div className="catalog-table-wrap">
              <table className="catalog-table imports-diagnostic-table">
                <tbody>
                  {groups.map((group) => {
                    const representative = representativeDiagnostic(
                      session.diagnostics ?? [],
                      group,
                    )
                    return (
                      <tr key={`${group.severity}-${group.code}`}>
                        <td data-label="Code">
                          <strong>{group.code}</strong>
                          {representative?.message ? (
                            <span>{representative.message}</span>
                          ) : null}
                        </td>
                        <td data-label="Severity">
                          <span
                            className={`badge status-badge ${severityBadgeClass(group.severity)}`}
                          >
                            {group.severity}
                          </span>
                        </td>
                        <td data-label="Count">{group.count}</td>
                        <td data-label="Example">
                          {representative?.relativePath ?? '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="imports-status">No scan diagnostics.</p>
          )}
        </section>
      </div>
    </section>
  )
}

export function DraftsTable({
  drafts,
  selectedDraftId,
  onSelect,
}: {
  drafts: ReleaseImportDraft[]
  selectedDraftId: string
  onSelect: (draftId: string) => void
}) {
  return (
    <section className="panel catalog-panel">
      <div className="panel-heading">
        <div>
          <h2>Draft releases</h2>
          <p>{drafts.length} proposed releases</p>
        </div>
      </div>
      <div className="catalog-table-wrap">
        <table className="catalog-table">
          <tbody>
            {drafts.map((draft) => {
              const counts = issueSeverityCounts(draft.issues)
              return (
                <tr
                  className={
                    draft.id === selectedDraftId ? 'is-selected' : undefined
                  }
                  key={draft.id}
                >
                  <td data-label="Release">
                    <button
                      aria-current={
                        draft.id === selectedDraftId ? 'true' : undefined
                      }
                      className="imports-row-select-button"
                      type="button"
                      onClick={() => onSelect(draft.id)}
                    >
                      <span className="row-title">
                        <strong>{draft.title}</strong>
                        <span>
                          {draft.artistNames.join(', ') || 'Various Artists'}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td data-label="Status">{draft.status}</td>
                  <td data-label="Tracks">{draft.tracks.length}</td>
                  <td data-label="Issues">
                    {draft.issues.length > 0 ? (
                      <span className="badge-list imports-inline-badges">
                        {counts.warning > 0 ? (
                          <span className="badge status-badge status-amber">
                            {counts.warning}
                          </span>
                        ) : null}
                        {counts.error > 0 ? (
                          <span className="badge status-badge status-red">
                            {counts.error}
                          </span>
                        ) : null}
                        {counts.warning === 0 && counts.error === 0
                          ? draft.issues.length
                          : null}
                      </span>
                    ) : (
                      0
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function diagnosticSeverityCounts(
  summaries: ReleaseImportScanDiagnosticSummary[] | null | undefined,
) {
  return {
    error: diagnosticSeverityCount(summaries, 'error'),
    warning: diagnosticSeverityCount(summaries, 'warning'),
  }
}

function diagnosticSeverityCount(
  summaries: ReleaseImportScanDiagnosticSummary[] | null | undefined,
  severity: 'warning' | 'error',
) {
  return (summaries ?? [])
    .filter((summary) => summary.severity === severity)
    .reduce((total, summary) => total + summary.count, 0)
}

function issueSeverityCounts(issues: ImportIssue[]) {
  return {
    error: issues.filter((issue) => issue.severity === 'error').length,
    warning: issues.filter((issue) => issue.severity === 'warning').length,
  }
}

function representativeDiagnostic(
  diagnostics: ReleaseImportScanDiagnostic[],
  group: ReleaseImportScanDiagnosticSummary,
) {
  return diagnostics.find(
    (diagnostic) =>
      diagnostic.code === group.code && diagnostic.severity === group.severity,
  )
}

function scanModeLabel(mode: ReleaseImportSession['scanMode']) {
  if (mode === 'full') {
    return 'Full scan'
  }

  if (mode === 'namesOnly') {
    return 'Names only'
  }

  return 'Scan mode unavailable'
}

function severityBadgeClass(
  severity: ReleaseImportScanDiagnosticSummary['severity'],
) {
  if (severity === 'warning') {
    return 'status-amber'
  }

  if (severity === 'error') {
    return 'status-red'
  }

  return 'status-gray'
}

function pluralize(label: string, count: number) {
  return count === 1 ? label : `${label}s`
}
