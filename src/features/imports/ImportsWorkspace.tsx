import { Check, Download, FolderOpen, Save, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  CatalogApiError,
  confirmImportDraft,
  createDesktopFolderScan,
  getImportSession,
  loadImportSessions,
  skipImportDraft,
  updateImportDraft,
  defaultCatalogDictionaries,
  type CatalogDictionaries,
  type DictionaryEntry,
  type EntitySuggestion,
  type ReleaseImportArtistCredit,
  type ReleaseImportDraft,
  type ReleaseImportLabel,
  type ReleaseImportDraftTrack,
  type ReleaseImportSession,
} from '../catalog/catalogApi'
import type { ArtistRecord } from '../artists/artistsData'

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
  const isDesktop = isCratebaseDesktop()
  const releaseTypeOptions = activeReleaseTypeOptions(dictionaries)
  const creditRoleOptions = activeDictionaryOptions(dictionaries, 'creditRole')
  const [sessions, setSessions] = useState<ReleaseImportSession[]>([])
  const [selectedSession, setSelectedSession] =
    useState<ReleaseImportSession | null>(null)
  const [selectedDraftId, setSelectedDraftId] = useState('')
  const [draft, setDraft] = useState<ReleaseImportDraft | null>(null)
  const [status, setStatus] = useState('Ready')
  const [error, setError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<string | null>(null)

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

  async function chooseLocalFolder() {
    if (!window.cratebaseDesktop) {
      setError('Local folder import is available in the macOS desktop app.')
      return
    }

    setStatus('Waiting for folder selection')
    setPendingAction('scan')
    try {
      const result = await window.cratebaseDesktop.imports.pickAndScan()
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

    setStatus('Confirming')
    setPendingAction('confirm')
    try {
      await saveDraft()
      const session = await confirmImportDraft(selectedSession.id, draft.id)
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
              <button
                className="button button-primary"
                disabled={pendingAction === 'scan'}
                type="button"
                onClick={() => {
                  void chooseLocalFolder()
                }}
              >
                <FolderOpen size={16} /> Choose local folder
              </button>
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
        <DraftEditor
          artists={artists}
          creditRoleOptions={creditRoleOptions}
          draft={draft}
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

function ImportSourcePanel({ isDesktop }: { isDesktop: boolean }) {
  if (isDesktop) {
    return (
      <div className="imports-agent-card">
        <div>
          <span>Desktop app</span>
          <strong>Local import enabled</strong>
          <small>
            Choose a folder on this Mac and review parsed drafts here.
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
          app.
        </small>
      </div>
    </div>
  )
}

function SessionsTable({
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
            {sessions.map((session) => (
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function DraftsTable({
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
            {drafts.map((draft) => (
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
                <td data-label="Issues">{draft.issues.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function DraftEditor({
  artists,
  creditRoleOptions,
  draft,
  releaseTypeOptions,
  validationMessage,
  onChange,
  onSave,
  onConfirm,
  onSkip,
}: {
  artists: ArtistRecord[]
  creditRoleOptions: DictionaryEntry[]
  draft: ReleaseImportDraft
  releaseTypeOptions: DictionaryEntry[]
  validationMessage: string
  onChange: (draft: ReleaseImportDraft) => void
  onSave: () => void
  onConfirm: () => void
  onSkip: () => void
}) {
  const isValid = draftIsValid(draft)
  const releaseTypeValue = releaseTypeCodeForValue(
    draft.type,
    releaseTypeOptions,
  )
  const hasReleaseTypeOption = releaseTypeOptions.some(
    (option) => option.code === releaseTypeValue,
  )
  const artistCredits = effectiveDraftArtistCredits(draft)
  const labels = effectiveDraftLabels(draft)

  return (
    <section className="panel detail-panel imports-detail">
      <div className="detail-header">
        <h2>{draft.title}</h2>
        <p>{draft.relativePath}</p>
      </div>
      <div className="imports-editor">
        <section className="release-form-section release-core-section imports-release-section">
          <div className="release-form-section-header">
            <div>
              <h3>Release metadata</h3>
              <p>Review parsed release fields before confirming.</p>
            </div>
          </div>
          <div className="imports-release-grid">
            <label className="settings-control imports-release-full-field">
              <span>Title</span>
              <input
                value={draft.title}
                onChange={(event) =>
                  onChange({ ...draft, title: event.target.value })
                }
              />
            </label>
            <label className="settings-control">
              <span>Release date</span>
              <input
                value={draft.releaseDate ?? ''}
                onChange={(event) =>
                  onChange({ ...draft, releaseDate: event.target.value })
                }
              />
            </label>
            <label className="settings-control">
              <span>Year</span>
              <input
                value={draft.year ?? ''}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    year: Number.parseInt(event.target.value, 10) || null,
                  })
                }
              />
            </label>
            <label className="settings-control">
              <span>Type</span>
              <select
                value={hasReleaseTypeOption ? releaseTypeValue : draft.type}
                onChange={(event) =>
                  onChange({ ...draft, type: event.target.value })
                }
              >
                {hasReleaseTypeOption ? null : (
                  <option value={draft.type}>{draft.type}</option>
                )}
                {releaseTypeOptions.map((releaseType) => (
                  <option key={releaseType.id} value={releaseType.code}>
                    {releaseType.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="settings-control">
              <span>Cover candidate</span>
              <input readOnly value={draft.coverPath ?? ''} />
            </label>
          </div>
        </section>

        <section className="release-form-section imports-release-section">
          <div className="release-form-section-header">
            <div>
              <h3>Artists</h3>
              <p>Release credits.</p>
            </div>
            <div className="release-section-actions">
              <label className="compact-checkbox">
                <input
                  checked={draft.isVariousArtists}
                  type="checkbox"
                  onChange={(event) =>
                    onChange({
                      ...draft,
                      isVariousArtists: event.target.checked,
                    })
                  }
                />
                <span>Various Artists</span>
              </label>
            </div>
          </div>
          <ImportArtistCreditsEditor
            artists={artists}
            credits={artistCredits}
            creditRoleOptions={creditRoleOptions}
            isVariousArtists={draft.isVariousArtists}
            onChange={(credits) =>
              onChange(withDraftArtistCredits(draft, credits))
            }
          />
        </section>

        <section className="release-form-section imports-release-section">
          <div className="release-form-section-header">
            <div>
              <h3>Labels</h3>
              <p>Release label credits and catalog numbers.</p>
            </div>
            <div className="release-section-actions">
              <label className="compact-checkbox">
                <input
                  checked={draft.notOnLabel}
                  type="checkbox"
                  onChange={(event) =>
                    onChange({ ...draft, notOnLabel: event.target.checked })
                  }
                />
                <span>Not On Label</span>
              </label>
            </div>
          </div>
          <ImportLabelsEditor
            labels={labels}
            notOnLabel={draft.notOnLabel}
            onChange={(nextLabels) =>
              onChange(withDraftLabels(draft, nextLabels))
            }
          />
        </section>

        <section className="release-form-section imports-track-section">
          <TrackDraftList
            artists={artists}
            creditRoleOptions={creditRoleOptions}
            tracks={draft.tracks}
            onChange={(tracks) => onChange({ ...draft, tracks })}
          />
        </section>

        <p className={isValid ? 'imports-status' : 'imports-error'}>
          {isValid ? 'Ready to confirm.' : validationMessage}
        </p>
        <div className="imports-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={onSave}
          >
            <Save size={16} /> Save
          </button>
          <button
            className="button button-danger"
            type="button"
            onClick={onSkip}
          >
            <X size={16} /> Skip
          </button>
          <button
            className="button button-primary"
            disabled={!isValid || draft.status === 'confirmed'}
            type="button"
            onClick={onConfirm}
          >
            <Check size={16} /> Confirm
          </button>
        </div>
      </div>
    </section>
  )
}

function ImportArtistCreditsEditor({
  artists,
  creditRoleOptions,
  credits,
  isVariousArtists,
  onChange,
}: {
  artists: ArtistRecord[]
  creditRoleOptions: DictionaryEntry[]
  credits: ReleaseImportArtistCredit[]
  isVariousArtists: boolean
  onChange: (credits: ReleaseImportArtistCredit[]) => void
}) {
  const [draftArtist, setDraftArtist] = useState('')
  const [draftArtistId, setDraftArtistId] = useState('')

  function addArtistCredit() {
    const artistName = draftArtist.trim()

    if (!artistName && !draftArtistId) {
      return
    }

    const existingArtist = artists.find((artist) => artist.id === draftArtistId)
    onChange([
      ...credits,
      {
        artistId: draftArtistId || null,
        name: existingArtist?.name ?? artistName,
        role: '',
      },
    ])
    setDraftArtist('')
    setDraftArtistId('')
  }

  if (isVariousArtists) {
    return (
      <p className="release-section-note">
        Track rows must include their own artists.
      </p>
    )
  }

  return (
    <div className="release-artist-editor">
      <div className="release-artist-composer">
        <label className="release-artist-composer-name">
          <span>Artist</span>
          <input
            aria-label="Release artist"
            placeholder="Search or type artist"
            value={draftArtist}
            onChange={(event) => {
              const nextName = event.target.value
              const existingArtist = artists.find(
                (artist) => artist.name === nextName,
              )

              setDraftArtist(nextName)
              setDraftArtistId(existingArtist?.id ?? '')
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addArtistCredit()
              }
            }}
          />
        </label>
        <button
          className="button button-secondary button-compact"
          type="button"
          onClick={addArtistCredit}
        >
          Add artist
        </button>
      </div>
      <div className="release-artist-chip-list" aria-label="Artists">
        {credits.length === 0 ? (
          <p className="release-section-note">
            Added artists will appear here.
          </p>
        ) : (
          credits.map((credit, index) => {
            const artistName = importArtistCreditName(credit, artists)
            const roleName = dictionaryNameForCode(
              credit.role,
              creditRoleOptions,
            )

            return (
              <div
                className="release-artist-chip"
                key={`${artistName}-${index}`}
              >
                <span className="release-artist-chip-name">
                  {artistName || 'Unnamed artist'}
                </span>
                <label className="release-artist-chip-role">
                  <span className="visually-hidden">
                    Role for {artistName || 'artist'}
                  </span>
                  <span
                    className={
                      credit.role
                        ? 'release-artist-chip-role-face'
                        : 'release-artist-chip-role-face release-artist-chip-role-face-unset'
                    }
                    aria-hidden="true"
                  >
                    <span>{roleName || 'Set role'}</span>
                    <span className="release-artist-chip-role-caret" />
                  </span>
                  <select
                    aria-label={`Role for ${artistName || 'artist'}`}
                    className="release-artist-chip-role-select"
                    value={credit.role}
                    onChange={(event) =>
                      onChange(
                        credits.map((currentCredit, currentIndex) =>
                          currentIndex === index
                            ? { ...currentCredit, role: event.target.value }
                            : currentCredit,
                        ),
                      )
                    }
                  >
                    <option value="">Set role</option>
                    {creditRoleOptions.map((role) => (
                      <option key={role.id} value={role.code}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  aria-label={`Remove ${artistName || 'artist'}`}
                  className="release-artist-chip-remove"
                  type="button"
                  onClick={() =>
                    onChange(
                      credits.filter(
                        (_, currentIndex) => currentIndex !== index,
                      ),
                    )
                  }
                >
                  ×
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function ImportLabelsEditor({
  labels,
  notOnLabel,
  onChange,
}: {
  labels: ReleaseImportLabel[]
  notOnLabel: boolean
  onChange: (labels: ReleaseImportLabel[]) => void
}) {
  const [draftLabel, setDraftLabel] = useState('')
  const [draftCatalogNumber, setDraftCatalogNumber] = useState('')
  const [draftHasNoCatalogNumber, setDraftHasNoCatalogNumber] = useState(false)

  function addLabel() {
    const labelName = draftLabel.trim()

    if (!labelName) {
      return
    }

    onChange([
      ...labels,
      {
        labelId: null,
        name: labelName,
        catalogNumber: draftHasNoCatalogNumber
          ? null
          : draftCatalogNumber.trim() || null,
        hasNoCatalogNumber: draftHasNoCatalogNumber,
      },
    ])
    setDraftLabel('')
    setDraftCatalogNumber('')
    setDraftHasNoCatalogNumber(false)
  }

  if (notOnLabel) {
    return (
      <p className="release-section-note">
        No label rows will be attached to this release.
      </p>
    )
  }

  return (
    <div className="release-label-editor">
      <div className="release-label-composer">
        <label className="release-label-composer-name">
          <span>Label</span>
          <input
            aria-label="Label"
            placeholder="Search or type label"
            value={draftLabel}
            onChange={(event) => setDraftLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addLabel()
              }
            }}
          />
        </label>
        <label className="settings-control">
          <span>Catalog number</span>
          <input
            aria-label="Catalog number"
            disabled={draftHasNoCatalogNumber}
            placeholder="CAT-001"
            value={draftCatalogNumber}
            onChange={(event) => setDraftCatalogNumber(event.target.value)}
          />
        </label>
        <label className="compact-checkbox release-row-checkbox">
          <input
            aria-label="No number"
            checked={draftHasNoCatalogNumber}
            type="checkbox"
            onChange={(event) => {
              setDraftHasNoCatalogNumber(event.target.checked)
              if (event.target.checked) {
                setDraftCatalogNumber('')
              }
            }}
          />
          <span>No number</span>
        </label>
        <button
          className="button button-secondary button-compact"
          type="button"
          onClick={addLabel}
        >
          Add label
        </button>
      </div>
      <div className="release-label-chip-list" aria-label="Labels">
        {labels.length === 0 ? (
          <p className="release-section-note">Added labels will appear here.</p>
        ) : (
          labels.map((label, index) => (
            <div className="release-label-chip" key={`${label.name}-${index}`}>
              <span className="release-label-chip-name">
                {label.name || 'Unnamed label'}
              </span>
              <span className="release-label-chip-number">
                {label.hasNoCatalogNumber
                  ? 'No number'
                  : label.catalogNumber || 'No number'}
              </span>
              <button
                aria-label={`Remove ${label.name || 'label'}`}
                className="release-label-chip-remove"
                type="button"
                onClick={() =>
                  onChange(
                    labels.filter((_, currentIndex) => currentIndex !== index),
                  )
                }
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function TrackDraftList({
  artists,
  creditRoleOptions,
  tracks,
  onChange,
}: {
  artists: ArtistRecord[]
  creditRoleOptions: DictionaryEntry[]
  tracks: ReleaseImportDraftTrack[]
  onChange: (tracks: ReleaseImportDraftTrack[]) => void
}) {
  const [selectedTrackId, setSelectedTrackId] = useState('')
  const [draftArtist, setDraftArtist] = useState('')
  const [draftArtistId, setDraftArtistId] = useState('')
  const selectedTrack =
    tracks.find((track) => track.id === selectedTrackId) ??
    tracks.find((track) => !track.isSkipped) ??
    tracks[0] ??
    null
  const selectedTrackIndex = selectedTrack
    ? tracks.findIndex((track) => track.id === selectedTrack.id)
    : -1

  function updateTrack(
    trackId: string,
    patch: Partial<ReleaseImportDraftTrack>,
  ) {
    onChange(
      tracks.map((track) =>
        track.id === trackId ? { ...track, ...patch } : track,
      ),
    )
  }

  function updateTrackArtistCredits(
    trackId: string,
    credits: ReleaseImportArtistCredit[],
  ) {
    onChange(
      tracks.map((track) =>
        track.id === trackId ? withTrackArtistCredits(track, credits) : track,
      ),
    )
  }

  function addTrackArtist(
    trackId: string,
    name = draftArtist,
    artistId = draftArtistId,
  ) {
    const artistName = name.trim()
    if (!artistName && !artistId) {
      return
    }

    const track = tracks.find((item) => item.id === trackId)
    if (!track) {
      return
    }

    const existingArtist = artists.find((artist) => artist.id === artistId)
    updateTrackArtistCredits(trackId, [
      ...effectiveTrackArtistCredits(track),
      {
        artistId: artistId || null,
        name: existingArtist?.name ?? artistName,
        role: '',
      },
    ])
    setDraftArtist('')
    setDraftArtistId('')
  }

  if (!selectedTrack) {
    return (
      <div className="imports-tracklist-editor">
        <div className="release-tracklist-toolbar imports-tracklist-toolbar">
          <div>
            <strong>Tracklist</strong>
            <span>No tracks found.</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="imports-tracklist-editor">
      <div className="release-tracklist-toolbar imports-tracklist-toolbar">
        <div>
          <strong>Tracklist</strong>
          <span>
            {tracks.length} tracks · selected track {selectedTrackIndex + 1}
          </span>
        </div>
      </div>
      <div className="release-tracklist-layout imports-tracklist-layout">
        <div
          className="release-tracklist-master imports-tracklist-master"
          role="list"
        >
          {tracks.map((track, index) => {
            const isSelected = track.id === selectedTrack.id
            return (
              <button
                className={
                  isSelected
                    ? 'release-tracklist-master-row is-selected'
                    : 'release-tracklist-master-row'
                }
                key={track.id}
                type="button"
                onClick={() => setSelectedTrackId(track.id)}
              >
                <span className="release-tracklist-master-number">
                  {track.position ?? index + 1}
                </span>
                <span className="release-tracklist-master-copy">
                  <strong>
                    {track.title || `Untitled track ${index + 1}`}
                  </strong>
                  <span>
                    {effectiveTrackArtistCredits(track)
                      .map((credit) => importArtistCreditName(credit, artists))
                      .filter(Boolean)
                      .join(', ') || track.relativePath}
                  </span>
                </span>
                <span className="release-tracklist-master-action">
                  {track.isSkipped ? 'Skipped' : 'Edit'}
                </span>
              </button>
            )
          })}
        </div>
        <div className="release-tracklist-detail imports-tracklist-detail">
          <div className="release-tracklist-detail-header">
            <div>
              <h4>Track {selectedTrackIndex + 1} details</h4>
              <p>{selectedTrack.relativePath}</p>
            </div>
            <label className="compact-checkbox">
              <input
                checked={selectedTrack.isSkipped}
                type="checkbox"
                onChange={(event) =>
                  updateTrack(selectedTrack.id, {
                    isSkipped: event.target.checked,
                  })
                }
              />
              <span>Skip track</span>
            </label>
          </div>
          <div className="imports-track-detail-grid">
            <label className="settings-control imports-position-field">
              <span>No.</span>
              <input
                value={selectedTrack.position ?? ''}
                onChange={(event) =>
                  updateTrack(selectedTrack.id, {
                    position: Number.parseInt(event.target.value, 10) || null,
                  })
                }
              />
            </label>
            <label className="settings-control release-track-title-field">
              <span>Track title</span>
              <input
                value={selectedTrack.title}
                onChange={(event) =>
                  updateTrack(selectedTrack.id, { title: event.target.value })
                }
              />
            </label>
          </div>
          <div className="track-artist-editor imports-track-artist-editor">
            <div className="track-artist-editor-header">
              <span>Artists</span>
            </div>
            <div className="track-artist-custom-editor">
              <div className="track-artist-composer">
                <label>
                  <span>Artist</span>
                  <input
                    aria-label="Track artist"
                    placeholder="Search or type artist"
                    value={draftArtist}
                    onChange={(event) => {
                      const nextName = event.target.value
                      const existingArtist = artists.find(
                        (artist) => artist.name === nextName,
                      )

                      setDraftArtist(nextName)
                      setDraftArtistId(existingArtist?.id ?? '')
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addTrackArtist(selectedTrack.id)
                      }
                    }}
                  />
                </label>
                <button
                  aria-label="Add track artist"
                  className="button button-secondary button-compact"
                  type="button"
                  onClick={() => addTrackArtist(selectedTrack.id)}
                >
                  Add artist
                </button>
              </div>
              <div
                className="track-artist-custom-chip-list"
                aria-label="Track artists"
              >
                {effectiveTrackArtistCredits(selectedTrack).length === 0 ? (
                  <p className="release-section-note">
                    Added track artists will appear here.
                  </p>
                ) : (
                  effectiveTrackArtistCredits(selectedTrack).map(
                    (credit, index) => {
                      const artistName = importArtistCreditName(credit, artists)
                      const roleName = dictionaryNameForCode(
                        credit.role,
                        creditRoleOptions,
                      )

                      return (
                        <div
                          className="release-artist-chip"
                          key={`${artistName}-${index}`}
                        >
                          <span className="release-artist-chip-name">
                            {artistName || 'Unnamed artist'}
                          </span>
                          <label className="release-artist-chip-role">
                            <span className="visually-hidden">
                              Track role for {artistName || 'artist'}
                            </span>
                            <span
                              className={
                                credit.role
                                  ? 'release-artist-chip-role-face'
                                  : 'release-artist-chip-role-face release-artist-chip-role-face-unset'
                              }
                              aria-hidden="true"
                            >
                              <span>{roleName || 'Set role'}</span>
                              <span className="release-artist-chip-role-caret" />
                            </span>
                            <select
                              aria-label={`Track role for ${artistName || 'artist'}`}
                              className="release-artist-chip-role-select"
                              value={credit.role}
                              onChange={(event) =>
                                updateTrackArtistCredits(
                                  selectedTrack.id,
                                  effectiveTrackArtistCredits(
                                    selectedTrack,
                                  ).map((currentCredit, currentIndex) =>
                                    currentIndex === index
                                      ? {
                                          ...currentCredit,
                                          role: event.target.value,
                                        }
                                      : currentCredit,
                                  ),
                                )
                              }
                            >
                              <option value="">Set role</option>
                              {creditRoleOptions.map((role) => (
                                <option key={role.id} value={role.code}>
                                  {role.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            aria-label={`Remove ${artistName || 'artist'} from track`}
                            className="release-artist-chip-remove"
                            type="button"
                            onClick={() =>
                              updateTrackArtistCredits(
                                selectedTrack.id,
                                effectiveTrackArtistCredits(
                                  selectedTrack,
                                ).filter(
                                  (_, currentIndex) => currentIndex !== index,
                                ),
                              )
                            }
                          >
                            ×
                          </button>
                        </div>
                      )
                    },
                  )
                )}
              </div>
            </div>
          </div>
          <SuggestionRow
            suggestions={[
              ...selectedTrack.artistSuggestions,
              ...selectedTrack.trackSuggestions,
            ]}
            selectedIds={[
              ...effectiveTrackArtistCredits(selectedTrack)
                .map((credit) => credit.artistId)
                .filter((artistId): artistId is string => Boolean(artistId)),
              ...(selectedTrack.selectedTrackId
                ? [selectedTrack.selectedTrackId]
                : []),
            ]}
            onSelect={(suggestion) => {
              const isTrackSuggestion = selectedTrack.trackSuggestions.some(
                (item) => item.id === suggestion.id,
              )
              if (isTrackSuggestion) {
                updateTrack(selectedTrack.id, {
                  selectedTrackId: suggestion.id,
                })
                return
              }

              addTrackArtist(selectedTrack.id, suggestion.name, suggestion.id)
            }}
            onClear={() =>
              updateTrack(selectedTrack.id, {
                artistCredits: [],
                artistNames: [],
                selectedArtistIds: [],
                selectedTrackId: null,
              })
            }
          />
        </div>
      </div>
    </div>
  )
}

function SuggestionRow({
  suggestions,
  selectedIds,
  onSelect,
  onClear,
}: {
  suggestions: EntitySuggestion[]
  selectedIds: string[]
  onSelect: (suggestion: EntitySuggestion) => void
  onClear: () => void
}) {
  if (suggestions.length === 0) {
    return <p className="imports-suggestions">New entity</p>
  }

  return (
    <div className="imports-suggestions">
      {suggestions.slice(0, 4).map((suggestion) => (
        <button
          className={
            selectedIds.includes(suggestion.id) ? 'is-selected' : undefined
          }
          key={suggestion.id}
          type="button"
          onClick={() => onSelect(suggestion)}
        >
          {suggestion.name}
        </button>
      ))}
      {selectedIds.length > 0 ? (
        <button type="button" onClick={onClear}>
          New
        </button>
      ) : null}
    </div>
  )
}

function cloneDraft(draft: ReleaseImportDraft): ReleaseImportDraft {
  return {
    ...draft,
    artistNames: [...draft.artistNames],
    artistCredits: (draft.artistCredits ?? []).map((credit) => ({ ...credit })),
    labels: (draft.labels ?? []).map((label) => ({ ...label })),
    selectedArtistIds: [...draft.selectedArtistIds],
    tracks: draft.tracks.map((track) => ({
      ...track,
      artistNames: [...track.artistNames],
      artistCredits: (track.artistCredits ?? []).map((credit) => ({
        ...credit,
      })),
      selectedArtistIds: [...track.selectedArtistIds],
    })),
  }
}

function draftIsValid(draft: ReleaseImportDraft) {
  return draftValidationMessage(draft) === ''
}

function draftValidationMessage(draft: ReleaseImportDraft) {
  const artistCredits = effectiveDraftArtistCredits(draft)
  const labels = effectiveDraftLabels(draft)

  if (!draft.title.trim()) {
    return 'Release title is required.'
  }

  if (
    !draft.isVariousArtists &&
    artistCredits.every((credit) => !credit.artistId && !credit.name.trim())
  ) {
    return 'Release artist is required unless this is Various Artists.'
  }

  if (
    !draft.isVariousArtists &&
    artistCredits.some(
      (credit) =>
        (credit.artistId || credit.name.trim()) && !credit.role.trim(),
    )
  ) {
    return 'Every release artist needs a role.'
  }

  if (
    !draft.notOnLabel &&
    labels.every((label) => !label.labelId && !label.name.trim())
  ) {
    return 'Label is required unless Not on label is selected.'
  }

  if (draft.tracks.some((track) => !track.isSkipped && !track.title.trim())) {
    return 'Every included track needs a title.'
  }

  if (
    draft.isVariousArtists &&
    draft.tracks.some(
      (track) =>
        !track.isSkipped &&
        effectiveTrackArtistCredits(track).every(
          (credit) => !credit.artistId && !credit.name.trim(),
        ),
    )
  ) {
    return 'Every included track needs at least one artist for Various Artists releases.'
  }

  if (
    draft.tracks.some((track) =>
      effectiveTrackArtistCredits(track).some(
        (credit) =>
          (credit.artistId || credit.name.trim()) && !credit.role.trim(),
      ),
    )
  ) {
    return 'Every track artist needs a role.'
  }

  return ''
}

function effectiveDraftArtistCredits(draft: ReleaseImportDraft) {
  if (draft.artistCredits && draft.artistCredits.length > 0) {
    return draft.artistCredits
  }

  return draft.artistNames.map(
    (name, index): ReleaseImportArtistCredit => ({
      artistId: draft.selectedArtistIds[index] ?? null,
      name,
      role: 'mainArtist',
    }),
  )
}

function effectiveDraftLabels(draft: ReleaseImportDraft) {
  if (draft.labels && draft.labels.length > 0) {
    return draft.labels
  }

  return draft.labelName?.trim()
    ? [
        {
          labelId: null,
          name: draft.labelName,
          catalogNumber: draft.catalogNumber ?? null,
          hasNoCatalogNumber: !draft.catalogNumber?.trim(),
        },
      ]
    : []
}

function withDraftArtistCredits(
  draft: ReleaseImportDraft,
  credits: ReleaseImportArtistCredit[],
): ReleaseImportDraft {
  const normalizedCredits = credits
    .map((credit) => ({
      artistId: credit.artistId ?? null,
      name: credit.name.trim(),
      role: credit.role.trim(),
    }))
    .filter((credit) => credit.artistId || credit.name)

  return {
    ...draft,
    artistCredits: normalizedCredits,
    artistNames: normalizedCredits.map((credit) => credit.name),
    selectedArtistIds: normalizedCredits
      .map((credit) => credit.artistId)
      .filter((artistId): artistId is string => Boolean(artistId)),
  }
}

function withDraftLabels(
  draft: ReleaseImportDraft,
  labels: ReleaseImportLabel[],
): ReleaseImportDraft {
  const normalizedLabels = labels
    .map((label) => ({
      labelId: label.labelId ?? null,
      name: label.name.trim(),
      catalogNumber: label.hasNoCatalogNumber
        ? null
        : label.catalogNumber?.trim() || null,
      hasNoCatalogNumber: label.hasNoCatalogNumber,
    }))
    .filter((label) => label.labelId || label.name)
  const firstLabel = normalizedLabels[0]

  return {
    ...draft,
    labels: normalizedLabels,
    labelName: firstLabel?.name ?? null,
    catalogNumber: firstLabel?.catalogNumber ?? null,
  }
}

function effectiveTrackArtistCredits(track: ReleaseImportDraftTrack) {
  if (track.artistCredits && track.artistCredits.length > 0) {
    return track.artistCredits
  }

  return track.artistNames.map(
    (name, index): ReleaseImportArtistCredit => ({
      artistId: track.selectedArtistIds[index] ?? null,
      name,
      role: 'mainArtist',
    }),
  )
}

function withTrackArtistCredits(
  track: ReleaseImportDraftTrack,
  credits: ReleaseImportArtistCredit[],
): ReleaseImportDraftTrack {
  const normalizedCredits = credits
    .map((credit) => ({
      artistId: credit.artistId ?? null,
      name: credit.name.trim(),
      role: credit.role.trim(),
    }))
    .filter((credit) => credit.artistId || credit.name)

  return {
    ...track,
    artistCredits: normalizedCredits,
    artistNames: normalizedCredits.map((credit) => credit.name),
    selectedArtistIds: normalizedCredits
      .map((credit) => credit.artistId)
      .filter((artistId): artistId is string => Boolean(artistId)),
  }
}

function importArtistCreditName(
  credit: ReleaseImportArtistCredit,
  artists: ArtistRecord[],
) {
  if (!credit.artistId) {
    return credit.name.trim()
  }

  return (
    artists.find((artist) => artist.id === credit.artistId)?.name.trim() ??
    credit.name.trim()
  )
}

function dictionaryNameForCode(code: string, options: DictionaryEntry[]) {
  return (
    options.find((option) => option.code === code || option.name === code)
      ?.name ?? code
  )
}

function activeDictionaryOptions(
  dictionaries: CatalogDictionaries,
  kind: 'creditRole' | 'releaseType',
) {
  const activeOptions = dictionaries[kind].filter((entry) => entry.isActive)

  return activeOptions.length > 0
    ? activeOptions
    : defaultCatalogDictionaries[kind].filter((entry) => entry.isActive)
}

function activeReleaseTypeOptions(dictionaries: CatalogDictionaries) {
  return activeDictionaryOptions(dictionaries, 'releaseType')
}

function releaseTypeCodeForValue(
  value: string,
  releaseTypeOptions: DictionaryEntry[],
) {
  const normalized = value.trim()
  const matchingOption = releaseTypeOptions.find(
    (option) => option.code === normalized || option.name === normalized,
  )

  return matchingOption?.code ?? normalized
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Request failed.'
}

function skipServerImportRequests() {
  return (
    import.meta.env.MODE === 'test' &&
    !('__cratebaseUseRealCatalogApi' in globalThis)
  )
}

function isCratebaseDesktop() {
  return window.cratebaseDesktop?.isDesktop === true
}
