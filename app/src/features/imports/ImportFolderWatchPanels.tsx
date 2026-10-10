import { EyeOff, FolderInput, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import type { DiskChange, DraftDiskChanges } from './folderWatchDiff'
import type { FolderWatchState, WatchedFolderState } from './folderWatchStore'

const changeLabels: Record<DiskChange['kind'], string> = {
  added: 'New file',
  missing: 'Missing',
  modified: 'Modified',
  moved: 'Moved',
  renamed: 'Renamed',
}

type ChangeActions = Readonly<{
  onApply: (sourceRoot: string, releaseId: string) => void
  onDismiss: (sourceRoot: string, key: string) => void
}>

export function WatchedFoldersPanel({
  pendingAction,
  watch,
  onApply,
  onCheckNow,
  onDismiss,
  onOpenImport,
  onRemoveFolder,
}: Readonly<{
  pendingAction: string | null
  watch: FolderWatchState
  onCheckNow: (sourceRoot: string) => void
  onOpenImport: (sessionId: string) => void
  onRemoveFolder: (sourceRoot: string) => void
}> &
  ChangeActions) {
  const folders = Object.values(watch)
  const isBusy = isWatchAction(pendingAction)
  if (folders.length === 0) {
    return null
  }

  return (
    <section className="panel imports-watched-folders">
      <div className="panel-heading">
        <div>
          <h2>Watched folders</h2>
          <p>{folders.length} watched</p>
        </div>
      </div>
      <ul className="imports-watched-list">
        {folders.map((folder) => (
          <li key={folder.sourceRoot}>
            <div className="imports-watched-folder">
              <div>
                <strong title={folder.sourceRoot}>{folder.sourceRoot}</strong>
                <div className="imports-watch-row">
                  <span className="imports-watch-status">
                    {watchStatusText(folder)}
                  </span>
                  {folder.newDraftIds.length > 0 ? (
                    <span className="badge status-badge status-blue">
                      {folder.newDraftIds.length} new
                    </span>
                  ) : null}
                  {folder.changes.length > 0 ? (
                    <span className="badge status-badge status-amber">
                      {folder.changes.length} changed
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="imports-watch-actions">
                <IconButton
                  disabled={isBusy || folder.status === 'checking'}
                  label="Check now"
                  onClick={() => onCheckNow(folder.sourceRoot)}
                >
                  <RefreshCw size={15} aria-hidden="true" />
                </IconButton>
                {folder.sessionId ? (
                  <IconButton
                    label="Open import"
                    onClick={() => onOpenImport(folder.sessionId ?? '')}
                  >
                    <FolderInput size={15} aria-hidden="true" />
                  </IconButton>
                ) : null}
                <IconButton
                  disabled={isBusy}
                  label="Stop watching"
                  onClick={() => onRemoveFolder(folder.sourceRoot)}
                >
                  <EyeOff size={15} aria-hidden="true" />
                </IconButton>
              </div>
            </div>
            {folder.changes
              .filter((changes) => changes.inCatalog)
              .map((changes) => (
                <details className="imports-watched-release" key={changes.key}>
                  <summary>
                    <span>{changes.title}</span>
                    <span className="badge status-badge status-amber">
                      Changed on disk
                    </span>
                  </summary>
                  <CatalogChanges
                    changes={changes}
                    isBusy={isBusy}
                    sourceRoot={folder.sourceRoot}
                    onApply={onApply}
                    onDismiss={onDismiss}
                  />
                </details>
              ))}
          </li>
        ))}
      </ul>
    </section>
  )
}

function IconButton({
  children,
  disabled = false,
  label,
  onClick,
}: Readonly<{
  children: ReactNode
  disabled?: boolean
  label: string
  onClick: () => void
}>) {
  return (
    <button
      aria-label={label}
      className="button button-secondary imports-icon-button"
      disabled={disabled}
      title={label}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function CatalogChanges({
  changes,
  isBusy,
  sourceRoot,
  onApply,
  onDismiss,
}: Readonly<{
  changes: DraftDiskChanges
  isBusy: boolean
  sourceRoot: string
}> &
  ChangeActions) {
  const canApply = changes.changes.some((change) => change.kind !== 'missing')
  const hasAddedFiles = changes.changes.some(
    (change) => change.kind === 'added',
  )

  return (
    <div className="imports-disk-changes">
      <p>
        Files of this release changed after it was added to the catalog. Nothing
        is applied until you choose.
      </p>
      <ChangeList changes={changes} sourceRoot={sourceRoot} />
      <div className="imports-disk-change-actions">
        <button
          className="button button-primary button-compact"
          disabled={isBusy || !canApply}
          type="button"
          onClick={() => onApply(sourceRoot, changes.key)}
        >
          Apply to catalog
        </button>
        <button
          className="button button-secondary button-compact"
          disabled={isBusy}
          type="button"
          onClick={() => onDismiss(sourceRoot, changes.key)}
        >
          Dismiss
        </button>
      </div>
      <small>
        {hasAddedFiles
          ? 'New files are added to the import as a draft of this release for review. '
          : ''}
        Missing files are only flagged. Nothing is deleted.
      </small>
    </div>
  )
}

export function DraftWatchBadges({
  draftId,
  folder,
}: Readonly<{ draftId: string; folder: WatchedFolderState | undefined }>) {
  const isNew = folder?.newDraftIds.includes(draftId) ?? false
  const isChanged =
    folder?.changes.some((changes) => changes.key === draftId) ?? false
  if (!isNew && !isChanged) {
    return null
  }

  return (
    <span className="badge-list imports-inline-badges">
      {isNew ? (
        <span className="badge status-badge status-blue">New</span>
      ) : null}
      {isChanged ? (
        <span className="badge status-badge status-amber">Changed on disk</span>
      ) : null}
    </span>
  )
}

/** Shown above a draft in review whose folder no longer matches it. */
export function DraftDiskChangesPanel({
  changes,
  pendingAction,
  sourceRoot,
  onRecreate,
}: Readonly<{
  changes: DraftDiskChanges | undefined
  pendingAction: string | null
  sourceRoot: string
  onRecreate: (sourceRoot: string, draftId: string) => void
}>) {
  if (!changes || changes.inCatalog) {
    return null
  }

  return (
    <section
      className="panel imports-disk-changes"
      aria-labelledby="imports-disk-changes-heading"
    >
      <h3 id="imports-disk-changes-heading">Files changed on disk</h3>
      <p>This folder changed on disk since the draft was created.</p>
      <ChangeList changes={changes} sourceRoot={sourceRoot} />
      <div className="imports-disk-change-actions">
        <button
          className="button button-primary button-compact"
          disabled={
            isWatchAction(pendingAction) || changes.scanPaths.length === 0
          }
          type="button"
          onClick={() => onRecreate(sourceRoot, changes.key)}
        >
          Recreate draft
        </button>
      </div>
      <small>
        {changes.scanPaths.length === 0
          ? 'All files of this draft are missing on disk. Skip the draft if the release was removed.'
          : 'Your edits in this draft will be lost.'}
      </small>
    </section>
  )
}

function ChangeList({
  changes,
  sourceRoot,
}: Readonly<{ changes: DraftDiskChanges; sourceRoot: string }>) {
  return (
    <ul className="imports-disk-change-list">
      {changes.changes.map((change) => (
        <li key={`${change.kind}:${change.path}`}>
          <span className="badge status-badge status-gray">
            {changeLabels[change.kind]}
          </span>
          <span>
            {'previousPath' in change
              ? `${relativeTo(sourceRoot, change.previousPath)} → `
              : ''}
            {relativeTo(sourceRoot, change.path)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function isWatchAction(pendingAction: string | null) {
  return pendingAction?.startsWith('watch-') ?? false
}

function watchStatusText(folder: WatchedFolderState) {
  if (folder.status === 'checking') {
    return 'Checking…'
  }

  if (folder.status === 'error') {
    return `Check failed: ${folder.error ?? 'folder is unavailable'}`
  }

  return folder.lastCheckedAt
    ? `Checked ${new Date(folder.lastCheckedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}`
    : 'Not checked yet'
}

function relativeTo(sourceRoot: string, filePath: string) {
  return filePath.startsWith(`${sourceRoot}/`)
    ? filePath.slice(sourceRoot.length + 1)
    : filePath
}
