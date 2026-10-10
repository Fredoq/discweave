import { Download } from 'lucide-react'
import { useState } from 'react'
import type { ReleaseImportLooseFileCandidate } from '../catalog/catalogApi'
import { ImportConfirmationDialog } from './ImportConfirmationDialog'
import { DraftEditor } from './ImportDraftEditor'
import {
  DraftDiskChangesPanel,
  WatchedFoldersPanel,
} from './ImportFolderWatchPanels'
import { LocalEditFailureNotice } from './ImportLocalEditsSection'
import { LooseAttachmentPanel } from './ImportLooseAttachmentPanel'
import { LooseFilesPanel } from './ImportLooseFilesPanel'
import { LooseFileReviewPanel } from './LooseFileReviewPanel'
import {
  DraftsTable,
  ScanReportPanel,
  SessionsTable,
} from './ImportReviewPanels'
import { ImportRelationSuggestionsPanel } from './ImportRelationSuggestionsPanel'
import type { ImportsWorkspaceController } from './useImportsWorkspaceController'

type ImportsWorkspaceViewProps = Readonly<{
  controller: ImportsWorkspaceController
}>

type LooseFileCandidateList = ReleaseImportLooseFileCandidate[]

const macOsDownloadUrl = '/api/imports/desktop-downloads/macos'

export function ImportsWorkspaceView({
  controller,
}: ImportsWorkspaceViewProps) {
  const [looseReviewSessionId, setLooseReviewSessionId] = useState('')
  const selectedSessionLooseCandidates =
    controller.selectedSession?.looseFileCandidates ?? []
  const selectedSessionId = controller.selectedSession?.id ?? ''
  const isLooseReviewOpen = looseReviewSessionId === selectedSessionId
  const selectedSessionHasPendingLooseFiles =
    selectedSessionLooseCandidates.some(
      (candidate) => candidate.decision === 'pending',
    )
  const shouldShowLooseReview =
    selectedSessionHasPendingLooseFiles &&
    (!controller.draft || isLooseReviewOpen)

  return (
    <section className="catalog-layout imports-layout" aria-label="Imports">
      <ImportsMainColumn
        controller={controller}
        selectedSessionLooseCandidates={selectedSessionLooseCandidates}
        selectedSessionHasPendingLooseFiles={
          selectedSessionHasPendingLooseFiles
        }
        shouldShowLooseReview={shouldShowLooseReview}
        onOpenLooseReview={() => setLooseReviewSessionId(selectedSessionId)}
        onSelectDraft={(draftId) => {
          setLooseReviewSessionId('')
          controller.actions.selectDraft(draftId)
        }}
      />
      <ImportsDetailColumn
        controller={controller}
        selectedSessionLooseCandidates={selectedSessionLooseCandidates}
        shouldShowLooseReview={shouldShowLooseReview}
      />
      {controller.draft && controller.confirmationPreflight ? (
        <ImportConfirmationDialog
          draft={controller.draft}
          isConfirming={controller.pendingAction === 'confirm'}
          preflight={controller.confirmationPreflight}
          onCancel={controller.actions.cancelDraftConfirmation}
          onConfirm={() => {
            void controller.actions.confirmDraftAfterPreflight()
          }}
        />
      ) : null}
    </section>
  )
}

