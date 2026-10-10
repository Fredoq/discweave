import { DateAddedSortSelect } from '../catalog/DateAddedSortSelect'
import { useDateAddedSort } from '../catalog/dateAddedSort'
import type {
  DesktopImportScanMode,
  ImportIssue,
  ImportSessionFilter,
  ReleaseImportDraft,
  ReleaseImportScanDiagnostic,
  ReleaseImportScanDiagnosticSummary,
  ReleaseImportSession,
} from '../catalog/catalogApi'
import { DraftWatchBadges } from './ImportFolderWatchPanels'
import type { FolderWatchState, WatchedFolderState } from './folderWatchStore'

const sessionFilterOptions: Array<{
  value: ImportSessionFilter
  label: string
}> = [
  { value: 'all', label: 'All active' },
  { value: 'ready', label: 'Needs review' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'skipped', label: 'Skipped' },
  { value: 'hasLooseFiles', label: 'Has loose files' },
  { value: 'hasWarningsOrErrors', label: 'Warnings/errors' },
  { value: 'missingHashes', label: 'Missing hashes' },
  { value: 'duplicateMatches', label: 'Duplicate matches' },
]

export function SessionsTable({
  includeArchived,
  isDesktop = false,
  pendingAction,
  sessions,
  selectedSessionId,
  sessionFilter,
  watch = {},
  onArchive,
  onDelete,
  onFilterChange,
  onIncludeArchivedChange,
  onRescan,
  onSelect,
  onWatchSession,
}: Readonly<{
  includeArchived: boolean
  isDesktop?: boolean
  pendingAction?: string | null
  sessions: ReleaseImportSession[]
  selectedSessionId: string
  sessionFilter: ImportSessionFilter
  watch?: FolderWatchState
  onArchive: (session: ReleaseImportSession) => void
  onWatchSession?: (session: ReleaseImportSession) => void
  onDelete: (session: ReleaseImportSession) => void
  onFilterChange: (filter: ImportSessionFilter) => void
  onIncludeArchivedChange: (includeArchived: boolean) => void
  onRescan?: (
    session: ReleaseImportSession,
    mode: DesktopImportScanMode,
  ) => void
  onSelect: (sessionId: string) => void
}>) {
  const {
    sort,
    setSort,
    sortedRecords: sortedSessions,
  } = useDateAddedSort(sessions, 'imports')
  return (
    <section className="panel catalog-panel">
      <div className="panel-heading imports-sessions-heading">
        <div>
          <h2>Sessions</h2>
          <p>{sessions.length} saved</p>
        </div>
        <div className="imports-session-filters" aria-label="Session filters">
          <DateAddedSortSelect value={sort} onChange={setSort} />
          <label>
            <span>Filter</span>
            <select
              value={sessionFilter}
              onChange={(event) => {
                onFilterChange(event.currentTarget.value as ImportSessionFilter)
              }}
            >
              {sessionFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="imports-session-archive-toggle">
            <input
              checked={includeArchived}
              type="checkbox"
              onChange={(event) => {
                onIncludeArchivedChange(event.currentTarget.checked)
              }}
            />
            <span>Show archived</span>
          </label>
        </div>
      </div>
      <div className="catalog-table-wrap">
        <table className="catalog-table imports-session-table">
          <tbody>
            {sortedSessions.map((session) => {
              const counts = diagnosticSeverityCounts(
                session.diagnosticSummaries,
              )
              const fullRescanAction = `rescan:${session.id}:full`
              const namesOnlyRescanAction = `rescan:${session.id}:namesOnly`
              const archiveAction = `archive:${session.id}`
              const deleteAction = `delete:${session.id}`
              const isSelected = session.id === selectedSessionId
              const isWatched = Object.values(watch).some(
                (folder) => folder.sessionId === session.id,
              )
              const canWatch =
                isDesktop &&
                onWatchSession &&
                session.sourceKind === 'localFiles' &&
                !session.archivedAt &&
                !watch[session.sourceRoot]
              return (
                <tr
                  className={isSelected ? 'is-selected' : undefined}
                  key={session.id}
                >
                  <td>
                    <button
                      aria-current={isSelected ? 'true' : undefined}
                      className="imports-row-select-button"
                      type="button"
                      onClick={() => {
                        onSelect(session.id)
                      }}
                    >
                      <span className="row-title">
                        <strong title={session.sourceRoot ?? undefined}>
                          {session.sourceRoot}
                        </strong>
                        {session.archivedAt ? (
                          <span className="badge status-badge status-gray">
                            Archived
                          </span>
                        ) : null}
                        {isWatched ? (
                          <span className="badge status-badge status-green">
                            Watched
                          </span>
                        ) : null}
                      </span>
                    </button>
                    <SessionMetrics
                      errors={counts.error}
                      session={session}
                      warnings={counts.warning}
                    />
                    <div className="imports-session-actions">
                      {isDesktop && onRescan ? (
                        <>
                          <button
                            className="button button-secondary button-compact"
                            disabled={pendingAction === fullRescanAction}
                            type="button"
                            onClick={() => {
                              onRescan(session, 'full')
                            }}
                          >
                            Rescan full
                          </button>
                          <button
                            aria-label="Rescan names only"
                            className="button button-secondary button-compact"
                            disabled={pendingAction === namesOnlyRescanAction}
                            title="Rescan file names only"
                            type="button"
                            onClick={() => {
                              onRescan(session, 'namesOnly')
                            }}
                          >
                            Rescan names
                          </button>
                        </>
                      ) : null}
                      {canWatch ? (
                        <button
                          aria-label="Watch folder"
                          className="button button-secondary button-compact"
                          disabled={pendingAction === 'watch-add'}
                          title="Watch this folder for new releases"
                          type="button"
                          onClick={() => {
                            onWatchSession(session)
                          }}
                        >
                          Watch
                        </button>
                      ) : null}
                      <button
                        className="button button-secondary button-compact"
                        disabled={
                          Boolean(session.archivedAt) ||
                          pendingAction === archiveAction
                        }
                        type="button"
                        onClick={() => {
                          onArchive(session)
                        }}
                      >
                        Archive
                      </button>
                      <button
                        aria-label="Delete abandoned"
                        className="button button-secondary button-compact"
                        disabled={pendingAction === deleteAction}
                        title="Delete an import with no confirmed releases"
                        type="button"
                        onClick={() => {
                          onDelete(session)
                        }}
                      >
                        Delete
                      </button>
                    </div>
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

function SessionMetrics({
  errors,
  session,
  warnings,
}: Readonly<{
  errors: number
  session: ReleaseImportSession
  warnings: number
}>) {
  const loose = session.looseFileCandidateCount ?? 0
  return (
    <dl className="imports-session-metrics">
      <SessionMetric label="drafts" value={session.draftCount} />
      <SessionMetric label="tracks" value={session.trackCount} />
      <SessionMetric label="loose" tone="amber" value={loose} />
      <SessionMetric label="ignored" value={session.ignoredFileCount} />
      <SessionMetric label="warnings" tone="amber" value={warnings} />
      <SessionMetric label="errors" tone="red" value={errors} />
    </dl>
  )
}

function SessionMetric({
  label,
  tone,
  value,
}: Readonly<{ label: string; tone?: 'amber' | 'red'; value: number }>) {
  return (
    <div className={tone && value > 0 ? `is-${tone}` : undefined}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

export function ScanReportPanel({
  session,
}: Readonly<{
  session: ReleaseImportSession
}>) {
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
          <span className="badge status-badge status-amber">
            {session.looseFileCandidateCount ?? 0} loose
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
  watchedFolder,
  onSelect,
}: Readonly<{
  drafts: ReleaseImportDraft[]
  selectedDraftId: string
  watchedFolder?: WatchedFolderState
  onSelect: (draftId: string) => void
}>) {
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
                    <DraftWatchBadges
                      draftId={draft.id}
                      folder={watchedFolder}
                    />
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
