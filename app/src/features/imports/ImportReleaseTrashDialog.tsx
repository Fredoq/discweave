import { FolderX, LoaderCircle, Trash2 } from 'lucide-react'
import type { ReleaseImportDraft } from '../catalog/catalogApi'
import type { ImportReleaseTrashPlan } from './importFileActions'
import type { ImportReleaseTrash } from './useImportReleaseTrash'
import './imports-trash.css'

type ImportReleaseTrashDialogProps = Readonly<{
  draft: ReleaseImportDraft
  trash: ImportReleaseTrash
}>

export function ImportReleaseTrashDialog({
  draft,
  trash,
}: ImportReleaseTrashDialogProps) {
  const { state } = trash
  if (state.status === 'closed' || trash.draftId !== draft.id) {
    return null
  }

  const headingId = 'import-release-trash-dialog-title'
  const plan = state.status === 'planning' ? null : state.plan
  const isTrashing = state.status === 'trashing'

  return (
    <div className="imports-confirmation-backdrop">
      <dialog
        open
        aria-labelledby={headingId}
        aria-modal="true"
        className="imports-confirmation-dialog imports-trash-dialog"
      >
        <div className="imports-confirmation-header">
          <div>
            <p className="section-label">Delete from disk</p>
            <h2 id={headingId}>Move release to Trash?</h2>
            <p>
              {draft.title}
              {draft.artistNames.length > 0
                ? ` · ${draft.artistNames.join(', ')}`
                : ''}
            </p>
          </div>
        </div>

        {state.status === 'planning' ? (
          <p className="imports-status">
            <LoaderCircle
              aria-hidden="true"
              className="imports-track-play-spinner"
              size={14}
            />{' '}
            Checking release files...
          </p>
        ) : null}
        {plan ? <TrashPlanSummary plan={plan} /> : null}
        {state.status === 'failed' ? (
          <p className="imports-error" role="alert">
            {state.message}
          </p>
        ) : null}

        <div className="imports-confirmation-footer">
          <button
            className="button button-secondary"
            disabled={isTrashing}
            type="button"
            onClick={trash.cancel}
          >
            Cancel
          </button>
          <button
            className="button button-danger"
            disabled={state.status !== 'ready'}
            type="button"
            onClick={() => {
              void trash.confirm(draft)
            }}
          >
            <Trash2 aria-hidden="true" size={16} />
            {isTrashing ? 'Moving to Trash...' : 'Move to Trash'}
          </button>
        </div>
      </dialog>
    </div>
  )
}

function TrashPlanSummary({
  plan,
}: Readonly<{ plan: ImportReleaseTrashPlan }>) {
  const audioCount = plan.audioFiles.length
  const isFolder = plan.mode === 'folder'

  return (
    <section
      aria-label="Files to move"
      className="imports-confirmation-section imports-trash-plan"
    >
      <div className="imports-trash-target">
        <FolderX aria-hidden="true" size={18} />
        <div>
          <strong>
            {isFolder
              ? 'The whole release folder goes to Trash'
              : `Only this release's ${formatCount(audioCount, 'audio file')} go to Trash`}
          </strong>
          {plan.folderPath ? (
            <p className="imports-trash-path" title={plan.folderPath}>
              {plan.folderPath}
            </p>
          ) : null}
        </div>
      </div>
      <ul className="imports-trash-counts">
        <li>{formatCount(audioCount, 'audio file')}</li>
        {isFolder && plan.otherFileCount > 0 ? (
          <li>
            {formatCount(plan.otherFileCount, 'other file')} (
            {otherFileSummary(plan)})
          </li>
        ) : null}
        {plan.missingFiles.length > 0 ? (
          <li>
            {formatCount(plan.missingFiles.length, 'file')} already missing
          </li>
        ) : null}
      </ul>
      {!isFolder && plan.foreignAudioFileCount > 0 ? (
        <p className="imports-trash-note">
          The folder also holds{' '}
          {formatCount(plan.foreignAudioFileCount, 'audio file')} from other
          releases, so the folder itself stays.
        </p>
      ) : null}
      <p className="imports-trash-note">
        Files go to the macOS Trash and can be restored from there. The draft
        will be marked Skipped.
      </p>
    </section>
  )
}

function otherFileSummary(plan: ImportReleaseTrashPlan) {
  const hiddenCount = plan.otherFileCount - plan.otherFileSamples.length
  return hiddenCount > 0
    ? `${plan.otherFileSamples.join(', ')}, …`
    : plan.otherFileSamples.join(', ')
}

function formatCount(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}
