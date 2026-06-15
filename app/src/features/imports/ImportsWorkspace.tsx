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
  confirmImportDraft,
  createDesktopFolderScan,
  getImportSession,
  loadImportSessions,
  restoreJsonSnapshot,
  skipImportDraft,
  updateImportDraft,
  updateImportRelationSuggestion,
  type CatalogDictionaries,
  type DesktopImportScanMode,
  type ExportRestoreResponse,
  type ImportRelationSuggestion,
  type ImportRelationSuggestionDecision,
  type ImportRelationSuggestionEndpoint,
  type ImportRelationSuggestionPayload,
  type ReleaseImportDraft,
  type ReleaseImportSession,
} from '../catalog/catalogApi'
import type { ArtistRecord } from '../artists/artistsData'
import { DraftEditor } from './ImportDraftEditor'
import {
  DraftsTable,
  ImportSourcePanel,
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
const confirmImportDraftMessage =
  'Confirm this import draft and create catalog records?'

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
  const [selectedSession, setSelectedSession] =
    useState<ReleaseImportSession | null>(null)
  const [selectedDraftId, setSelectedDraftId] = useState('')
  const [draft, setDraft] = useState<ReleaseImportDraft | null>(null)
  const [status, setStatus] = useState('Ready')
  const [error, setError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [pendingRestore, setPendingRestore] = useState(false)
  const [restoreInputKey, setRestoreInputKey] = useState(0)
  const [restoreStatus, setRestoreStatus] = useState('Ready')
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const relationSuggestions = useMemo(
    () => enrichRelationSuggestionTitles(selectedSession),
    [selectedSession],
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
      const response = await loadImportSessions()
      setSessions(response.items)
      setError(null)
      return true
    } catch (requestError) {
      return handleRequestError(requestError, 'Load failed')
    }
  }, [handleRequestError])

  useEffect(() => {
    if (skipServerImportRequests()) {
      return
    }

    queueMicrotask(() => {
      void refreshSessions()
    })
  }, [refreshSessions])

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
      const session = await createDesktopFolderScan(result.scan)
      const firstDraft = session.drafts?.[0] ?? null
      setSelectedSession(session)
      setSelectedDraftId(firstDraft?.id ?? '')
      setDraft(firstDraft ? cloneDraft(firstDraft) : null)
      const sessionsLoaded = await refreshSessions()
      if (!sessionsLoaded) {
        return
      }
      setStatus('Scan saved')
      setError(null)
    } catch (requestError) {
      handleRequestError(requestError, 'Scan failed')
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

    if (!window.confirm(confirmImportDraftMessage)) {
      setStatus('Confirmation cancelled')
      setError(null)
      return
    }

    setStatus('Confirming')
    setPendingAction('confirm')
    try {
      const savedSession = await saveDraft()
      if (!savedSession) {
        return
      }

      const session = await confirmImportDraft(savedSession.id, draft.id)
      const confirmedDraft =
        session.drafts?.find((item) => item.id === draft.id) ?? draft
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

      setSelectedSession(session)
      setSelectedDraftId(preservedDraftId)
      setDraft((currentDraft) =>
        currentDraft?.id === preservedDraftId
          ? currentDraft
          : updatedDraft
            ? cloneDraft(updatedDraft)
            : null,
      )
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
          selectedSessionId={selectedSession?.id ?? ''}
          sessions={sessions}
          onSelect={(sessionId) => {
            void openSession(sessionId)
          }}
        />

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
    </section>
  )
}

function enrichRelationSuggestionTitles(
  session: ReleaseImportSession | null,
): ImportRelationSuggestion[] {
  if (!session?.relationSuggestions?.length) {
    return []
  }

  const draftTrackTitles = new Map<string, string>()
  for (const draft of session.drafts ?? []) {
    for (const track of draft.tracks) {
      draftTrackTitles.set(track.id, track.title)
    }
  }

  return session.relationSuggestions.map((suggestion) => ({
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
