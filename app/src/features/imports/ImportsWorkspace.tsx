import { Download, FolderOpen, Upload } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from 'react'
import './imports.css'
import {
  CatalogApiError,
  archiveImportSession,
  attachLooseFilesToRelease,
  confirmImportDraft,
  createDesktopFolderScan,
  createImportDraftFromLooseFiles,
  deleteImportSession,
  getImportSession,
  loadImportSessions,
  preflightImportDraftConfirmation,
  restoreJsonSnapshot,
  searchImportAttachmentReleases,
  skipImportDraft,
  updateImportDraft,
  updateImportRelationSuggestion,
  type CatalogDictionaries,
  type DesktopFolderScanRequest,
  type DesktopImportScanMode,
  type ExportRestoreResponse,
  type ImportRelationSuggestion,
  type ImportRelationSuggestionDecision,
  type ImportRelationSuggestionEndpoint,
  type ImportRelationSuggestionPayload,
  type ImportSessionFilter,
  type ReleaseDto,
  type ReleaseImportConfirmationPreflight,
  type ReleaseImportDraft,
  type ReleaseImportLooseFileCandidate,
  type ReleaseImportSession,
} from '../catalog/catalogApi'
import type { ArtistRecord } from '../artists/artistsData'
import { ImportConfirmationDialog } from './ImportConfirmationDialog'
import { LooseAttachmentPanel } from './ImportLooseAttachmentPanel'
import { DraftEditor } from './ImportDraftEditor'
import { LooseFilesPanel } from './ImportLooseFilesPanel'
import {
  DraftsTable,
  ImportSourcePanel,
  ScanReportPanel,
  SessionsTable,
} from './ImportReviewPanels'
import { ImportRelationSuggestionsPanel } from './ImportRelationSuggestionsPanel'
import {
  activeDictionaryOptions,
  activeReleaseTypeOptions,
  cloneDraft,
  draftIsValid,
  draftValidationMessage,
  errorMessage,
  isDiscWeaveDesktop,
  skipServerImportRequests,
} from './importHelpers'

type ImportsWorkspaceProps = {
  artists: ArtistRecord[]
  dictionaries: CatalogDictionaries
  onCatalogChanged: () => void
  onSessionExpired: () => void
}

const macOsDownloadUrl = '/api/imports/desktop-downloads/macos'