function ImportsMainColumn({
  controller,
  onOpenLooseReview,
  onSelectDraft,
  selectedSessionLooseCandidates,
  selectedSessionHasPendingLooseFiles,
  shouldShowLooseReview,
}: Readonly<{
  controller: ImportsWorkspaceController
  onOpenLooseReview: () => void
  onSelectDraft: (draftId: string) => void
  selectedSessionLooseCandidates: LooseFileCandidateList
  selectedSessionHasPendingLooseFiles: boolean
  shouldShowLooseReview: boolean
}>) {
  const {
    actions,
    attachment,
    draft,
    error,
    folderWatch,
    includeArchivedSessions,
    isDesktop,
    pendingAction,
    replacementRescanMode,
    restore,
    selectedDraftId,
    selectedSession,
    sessionFilter,
    sessions,
    status,
  } = controller

  return (
    <div className="catalog-main">
      <section className="panel imports-toolbar-panel" aria-label="Import">
        <div className="imports-toolbar">
          {isDesktop ? (
            <>
              <button
                className="button button-primary"
                disabled={pendingAction === 'scan'}
                type="button"
                onClick={() => {
                  void actions.chooseLocalFolder('full')
                }}
              >
                Full scan
              </button>
              <button
                className="button button-secondary"
                disabled={pendingAction === 'scan'}
                title="Scan file names only, without opening audio files"
                type="button"
                onClick={() => {
                  void actions.chooseLocalFolder('namesOnly')
                }}
              >
                Names only
              </button>
              <button
                className="button button-secondary"
                disabled={pendingAction?.startsWith('watch-') ?? false}
                title="New releases in a watched folder appear in its import"
                type="button"
                onClick={() => {
                  void folderWatch.addFolder()
                }}
              >
                Watch folder
              </button>
            </>
          ) : (
            <a className="button button-secondary" href={macOsDownloadUrl}>
              <Download size={16} /> Download macOS app
            </a>
          )}
          <label
            className="button button-secondary imports-toolbar-restore"
            title="Load a DiscWeave JSON snapshot into an empty collection"
          >
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
            {restore.pendingRestore ? 'Restoring JSON' : 'Restore JSON'}
          </label>
        </div>
        <div className="imports-toolbar-status">
          {isDesktop ? null : (
            <p className="imports-status">
              Local folder import runs in the macOS desktop app. Desktop import
              sends metadata, hashes, paths and cover artifacts, not audio
              files.
            </p>
          )}
          {error ? (
            <p className="imports-error" role="alert">
              {error}
            </p>
          ) : (
            <output className="imports-status">{status}</output>
          )}
          {restore.restoreError ? (
            <p className="imports-error" role="alert">
              {restore.restoreError}
            </p>
          ) : null}
          {!restore.restoreError && restore.restoreStatus !== 'Ready' ? (
            <output className="imports-status">{restore.restoreStatus}</output>
          ) : null}
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

      {isDesktop ? (
        <WatchedFoldersPanel
          pendingAction={pendingAction}
          watch={folderWatch.watch}
          onApply={(sourceRoot, releaseId) => {
            void folderWatch.applyCatalogChanges(sourceRoot, releaseId)
          }}
          onCheckNow={(sourceRoot) => {
            void folderWatch.checkNow(sourceRoot)
          }}
          onDismiss={(sourceRoot, key) => {
            void folderWatch.dismissChanges(sourceRoot, key)
          }}
          onOpenImport={(sessionId) => {
            void actions.openSession(sessionId)
          }}
          onRemoveFolder={(sourceRoot) => {
            void folderWatch.removeFolder(sourceRoot)
          }}
        />
      ) : null}

      <SessionsTable
        includeArchived={includeArchivedSessions}
        isDesktop={isDesktop}
        pendingAction={pendingAction}
        selectedSessionId={selectedSession?.id ?? ''}
        sessions={sessions}
        sessionFilter={sessionFilter}
        watch={folderWatch.watch}
        onArchive={(session) => {
          void actions.archiveSession(session)
        }}
        onWatchSession={(session) => {
          void folderWatch.addFolder(session)
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
          candidates={selectedSessionLooseCandidates}
          compact={shouldShowLooseReview}
          isAttaching={pendingAction === 'loose-file-attachment'}
          isCreatingDraft={pendingAction === 'loose-file-draft'}
          onReviewLooseFiles={
            selectedSessionHasPendingLooseFiles && draft
              ? onOpenLooseReview
              : undefined
          }
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
          watchedFolder={folderWatch.selectedFolder}
          onSelect={onSelectDraft}
        />
      ) : null}
    </div>
  )
}

