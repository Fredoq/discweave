import { Download, FolderOpen, Upload } from 'lucide-react'
import { ImportConfirmationDialog } from './ImportConfirmationDialog'
import { DraftEditor } from './ImportDraftEditor'
import { LooseAttachmentPanel } from './ImportLooseAttachmentPanel'
import { LooseFilesPanel } from './ImportLooseFilesPanel'
import {
  DraftsTable,
  ImportSourcePanel,
  ScanReportPanel,
  SessionsTable,
} from './ImportReviewPanels'
import { ImportRelationSuggestionsPanel } from './ImportRelationSuggestionsPanel'
import type { ImportsWorkspaceController } from './useImportsWorkspaceController'

type ImportsWorkspaceViewProps = Readonly<{
  controller: ImportsWorkspaceController
}>

const macOsDownloadUrl = '/api/imports/desktop-downloads/macos'

export function ImportsWorkspaceView({
  controller,
}: ImportsWorkspaceViewProps) {
  const {
    actions,
    artists,
    attachment,
    confirmationPreflight,
    creditRoleOptions,
    dictionaries,
    draft,
    error,
    genreOptions,
    includeArchivedSessions,
    isDesktop,
    pendingAction,
    pendingSuggestionId,
    relationSuggestions,
    releaseTypeOptions,
    replacementRescanMode,
    restore,
    selectedDraftId,
    selectedSession,
    sessionFilter,
    sessions,
    status,
    trackRelationTypeOptions,
    validationMessage,
  } = controller

  return (
    <section className="catalog-layout imports-layout" aria-label="Imports">
      <div className="catalog-main">
        <section className="panel imports-scan-panel">
          <div className="panel-heading">
            <div>
              <h2>Local folder import</h2>
              <p>Audio: FLAC, MP3, WAV, OGG, M4A. Covers: JPG, PNG, WEBP.</p>
            </div>
            {isDesktop ? (
              <div className="imports-scan-actions">
                <button
                  className="button button-primary"
                  disabled={pendingAction === 'scan'}
                  type="button"
                  onClick={() => {
                    void actions.chooseLocalFolder('full')
                  }}
                >
                  <FolderOpen size={16} /> Full scan
                </button>
                <button
                  className="button button-secondary"
                  disabled={pendingAction === 'scan'}
                  type="button"
                  onClick={() => {
                    void actions.chooseLocalFolder('namesOnly')
                  }}
                >
                  <FolderOpen size={16} /> Names only
                </button>
              </div>
            ) : (
              <a className="button button-secondary" href={macOsDownloadUrl}>
                <Download size={16} /> Download macOS app
              </a>
            )}
          </div>
          <div className="imports-scan-body">
            <ImportSourcePanel isDesktop={isDesktop} />
            {error ? (
              <p className="imports-error" role="alert">
                {error}
              </p>
            ) : (
              <output className="imports-status">{status}</output>
            )}
            {replacementRescanMode ? (
              <div className="imports-rescan-replacement">
                <span>Choose another folder to continue this rescan.</span>
                <button
                  className="button button-secondary button-compact"
                  disabled={pendingAction === 'scan'}
                  type="button"
                  onClick={() => {
                    void actions.chooseLocalFolder(replacementRescanMode)
                  }}
                >
                  Choose replacement folder
                </button>
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel imports-restore-panel">
          <div className="panel-heading">
            <div>
              <h2>Restore JSON backup</h2>
              <p>Load a DiscWeave JSON snapshot into an empty collection.</p>
            </div>
            <Upload size={18} aria-hidden="true" />
          </div>
          <div className="imports-restore-body">
            <div className="imports-restore-row">
              <span className="imports-restore-icon" aria-hidden="true">
                <Upload size={18} strokeWidth={2.1} />
              </span>
              <span>
                <strong>JSON backup</strong>
                <small>Restores exported catalog data and settings.</small>
              </span>
              <label className="button button-secondary">
                <input
                  key={restore.restoreInputKey}
                  accept="application/json,.json"
                  aria-label="Restore JSON backup"
                  disabled={restore.pendingRestore}
                  onChange={(event) => {
                    void restore.handleRestoreFileChange(event)
                  }}
                  type="file"
                />
                {restore.pendingRestore ? 'Restoring JSON' : 'Choose JSON'}
              </label>
            </div>
            {restore.restoreError ? (
              <p className="imports-error" role="alert">
                {restore.restoreError}
              </p>
            ) : (
              <output className="imports-status">
                {restore.restoreStatus}
              </output>
            )}
          </div>
        </section>

        <SessionsTable
          includeArchived={includeArchivedSessions}
          isDesktop={isDesktop}
          pendingAction={pendingAction}
          selectedSessionId={selectedSession?.id ?? ''}
          sessions={sessions}
          sessionFilter={sessionFilter}
          onArchive={(session) => {
            void actions.archiveSession(session)
          }}
          onDelete={(session) => {
            void actions.deleteSession(session)
          }}
          onFilterChange={actions.setSessionFilter}
          onIncludeArchivedChange={actions.setIncludeArchivedSessions}
          onRescan={(session, mode) => {
            void actions.rescanSessionSource(session, mode)
          }}
          onSelect={(sessionId) => {
            void actions.openSession(sessionId)
          }}
        />

        {selectedSession ? <ScanReportPanel session={selectedSession} /> : null}

        {selectedSession ? (
          <LooseFilesPanel
            candidates={selectedSession.looseFileCandidates}
            isAttaching={pendingAction === 'loose-file-attachment'}
            isCreatingDraft={pendingAction === 'loose-file-draft'}
            onCreateDraft={(candidateIds) => {
              void actions.createLooseFileDraft(candidateIds)
            }}
            onStartAttach={attachment.startLooseFileAttachment}
          />
        ) : null}

        {attachment.attachCandidates.length > 0 ? (
          <LooseAttachmentPanel
            candidates={attachment.attachCandidates}
            confirmRelink={attachment.attachConfirmRelink}
            error={attachment.attachError}
            isAttaching={pendingAction === 'loose-file-attachment'}
            isSearching={pendingAction === 'release-attachment-search'}
            mappings={attachment.attachMappings}
            releaseOptions={attachment.attachReleaseOptions}
            releaseSearch={attachment.attachReleaseSearch}
            selectedReleaseId={attachment.attachSelectedReleaseId}
            onCancel={attachment.cancelLooseFileAttachment}
            onConfirm={() => {
              void attachment.confirmLooseFileAttachment()
            }}
            onConfirmRelinkChange={attachment.setAttachConfirmRelink}
            onMappingChange={attachment.updateAttachMapping}
            onReleaseSearchChange={attachment.setAttachReleaseSearch}
            onSearch={() => {
              void attachment.searchAttachmentReleases()
            }}
            onSelectRelease={attachment.selectAttachmentRelease}
          />
        ) : null}

        {selectedSession ? (
          <DraftsTable
            drafts={selectedSession.drafts ?? []}
            selectedDraftId={selectedDraftId}
            onSelect={actions.selectDraft}
          />
        ) : null}
      </div>

      {draft ? (
        <div className="imports-detail-column">
          <DraftEditor
            actionError={error}
            artists={artists}
            creditRoleOptions={creditRoleOptions}
            dictionaries={dictionaries}
            draft={draft}
            genreOptions={genreOptions}
            releaseTypeOptions={releaseTypeOptions}
            validationMessage={validationMessage}
            onChange={actions.updateDraft}
            onConfirm={() => {
              void actions.confirmDraft()
            }}
            onSave={actions.saveDraft}
            onSkip={() => {
              void actions.skipDraft()
            }}
          />
          <ImportRelationSuggestionsPanel
            pendingSuggestionId={pendingSuggestionId}
            relationTypeOptions={trackRelationTypeOptions}
            suggestions={relationSuggestions}
            onUpdate={actions.updateRelationSuggestion}
          />
        </div>
      ) : (
        <section className="panel detail-panel imports-detail-empty">
          <div className="detail-header">
            <h2>Import review</h2>
            <p>Select a scan session.</p>
          </div>
        </section>
      )}

      {draft && confirmationPreflight ? (
        <ImportConfirmationDialog
          draft={draft}
          isConfirming={pendingAction === 'confirm'}
          preflight={confirmationPreflight}
          onCancel={actions.cancelDraftConfirmation}
          onConfirm={() => {
            void actions.confirmDraftAfterPreflight()
          }}
        />
      ) : null}
    </section>
  )
}
