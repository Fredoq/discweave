import type { NamingProfile } from '../catalog/catalogApi'
import {
  changeSummary,
  fileName,
  technicalSummary,
} from './localFileEditHelpers'
import type {
  InspectState,
  LocalEditableFileDraft,
  LocalEditPreviewResult,
  LocalFilePreviewRow,
  LocalValidationIssue,
} from './localFileEditTypes'

export function ProfileTemplateSummary({
  profile,
}: {
  profile: NamingProfile
}) {
  return (
    <div className="local-file-edit-template-grid">
      <label className="local-file-edit-field">
        <span>Release folder template</span>
        <input readOnly value={profile.releaseFolderTemplate} />
      </label>
      <label className="local-file-edit-field">
        <span>Track file template</span>
        <input readOnly value={profile.trackFileTemplate} />
      </label>
      <label className="local-file-edit-field">
        <span>Track file with artist template</span>
        <input readOnly value={profile.trackFileWithArtistTemplate} />
      </label>
    </div>
  )
}

export function SingleFileEditor({
  draft,
  inspection,
  rows,
  validationIssues,
  validationState,
  onTargetPathChange,
}: {
  draft: LocalEditableFileDraft
  inspection?: InspectState
  rows: LocalFilePreviewRow[]
  validationIssues: LocalValidationIssue[]
  validationState: LocalEditPreviewResult | null
  onTargetPathChange: (ownedItemId: string, targetPath: string) => void
}) {
  return (
    <div className="local-file-edit-list">
      <article className="local-file-edit-file">
        <div className="local-file-edit-file-heading">
          <strong>{draft.title}</strong>
          <dl>
            <div>
              <dt>Current path</dt>
              <dd>{draft.currentPath}</dd>
            </div>
          </dl>
        </div>
        <label className="local-file-edit-field">
          <span>Target path</span>
          <input
            aria-label="Target path"
            value={draft.targetPath}
            onChange={(event) =>
              onTargetPathChange(draft.ownedItemId, event.currentTarget.value)
            }
          />
        </label>
        <InspectionSummary inspection={inspection} />
      </article>
      <ProposedChangesTable
        rows={rows}
        validationIssues={validationIssues}
        validationState={validationState}
      />
    </div>
  )
}

export function ReleaseBatchEditor({
  currentReleaseFolder,
  rows,
  targetReleaseFolder,
  unchangedCount,
  validationIssues,
  validationState,
  renameCount,
  onTargetReleaseFolderChange,
}: {
  currentReleaseFolder: string
  rows: LocalFilePreviewRow[]
  targetReleaseFolder: string
  unchangedCount: number
  validationIssues: LocalValidationIssue[]
  validationState: LocalEditPreviewResult | null
  renameCount: number
  onTargetReleaseFolderChange: (targetReleaseFolder: string) => void
}) {
  return (
    <div className="local-file-edit-release-batch">
      <div className="local-file-edit-release-folders">
        <div className="local-file-edit-static-field">
          <span>Current release folder</span>
          <p>{currentReleaseFolder}</p>
        </div>
        <label className="local-file-edit-field">
          <span>New release folder</span>
          <input
            aria-label="New release folder"
            value={targetReleaseFolder}
            onChange={(event) =>
              onTargetReleaseFolderChange(event.currentTarget.value)
            }
          />
        </label>
      </div>
      <ProposedChangesTable
        rows={rows}
        summary={`${renameCount} rename / ${unchangedCount} unchanged`}
        validationIssues={validationIssues}
        validationState={validationState}
      />
    </div>
  )
}

function ProposedChangesTable({
  rows,
  summary,
  validationIssues,
  validationState,
}: {
  rows: LocalFilePreviewRow[]
  summary?: string
  validationIssues: LocalValidationIssue[]
  validationState: LocalEditPreviewResult | null
}) {
  const hasChanges = rows.some((row) => row.rename)

  return (
    <section className="local-file-edit-proposed" aria-label="Proposed changes">
      <div className="local-file-edit-proposed-heading">
        <h3>Proposed changes</h3>
        <div>
          {validationState ? (
            <span
              className={`status-badge ${
                validationState.ok ? 'status-green' : 'status-amber'
              }`}
            >
              {validationState.ok ? 'Ready' : 'Blocked'}
            </span>
          ) : null}
          <span>{summary ?? changeSummary(rows)}</span>
        </div>
      </div>
      {!hasChanges ? (
        <p className="local-file-edit-no-changes">
          No file name changes for the selected profile.
        </p>
      ) : null}
      {validationIssues.length > 0 ? (
        <div className="local-file-edit-validation" role="alert">
          <h4>Validation issues</h4>
          <ul>
            {validationIssues.map((issue) => (
              <li key={`${issue.ownedItemId}-${issue.code}-${issue.message}`}>
                <strong>{issue.title}</strong>: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="local-file-edit-table-scroll">
        <table className="local-file-edit-change-table">
          <thead>
            <tr>
              <th>Track</th>
              <th>Current file name</th>
              <th>New file name</th>
              <th>Metadata</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.ownedItemId}>
                <td>{row.position}</td>
                <td>{fileName(row.currentPath)}</td>
                <td>{fileName(row.targetPath)}</td>
                <td>
                  <span className="local-file-edit-chip local-file-edit-chip-muted">
                    {row.tagWritable ? 'Writable tags' : 'Read-only tags'}
                  </span>
                </td>
                <td>
                  <span
                    className={`local-file-edit-chip ${
                      row.issues.some((issue) => issue.severity === 'error')
                        ? 'local-file-edit-chip-warning'
                        : row.rename
                          ? 'local-file-edit-chip-active'
                          : 'local-file-edit-chip-muted'
                    }`}
                  >
                    {row.issues.some((issue) => issue.severity === 'error')
                      ? 'Blocked'
                      : row.rename
                        ? 'Will rename'
                        : 'No change'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function InspectionSummary({ inspection }: { inspection?: InspectState }) {
  if (!inspection || inspection.status === 'loading') {
    return <p role="status">Inspecting file...</p>
  }

  if (inspection.status === 'failed') {
    return <p role="alert">{inspection.message}</p>
  }

  const { result } = inspection
  const artists = result.tags.artists?.join(', ') || 'No artist tag'
  const title = result.tags.title || 'No title tag'

  return (
    <dl className="detail-list local-file-edit-tags">
      <div>
        <dt>Embedded title</dt>
        <dd>{title}</dd>
      </div>
      <div>
        <dt>Embedded artist</dt>
        <dd>{artists}</dd>
      </div>
      <div>
        <dt>Technical</dt>
        <dd>
          {result.format.toUpperCase()} / {technicalSummary(result.technical)}
        </dd>
      </div>
    </dl>
  )
}