function ImportsDetailColumn({
  controller,
  selectedSessionLooseCandidates,
  shouldShowLooseReview,
}: Readonly<{
  controller: ImportsWorkspaceController
  selectedSessionLooseCandidates: LooseFileCandidateList
  shouldShowLooseReview: boolean
}>) {
  const {
    actions,
    artists,
    attachment,
    creditRoleOptions,
    dictionaries,
    draft,
    error,
    folderWatch,
    genreOptions,
    ownedItems,
    pendingAction,
    pendingSuggestionId,
    relationSuggestions,
    releaseTypeOptions,
    selectedSession,
    trackRelationTypeOptions,
    validationMessage,
  } = controller
  const hasSelectedSessionDrafts = (selectedSession?.drafts?.length ?? 0) > 0
  const selectedSessionHasLooseFiles = selectedSessionLooseCandidates.length > 0

  if (shouldShowLooseReview && selectedSession) {
    return (
      <div className="imports-detail-column">
        <LooseFileReviewPanel
          candidates={selectedSessionLooseCandidates}
          isAttaching={pendingAction === 'loose-file-attachment'}
          isCreatingDraft={pendingAction === 'loose-file-draft'}
          onCreateDraft={(request) => {
            void actions.createLooseFileDraft(request)
          }}
          onStartAttach={attachment.startLooseFileAttachment}
        />
      </div>
    )
  }

  if (draft) {
    return (
      <div className="imports-detail-column">
        <LocalEditFailureNotice
          failure={controller.localEditFailure}
          onDismiss={actions.dismissLocalEditFailure}
        />
        <DraftDiskChangesPanel
          changes={folderWatch.selectedFolder?.changes.find(
            (item) => item.key === draft.id,
          )}
          pendingAction={pendingAction}
          sourceRoot={folderWatch.selectedFolder?.sourceRoot ?? ''}
          onRecreate={(sourceRoot, draftId) => {
            void folderWatch.recreateDraft(sourceRoot, draftId)
          }}
        />
        <DraftEditor
          actionError={error}
          artists={artists}
          creditRoleOptions={creditRoleOptions}
          dictionaries={dictionaries}
          draft={draft}
          genreOptions={genreOptions}
          ownedItems={ownedItems}
          releaseTypeOptions={releaseTypeOptions}
          validationMessage={validationMessage}
          pendingAction={pendingAction}
          onChange={actions.updateDraft}
          onApplyExternalDiscogsRelease={actions.applyExternalDiscogsRelease}
          onConfirm={() => {
            if (
              draft.sourceKind === 'externalMetadata' &&
              draft.selectedOriginalBinding
            ) {
              void actions.confirmExternalOriginalDraft()
            } else {
              void actions.confirmDraft()
            }
          }}
          onRebindDiscogs={(request) => {
            void actions.rebindDiscogs(request)
          }}
          onRebindMusicBrainz={(request) => {
            void actions.rebindMusicBrainz(request)
          }}
          onSave={actions.saveDraft}
          onSelectExternalReleaseProvenance={(releaseId) => {
            void actions.selectExternalReleaseProvenance(releaseId)
          }}
          onSelectExternalTrackProvenance={(trackId) => {
            void actions.selectExternalTrackProvenance(trackId)
          }}
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
    )
  }

  return (
    <section className="panel detail-panel imports-detail-empty">
      <div className="detail-header">
        <ImportsEmptyDetail
          hasSelectedSessionDrafts={hasSelectedSessionDrafts}
          selectedSessionHasLooseFiles={selectedSessionHasLooseFiles}
          sessionSelected={Boolean(selectedSession)}
        />
      </div>
    </section>
  )
}

function ImportsEmptyDetail({
  hasSelectedSessionDrafts,
  selectedSessionHasLooseFiles,
  sessionSelected,
}: Readonly<{
  hasSelectedSessionDrafts: boolean
  selectedSessionHasLooseFiles: boolean
  sessionSelected: boolean
}>) {
  if (!sessionSelected) {
    return (
      <>
        <h2>Import review</h2>
        <p>Select a scan session.</p>
      </>
    )
  }

  const hasOnlyLooseFiles =
    selectedSessionHasLooseFiles && !hasSelectedSessionDrafts

  return (
    <>
      <h2>No release draft selected</h2>
      <p>
        {hasOnlyLooseFiles
          ? 'This scan only has loose file candidates. Select files to create a release draft or attach them to an existing release.'
          : 'Select a release draft from this scan to review its parsed metadata.'}
      </p>
    </>
  )
}
