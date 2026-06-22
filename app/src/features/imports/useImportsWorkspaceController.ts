import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ArtistRecord } from '../artists/artistsData'
import {
  CatalogApiError,
  archiveImportSession,
  confirmImportDraft,
  createDesktopFolderScan,
  createImportDraftFromLooseFiles,
  deleteImportSession,
  getImportSession,
  loadImportSessions,
  preflightImportDraftConfirmation,
  skipImportDraft,
  updateImportDraft,
  updateImportRelationSuggestion,
  type CatalogDictionaries,
  type DesktopFolderScanRequest,
  type DesktopImportScanMode,
  type ImportRelationSuggestionDecision,
  type ImportRelationSuggestionPayload,
  type ImportSessionFilter,
  type ReleaseImportConfirmationPreflight,
  type ReleaseImportDraft,
  type ReleaseImportSession,
} from '../catalog/catalogApi'
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
import {
  enrichRelationSuggestionTitles,
  pendingRelationSuggestionId,
} from './importWorkspaceHelpers'
import { useImportRestoreController } from './useImportRestoreController'
import { useLooseFileAttachmentController } from './useLooseFileAttachmentController'

export type ImportsWorkspaceProps = Readonly<{
  artists: ArtistRecord[]
  dictionaries: CatalogDictionaries
  onCatalogChanged: () => void
  onSessionExpired: () => void
}>

export function useImportsWorkspaceController({
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
  const [replacementRescanMode, setReplacementRescanMode] =
    useState<DesktopImportScanMode | null>(null)

  const relationSuggestions = useMemo(
    () => enrichRelationSuggestionTitles(selectedSession, selectedDraftId),
    [selectedDraftId, selectedSession],
  )
  const pendingSuggestionId = pendingRelationSuggestionId(pendingAction)

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

  const restore = useImportRestoreController({
    onCatalogChanged,
    onSessionExpired,
  })
  const attachment = useLooseFileAttachmentController({
    onCatalogChanged,
    onSessionExpired,
    refreshSessions,
    selectedSession,
    setError,
    setPendingAction,
    setSelectedSession,
    setStatus,
  })

  useEffect(() => {
    if (skipServerImportRequests()) {
      return
    }

    queueMicrotask(() => {
      refreshSessions().catch((requestError: unknown) => {
        handleRequestError(requestError, 'Load failed')
      })
    })
  }, [handleRequestError, refreshSessions])

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
    if (!globalThis.discweaveDesktop) {
      setError('Local folder import is available in the macOS desktop app.')
      return
    }

    setStatus('Waiting for folder selection')
    setPendingAction('scan')
    try {
      const result = await globalThis.discweaveDesktop.imports.pickAndScan({
        mode,
      })
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
    if (!globalThis.discweaveDesktop?.imports.rescanSource) {
      setError('Update the macOS desktop app to rescan saved folders.')
      setStatus('Rescan unavailable')
      return
    }

    setStatus('Rescanning saved source')
    setPendingAction(`rescan:${session.id}:${mode}`)
    setError(null)
    setReplacementRescanMode(null)
    try {
      const scan = await globalThis.discweaveDesktop.imports.rescanSource(
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

  function selectDraft(draftId: string) {
    const selected =
      selectedSession?.drafts?.find((item) => item.id === draftId) ?? null
    setSelectedDraftId(selected?.id ?? '')
    setDraft(selected ? cloneDraft(selected) : null)
    setConfirmationPreflight(null)
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

  function saveDraftFromEditor() {
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
    const confirmed = globalThis.confirm(
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

  async function updateRelationSuggestion(
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

  return {
    actions: {
      archiveSession,
      cancelDraftConfirmation,
      chooseLocalFolder,
      confirmDraft,
      confirmDraftAfterPreflight,
      createLooseFileDraft,
      deleteSession,
      openSession,
      rescanSessionSource,
      saveDraft: saveDraftFromEditor,
      selectDraft,
      setIncludeArchivedSessions,
      setSessionFilter,
      skipDraft,
      updateDraft: setDraft,
      updateRelationSuggestion,
    },
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
    validationMessage: draft ? draftValidationMessage(draft) : '',
  }
}

export type ImportsWorkspaceController = ReturnType<
  typeof useImportsWorkspaceController
>
