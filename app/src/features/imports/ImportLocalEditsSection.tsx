import { FileAudio, X } from 'lucide-react'
import { useState } from 'react'
import type { ReleaseImportDraft } from '../catalog/catalogApi'
import { LocalFileEditPanel } from '../localFiles/LocalFileEditPanel'
import {
  isLocalEditsAvailable,
  type LocalEditableFile,
} from '../localFiles/localFileEditModel'
import type { StagedLocalEdit } from '../localFiles/localFileEditTypes'
import {
  importEditableFiles,
  loadStagedLocalEdits,
  openReleaseInCatalog,
  saveStagedLocalEdits,
  type StagedLocalEditOutcome,
} from './importLocalEdits'

export function ImportLocalEditsSection({
  draft,
}: Readonly<{ draft: ReleaseImportDraft }>) {
  const [staged, setStaged] = useState<StagedLocalEdit[]>(() =>
    loadStagedLocalEdits(draft.id),
  )
  const [files, setFiles] = useState<LocalEditableFile[] | null>(null)

  if (
    draft.sourceKind !== 'localFiles' ||
    draft.status === 'confirmed' ||
    !isLocalEditsAvailable()
  ) {
    return null
  }

  function stage(edits: StagedLocalEdit[]) {
    saveStagedLocalEdits(draft.id, edits)
    setStaged(edits)
  }

  return (
    <section className="release-form-section imports-track-section">
      <div className="release-form-section-header">
        <div>
          <h3>Files and tags</h3>
          <p>{stagedSummary(staged.length)}</p>
        </div>
        <div className="release-section-actions">
          {staged.length > 0 ? (
            <button
              className="button button-secondary"
              type="button"
              onClick={() => stage([])}
            >
              <X size={16} /> Clear
            </button>
          ) : null}
          <button
            className="button button-secondary"
            type="button"
            onClick={() => setFiles(importEditableFiles(draft, staged))}
          >
            <FileAudio size={16} /> Prepare files and tags
          </button>
        </div>
      </div>
      {files ? (
        <LocalFileEditPanel
          files={files}
          onClose={() => setFiles(null)}
          onStage={stage}
        />
      ) : null}
    </section>
  )
}

export function LocalEditFailureNotice({
  failure,
  onDismiss,
}: Readonly<{
  failure: StagedLocalEditOutcome | null
  onDismiss: () => void
}>) {
  if (failure?.kind !== 'failed') {
    return null
  }

  return (
    <section className="panel" aria-label="Local file changes">
      <p className="imports-status">Release added to the catalog.</p>
      <p className="imports-error" role="alert">
        {failure.message}
      </p>
      <div className="imports-actions">
        <button
          className="button button-secondary"
          type="button"
          onClick={onDismiss}
        >
          Stay here
        </button>
        <button
          className="button button-primary"
          type="button"
          onClick={() => {
            onDismiss()
            openReleaseInCatalog(failure.releaseId)
          }}
        >
          Open release
        </button>
      </div>
    </section>
  )
}

function stagedSummary(count: number) {
  if (count === 0) {
    return 'Rename files and write tags when this release is confirmed.'
  }

  return count === 1
    ? '1 file changes after confirm.'
    : `${count} files change after confirm.`
}