export function ImportsWorkspace({
  artists,
  dictionaries,
  onCatalogChanged,
  onSessionExpired,
}: ImportsWorkspaceProps) {
  const isDesktop = isDiscWeaveDesktop()
  const releaseTypeOptions = activeReleaseTypeOptions(dictionaries)
  const creditRoleOptions = activeDictionaryOptions(dictionaries, 'creditRole')
  const genreOptions = activeDictionaryOptions(dictionaries, 'genre')
  const trackRelationTypeOptions = activeDictionaryOptions(
    dictionaries,
    'trackRelationType',
  )
  const [sessions, setSessions] = useState<ReleaseImportSession[]>([])
  const [sessionFilter, setSessionFilter] = useState<ImportSessionFilter>('all')
  const [includeArchivedSessions, setIncludeArchivedSessions] = useState(false)
  const [selectedSession, setSelectedSession] =
    useState<ReleaseImportSession | null>(null)
  const [selectedDraftId, setSelectedDraftId] = useState('')
  const [draft, setDraft] = useState<ReleaseImportDraft | null>(null)
  const [confirmationPreflight, setConfirmationPreflight] =
    useState<ReleaseImportConfirmationPreflight | null>(null)
  const [status, setStatus] = useState('Ready')
  const [error, setError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [pendingRestore, setPendingRestore] = useState(false)
  const [restoreInputKey, setRestoreInputKey] = useState(0)
  const [restoreStatus, setRestoreStatus] = useState('Ready')
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [replacementRescanMode, setReplacementRescanMode] =
    useState<DesktopImportScanMode | null>(null)
  const [attachCandidateIds, setAttachCandidateIds] = useState<string[]>([])
  const [attachReleaseSearch, setAttachReleaseSearch] = useState('')
  const [attachReleaseOptions, setAttachReleaseOptions] = useState<
    ReleaseDto[]
  >([])
  const [attachSelectedReleaseId, setAttachSelectedReleaseId] = useState('')
  const [attachMappings, setAttachMappings] = useState<Record<string, string>>(
    {},
  )
  const [attachConfirmRelink, setAttachConfirmRelink] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)
  const relationSuggestions = useMemo(
    () => enrichRelationSuggestionTitles(selectedSession, selectedDraftId),
    [selectedDraftId, selectedSession],
  )
  const pendingSuggestionId = pendingAction?.startsWith('relation-suggestion:')
    ? pendingAction.slice('relation-suggestion:'.length)
    : null
  const attachCandidates = useMemo(
    () =>
      (selectedSession?.looseFileCandidates ?? []).filter(
        (candidate) =>
          attachCandidateIds.includes(candidate.id) &&
          candidate.decision === 'pending',
      ),
    [attachCandidateIds, selectedSession],
  )

  const handleRequestError = useCallback(
    (requestError: unknown, nextStatus: string) => {
      if (
        requestError instanceof CatalogApiError &&
        requestError.status === 401
      ) {
        onSessionExpired()
        return false
      }

      setError(errorMessage(requestError))
      setStatus(nextStatus)
      return false
    },
    [onSessionExpired],
  )

  const refreshSessions = useCallback(async () => {
    try {
      const response = await loadImportSessions({
        filter: sessionFilter,
        includeArchived: includeArchivedSessions,
      })
      setSessions(response.items)
      setError(null)
      return true
    } catch (requestError) {
      return handleRequestError(requestError, 'Load failed')
    }
  }, [handleRequestError, includeArchivedSessions, sessionFilter])

  useEffect(() => {
    if (skipServerImportRequests()) {
      return
    }

    queueMicrotask(() => {
      void refreshSessions()
    })
  }, [refreshSessions])

  async function saveDesktopScan(
    scan: DesktopFolderScanRequest,
    successStatus: string,
  ) {
    const session = await createDesktopFolderScan(scan)
    const firstDraft = session.drafts?.[0] ?? null
    setSelectedSession(session)
    setSelectedDraftId(firstDraft?.id ?? '')
    setDraft(firstDraft ? cloneDraft(firstDraft) : null)
    setConfirmationPreflight(null)
    const sessionsLoaded = await refreshSessions()
    if (!sessionsLoaded) {
      return false
    }

    setReplacementRescanMode(null)
    setStatus(successStatus)
    setError(null)
    return true
  }

  async function chooseLocalFolder(mode: DesktopImportScanMode) {
    if (!window.discweaveDesktop) {
      setError('Local folder import is available in the macOS desktop app.')
      return
    }

    setStatus('Waiting for folder selection')
    setPendingAction('scan')
    try {
      const result = await window.discweaveDesktop.imports.pickAndScan({ mode })
      if (result.cancelled) {
        setStatus('Folder selection cancelled')
        setError(null)
        return
      }

      setStatus('Scanning folder')
      await saveDesktopScan(result.scan, 'Scan saved')
    } catch (requestError) {
      handleRequestError(requestError, 'Scan failed')
    } finally {
      setPendingAction(null)
    }
  }

  async function rescanSessionSource(
    session: ReleaseImportSession,
    mode: DesktopImportScanMode,
  ) {
    if (!window.discweaveDesktop?.imports.rescanSource) {
      setError('Update the macOS desktop app to rescan saved folders.')
      setStatus('Rescan unavailable')
      return
    }

    setStatus('Rescanning saved source')
    setPendingAction(`rescan:${session.id}:${mode}`)
    setError(null)
    setReplacementRescanMode(null)
    try {
      const scan = await window.discweaveDesktop.imports.rescanSource(
        session.sourceRoot,
        { mode },
      )
      try {
        setStatus('Saving rescan')
        await saveDesktopScan(scan, 'Rescan saved')
      } catch (requestError) {
        handleRequestError(requestError, 'Rescan save failed')
      }
    } catch (scanError) {
      setReplacementRescanMode(mode)
      setError(`Saved source folder is unavailable. ${errorMessage(scanError)}`)
      setStatus('Rescan failed')
    } finally {
      setPendingAction(null)
    }
  }

  async function handleRestoreFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    if (!file) {
      return
    }

    setPendingRestore(true)
    setRestoreStatus('Restoring JSON backup')
    setRestoreError(null)

    try {
      const snapshot = JSON.parse(await readFileText(file)) as unknown
      const result = await restoreJsonSnapshot(snapshot)
      onCatalogChanged()
      setRestoreStatus(restoreSummary(result))
      setRestoreInputKey((key) => key + 1)
    } catch (requestError) {
      if (requestError instanceof SyntaxError) {
        setRestoreError('Select a valid JSON backup.')
      } else if (
        requestError instanceof CatalogApiError &&
        requestError.code === 'export_restore.collection_not_empty'
      ) {
        setRestoreError('Restore requires an empty collection.')
      } else if (
        requestError instanceof CatalogApiError &&
        requestError.status === 401
      ) {
        onSessionExpired()
      } else {
        setRestoreError(errorMessage(requestError))
      }
      setRestoreStatus('Restore failed')
      setRestoreInputKey((key) => key + 1)
    } finally {
      setPendingRestore(false)
    }
  }

  async function openSession(sessionId: string) {
    setStatus('Loading session')
    setPendingAction('load')
    try {
      const session = await getImportSession(sessionId)
      if (!session) {
        setSelectedSession(null)
        setSelectedDraftId('')
        setDraft(null)
        setError('Import session was not found.')
        setStatus('Load failed')
        return
      }

      const firstDraft = session.drafts?.[0] ?? null
      setSelectedSession(session)
      setSelectedDraftId(firstDraft?.id ?? '')
      setDraft(firstDraft ? cloneDraft(firstDraft) : null)
      setConfirmationPreflight(null)
      setStatus('Session loaded')
      setError(null)
    } catch (requestError) {
      handleRequestError(requestError, 'Load failed')
    } finally {
      setPendingAction(null)
    }
  }

  async function saveDraft() {
    if (!selectedSession || !draft) {
      return null
    }

    const session = await updateImportDraft(selectedSession.id, draft)
    const savedDraft =
      session.drafts?.find((item) => item.id === draft.id) ?? draft
    setSelectedSession(session)
    setSelectedDraftId(savedDraft.id)
    setDraft(cloneDraft(savedDraft))
    return session
  }

  async function confirmDraft() {
    if (!selectedSession || !draft || !draftIsValid(draft)) {
      return
    }

    setStatus('Preparing confirmation')
    setPendingAction('confirmation-preflight')
    setError(null)
    try {
      const preflight = await preflightImportDraftConfirmation(
        selectedSession.id,
        draft,
      )
      setConfirmationPreflight(preflight)
      setStatus(
        preflight.canConfirm ? 'Review confirmation' : 'Confirmation blocked',
      )
    } catch (requestError) {
      handleRequestError(requestError, 'Confirm failed')
    } finally {
      setPendingAction(null)
    }
  }

  function cancelDraftConfirmation() {
    setConfirmationPreflight(null)
    setStatus('Confirmation cancelled')
    setError(null)
  }

  async function confirmDraftAfterPreflight() {
    if (!selectedSession || !draft || !confirmationPreflight?.canConfirm) {
      return
    }

    const draftId = draft.id
    setConfirmationPreflight(null)
    setStatus('Confirming')
    setPendingAction('confirm')
    setError(null)
    try {
      const savedSession = await saveDraft()
      if (!savedSession) {
        return
      }

      const session = await confirmImportDraft(savedSession.id, draftId)
      const confirmedDraft =
        session.drafts?.find((item) => item.id === draftId) ?? draft
      setSelectedSession(session)
      setSelectedDraftId(confirmedDraft.id)
      setDraft(cloneDraft(confirmedDraft))
      const sessionsLoaded = await refreshSessions()
      if (!sessionsLoaded) {
        return
      }
      onCatalogChanged()
      setStatus('Release confirmed')
      setError(null)
    } catch (requestError) {
      handleRequestError(requestError, 'Confirm failed')
    } finally {
      setPendingAction(null)
    }
  }

  async function createLooseFileDraft(candidateIds: string[]) {
    if (!selectedSession || candidateIds.length === 0) {
      return
    }

    setStatus('Creating release draft')
    setPendingAction('loose-file-draft')
    setError(null)
    try {
      const session = await createImportDraftFromLooseFiles(
        selectedSession.id,
        candidateIds,
      )
      const selectedIds = new Set(candidateIds)
      const createdDraftId =
        session.looseFileCandidates?.find(
          (candidate) =>
            selectedIds.has(candidate.id) && Boolean(candidate.sourceDraftId),
        )?.sourceDraftId ?? session.drafts?.at(-1)?.id
      const createdDraft =
        session.drafts?.find((item) => item.id === createdDraftId) ??
        session.drafts?.at(-1) ??
        null

      setSelectedSession(session)
      setSelectedDraftId(createdDraft?.id ?? '')
      setDraft(createdDraft ? cloneDraft(createdDraft) : null)
      setConfirmationPreflight(null)
      const sessionsLoaded = await refreshSessions()
      if (!sessionsLoaded) {
        return
      }
      setStatus('Release draft created')
      setError(null)
    } catch (requestError) {
      handleRequestError(requestError, 'Release draft creation failed')
    } finally {
      setPendingAction(null)
    }
  }

  function startLooseFileAttachment(candidateIds: string[]) {
    if (candidateIds.length === 0) {
      return
    }

    const selectedCandidates = (
      selectedSession?.looseFileCandidates ?? []
    ).filter((candidate) => candidateIds.includes(candidate.id))
    setAttachCandidateIds(candidateIds)
    setAttachReleaseSearch(attachmentInitialSearch(selectedCandidates))
    setAttachReleaseOptions([])
    setAttachSelectedReleaseId('')
    setAttachMappings({})
    setAttachConfirmRelink(false)
    setAttachError(null)
    setStatus('Select release for attachment')
    setError(null)
  }

  function cancelLooseFileAttachment() {
    setAttachCandidateIds([])
    setAttachReleaseOptions([])
    setAttachSelectedReleaseId('')
    setAttachMappings({})
    setAttachConfirmRelink(false)
    setAttachError(null)
    setStatus('Attachment cancelled')
  }

  async function searchAttachmentReleases() {
    setStatus('Searching releases')
    setPendingAction('release-attachment-search')
    setAttachError(null)
    try {
      const response = await searchImportAttachmentReleases(attachReleaseSearch)
      setAttachReleaseOptions(response.items)
      setStatus(
        `${response.total} release${response.total === 1 ? '' : 's'} found`,
      )
      setError(null)
    } catch (requestError) {
      if (
        requestError instanceof CatalogApiError &&
        requestError.status === 401
      ) {
        onSessionExpired()
        return
      }

      setAttachError(errorMessage(requestError))
      setStatus('Release search failed')
    } finally {
      setPendingAction(null)
    }
  }

  function selectAttachmentRelease(release: ReleaseDto) {
    setAttachSelectedReleaseId(release.id)
    setAttachMappings(suggestAttachmentMappings(attachCandidates, release))
    setAttachError(null)
  }

  function updateAttachMapping(candidateId: string, releaseTrackId: string) {
    setAttachMappings((currentMappings) => ({
      ...currentMappings,
      [candidateId]: releaseTrackId,
    }))
  }

  async function confirmLooseFileAttachment() {
    if (!selectedSession || !attachSelectedReleaseId) {
      return
    }

    const mappings = attachCandidates
      .map((candidate) => ({
        candidateId: candidate.id,
        releaseTrackId: attachMappings[candidate.id] ?? '',
        confirmRelink: attachConfirmRelink,
      }))
      .filter((mapping) => mapping.releaseTrackId)
    if (mappings.length === 0) {
      setAttachError('Map at least one loose file to a release track.')
      return
    }

    setStatus('Attaching loose files')
    setPendingAction('loose-file-attachment')
    setAttachError(null)
    try {
      const session = await attachLooseFilesToRelease(selectedSession.id, {
        releaseId: attachSelectedReleaseId,
        mappings,
      })
      setSelectedSession(session)
      setAttachCandidateIds([])
      setAttachReleaseOptions([])
      setAttachSelectedReleaseId('')
      setAttachMappings({})
      setAttachConfirmRelink(false)
      const sessionsLoaded = await refreshSessions()
      if (!sessionsLoaded) {
        return
      }
      onCatalogChanged()
      setStatus('Loose files attached')
      setError(null)
    } catch (requestError) {
      if (
        requestError instanceof CatalogApiError &&
        requestError.status === 401
      ) {
        onSessionExpired()
        return
      }

      setAttachError(errorMessage(requestError))
      setStatus('Attachment failed')
    } finally {
      setPendingAction(null)
    }
  }

  async function skipDraft() {
    if (!selectedSession || !draft) {
      return
    }

    setStatus('Skipping')
    setPendingAction('skip')
    try {
      const session = await skipImportDraft(selectedSession.id, draft.id)
      const skippedDraft =
        session.drafts?.find((item) => item.id === draft.id) ?? draft
      setSelectedSession(session)
      setSelectedDraftId(skippedDraft.id)
      setDraft(cloneDraft(skippedDraft))
      const sessionsLoaded = await refreshSessions()
      if (!sessionsLoaded) {
        return
      }
      setStatus('Draft skipped')
      setError(null)
    } catch (requestError) {
      handleRequestError(requestError, 'Skip failed')
    } finally {
      setPendingAction(null)
    }
  }

  async function archiveSession(session: ReleaseImportSession) {
    setStatus('Archiving session')
    setPendingAction(`archive:${session.id}`)
    setError(null)
    try {
      const archived = await archiveImportSession(session.id)
      if (selectedSession?.id === session.id) {
        if (includeArchivedSessions) {
          setSelectedSession(archived)
        } else {
          setSelectedSession(null)
          setSelectedDraftId('')
          setDraft(null)
        }
        setConfirmationPreflight(null)
      }
      await refreshSessions()
      setStatus('Session archived')
      setError(null)
    } catch (requestError) {
      handleRequestError(requestError, 'Archive failed')
    } finally {
      setPendingAction(null)
    }
  }

  async function deleteSession(session: ReleaseImportSession) {
    const confirmed = window.confirm(
      'Delete this abandoned import session? Confirmed catalog data is protected and cannot be deleted here.',
    )
    if (!confirmed) {
      setStatus('Delete cancelled')
      return
    }

    setStatus('Deleting session')
    setPendingAction(`delete:${session.id}`)
    setError(null)
    try {
      await deleteImportSession(session.id)
      if (selectedSession?.id === session.id) {
        setSelectedSession(null)
        setSelectedDraftId('')
        setDraft(null)
        setConfirmationPreflight(null)
      }
      await refreshSessions()
      setStatus('Session deleted')
      setError(null)
    } catch (requestError) {
      handleRequestError(requestError, 'Delete failed')
    } finally {
      setPendingAction(null)
    }
  }

  async function handleUpdateRelationSuggestion(
    suggestionId: string,
    decision: ImportRelationSuggestionDecision,
    reviewed: ImportRelationSuggestionPayload,
  ) {
    if (!selectedSession) {
      return
    }

    const preservedDraftId = selectedDraftId
    setStatus('Updating relation suggestion')
    setPendingAction(`relation-suggestion:${suggestionId}`)
    try {
      const session = await updateImportRelationSuggestion(
        selectedSession.id,
        suggestionId,
        { decision, reviewed },
      )
      const updatedDraft =
        session.drafts?.find((item) => item.id === preservedDraftId) ?? null
      const replacementDraft = updatedDraft ? cloneDraft(updatedDraft) : null

      setSelectedSession(session)
      setSelectedDraftId(preservedDraftId)
      setDraft((currentDraft) =>
        currentDraft?.id === preservedDraftId ? replacementDraft : currentDraft,
      )
      setConfirmationPreflight(null)
      setStatus('Relation suggestion updated')
      setError(null)
    } catch (requestError) {
      handleRequestError(requestError, 'Relation suggestion update failed')
    } finally {
      setPendingAction(null)
    }
  }

  const validationMessage = draft ? draftValidationMessage(draft) : ''

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
                    void chooseLocalFolder('full')
                  }}
                >
                  <FolderOpen size={16} /> Full scan
                </button>
                <button
                  className="button button-secondary"
                  disabled={pendingAction === 'scan'}
                  type="button"
                  onClick={() => {
                    void chooseLocalFolder('namesOnly')
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
            <p
              className={error ? 'imports-error' : 'imports-status'}
              role={error ? 'alert' : 'status'}
            >
              {error ?? status}
            </p>
            {replacementRescanMode ? (
              <div className="imports-rescan-replacement">
                <span>Choose another folder to continue this rescan.</span>
                <button
                  className="button button-secondary button-compact"
                  disabled={pendingAction === 'scan'}
                  type="button"
                  onClick={() => {
                    void chooseLocalFolder(replacementRescanMode)
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
                  key={restoreInputKey}
                  accept="application/json,.json"
                  aria-label="Restore JSON backup"
                  disabled={pendingRestore}
                  onChange={(event) => {
                    void handleRestoreFileChange(event)
                  }}
                  type="file"
                />
                {pendingRestore ? 'Restoring JSON' : 'Choose JSON'}
              </label>
            </div>
            <p
              className={restoreError ? 'imports-error' : 'imports-status'}
              role={restoreError ? 'alert' : 'status'}
            >
              {restoreError ?? restoreStatus}
            </p>
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
            void archiveSession(session)
          }}
          onDelete={(session) => {
            void deleteSession(session)
          }}
          onFilterChange={setSessionFilter}
          onIncludeArchivedChange={setIncludeArchivedSessions}
          onRescan={(session, mode) => {
            void rescanSessionSource(session, mode)
          }}
          onSelect={(sessionId) => {
            void openSession(sessionId)
          }}
        />

        {selectedSession ? <ScanReportPanel session={selectedSession} /> : null}

        {selectedSession ? (
          <LooseFilesPanel
            candidates={selectedSession.looseFileCandidates}
            isAttaching={pendingAction === 'loose-file-attachment'}
            isCreatingDraft={pendingAction === 'loose-file-draft'}
            onCreateDraft={(candidateIds) => {
              void createLooseFileDraft(candidateIds)
            }}
            onStartAttach={startLooseFileAttachment}
          />
        ) : null}

        {attachCandidates.length > 0 ? (
          <LooseAttachmentPanel
            candidates={attachCandidates}
            confirmRelink={attachConfirmRelink}
            error={attachError}
            isAttaching={pendingAction === 'loose-file-attachment'}
            isSearching={pendingAction === 'release-attachment-search'}
            mappings={attachMappings}
            releaseOptions={attachReleaseOptions}
            releaseSearch={attachReleaseSearch}
            selectedReleaseId={attachSelectedReleaseId}
            onCancel={cancelLooseFileAttachment}
            onConfirm={() => {
              void confirmLooseFileAttachment()
            }}
            onConfirmRelinkChange={setAttachConfirmRelink}
            onMappingChange={updateAttachMapping}
            onReleaseSearchChange={setAttachReleaseSearch}
            onSearch={() => {
              void searchAttachmentReleases()
            }}
            onSelectRelease={selectAttachmentRelease}
          />
        ) : null}

        {selectedSession ? (
          <DraftsTable
            drafts={selectedSession.drafts ?? []}
            selectedDraftId={selectedDraftId}
            onSelect={(draftId) => {
              const selected =
                selectedSession.drafts?.find((item) => item.id === draftId) ??
                null
              setSelectedDraftId(selected?.id ?? '')
              setDraft(selected ? cloneDraft(selected) : null)
              setConfirmationPreflight(null)
            }}
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
            onChange={setDraft}
            onConfirm={() => {
              void confirmDraft()
            }}
            onSave={() => {
              setStatus('Saving draft')
              setPendingAction('save')
              void saveDraft()
                .then(() => {
                  setStatus('Draft saved')
                  setError(null)
                })
                .catch((requestError: unknown) => {
                  handleRequestError(requestError, 'Save failed')
                })
                .finally(() => {
                  setPendingAction(null)
                })
            }}
            onSkip={() => {
              void skipDraft()
            }}
          />
          <ImportRelationSuggestionsPanel
            pendingSuggestionId={pendingSuggestionId}
            relationTypeOptions={trackRelationTypeOptions}
            suggestions={relationSuggestions}
            onUpdate={handleUpdateRelationSuggestion}
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
          onCancel={cancelDraftConfirmation}
          onConfirm={() => {
            void confirmDraftAfterPreflight()
          }}
        />
      ) : null}
    </section>
  )
}

function enrichRelationSuggestionTitles(
  session: ReleaseImportSession | null,
  selectedDraftId: string,
): ImportRelationSuggestion[] {
  if (!session?.relationSuggestions?.length || !selectedDraftId) {
    return []
  }

  const draftTrackTitles = new Map<string, string>()
  for (const draft of session.drafts ?? []) {
    for (const track of draft.tracks) {
      draftTrackTitles.set(track.id, track.title)
    }
  }

  return session.relationSuggestions
    .filter((suggestion) => suggestion.draftId === selectedDraftId)
    .map((suggestion) => ({
      ...suggestion,
      suggested: enrichPayloadTitles(suggestion.suggested, draftTrackTitles),
      reviewed: enrichPayloadTitles(suggestion.reviewed, draftTrackTitles),
      targetOptions: suggestion.targetOptions.map((endpoint) =>
        enrichEndpointTitle(endpoint, draftTrackTitles),
      ),
    }))
}

function enrichPayloadTitles(
  payload: ImportRelationSuggestionPayload,
  draftTrackTitles: ReadonlyMap<string, string>,
): ImportRelationSuggestionPayload {
  return {
    ...payload,
    source: enrichEndpointTitle(payload.source, draftTrackTitles),
    target: payload.target
      ? enrichEndpointTitle(payload.target, draftTrackTitles)
      : payload.target,
  }
}

function enrichEndpointTitle(
  endpoint: ImportRelationSuggestionEndpoint,
  draftTrackTitles: ReadonlyMap<string, string>,
): ImportRelationSuggestionEndpoint {
  if (endpoint.title || endpoint.kind !== 'draftTrack') {
    return endpoint
  }

  return {
    ...endpoint,
    title: draftTrackTitles.get(endpoint.id) ?? null,
  }
}

function attachmentInitialSearch(
  candidates: ReleaseImportLooseFileCandidate[],
) {
  const albumTitle = singleDistinctValue(
    candidates.map((candidate) => candidate.albumTitleHint),
  )
  return albumTitle ?? candidates[0]?.titleHint ?? ''
}

function suggestAttachmentMappings(
  candidates: ReleaseImportLooseFileCandidate[],
  release: ReleaseDto,
) {
  const mappings: Record<string, string> = {}
  for (const candidate of candidates) {
    const releaseTrackId = suggestReleaseTrackId(candidate, release)
    if (releaseTrackId) {
      mappings[candidate.id] = releaseTrackId
    }
  }

  return mappings
}

function suggestReleaseTrackId(
  candidate: ReleaseImportLooseFileCandidate,
  release: ReleaseDto,
) {
  const tracks = (release.tracklist ?? []).filter(
    (track) => track.releaseTrackId,
  )
  const byHash = uniqueTrackId(
    tracks.filter((track) =>
      (track.linkedLocalFiles ?? []).some(
        (file) =>
          Boolean(candidate.contentHash) &&
          file.contentHash?.toLowerCase() ===
            candidate.contentHash?.toLowerCase(),
      ),
    ),
  )
  if (byHash) {
    return byHash
  }

  if (candidate.trackNumber) {
    const byTrackNumber = uniqueTrackId(
      tracks.filter((track) => track.position === candidate.trackNumber),
    )
    if (byTrackNumber) {
      return byTrackNumber
    }
  }

  const candidateTitle = normalizeTitle(
    candidate.titleHint ?? candidate.relativePath.split('/').at(-1) ?? '',
  )
  return uniqueTrackId(
    tracks.filter((track) => normalizeTitle(track.title) === candidateTitle),
  )
}

function uniqueTrackId(tracks: NonNullable<ReleaseDto['tracklist']>) {
  const ids = tracks
    .map((track) => track.releaseTrackId)
    .filter((id): id is string => Boolean(id))
  return ids.length === 1 ? ids[0] : null
}

function singleDistinctValue(values: Array<string | null | undefined>) {
  const distinctValues = [
    ...new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ]
  return distinctValues.length === 1 ? distinctValues[0] : null
}

function normalizeTitle(value: string) {
  return value
    .replace(/\.[^.]+$/, '')
    .replace(/^[\d\s._-]+/, '')
    .trim()
    .toLowerCase()
}

function restoreSummary(result: ExportRestoreResponse) {
  return `JSON restore completed: ${result.artists} artists, ${result.releases} releases, ${result.tracks} tracks, ${result.ownedItems} owned items.`
}

function readFileText(file: File) {
  if ('text' in file && typeof file.text === 'function') {
    return file.text()
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      resolve(typeof reader.result === 'string' ? reader.result : '')
    })
    reader.addEventListener('error', () => {
      reject(reader.error ?? new Error('Restore file could not be read.'))
    })
    reader.readAsText(file)
  })
}
