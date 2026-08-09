import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ArtistRecord } from '../artists/artistsData'
import {
  CatalogApiError,
  confirmImportDraft,
  createDesktopFolderScan,
  getImportSession,
  loadImportSessions,
  preflightImportDraftConfirmation,
  skipImportDraft,
  type CatalogDictionaries,
  type DesktopFolderScanRequest,
  type DesktopImportScanMode,
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
import { useExternalReviewActions } from './useExternalReviewActions'
import { executeExternalOriginalConfirmation } from './externalOriginalConfirmation'
import { useImportDraftSaveAction } from './useImportDraftSaveAction'
import { useImportLooseFileDraftAction } from './useImportLooseFileDraftAction'
import { useImportRelationSuggestionAction } from './useImportRelationSuggestionAction'
import { useImportSessionLifecycleActions } from './useImportSessionLifecycleActions'
import type { OwnedItemRecord } from '../ownedItems/ownedItemsData'

export type ImportsWorkspaceProps = Readonly<{
  artists: ArtistRecord[]
  dictionaries: CatalogDictionaries
  ownedItems?: OwnedItemRecord[]
  locationSearch?: string
  onCatalogChanged: () => void
  onSessionExpired: () => void
}>

export function useImportsWorkspaceController({
  artists,
  dictionaries,
  ownedItems = [],
  locationSearch = window.location.search,
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
  const externalReview = useExternalReviewActions({
    artists,
    dictionaries,
    draft,
    handleRequestError,
    selectedSession,
    setConfirmationPreflight,
    setDraft,
    setError,
    setPendingAction,
    setSelectedDraftId,
    setSelectedSession,
    setStatus,
  })
  const draftSave = useImportDraftSaveAction({
    draft,
    handleRequestError,
    selectedSession,
    setDraft,
    setError,
    setPendingAction,
    setSelectedDraftId,
    setSelectedSession,
    setStatus,
  })
  const looseFileDraft = useImportLooseFileDraftAction({
    selectedSession,
    refreshSessions,
    handleRequestError,
    setConfirmationPreflight,
    setDraft,
    setError,
    setPendingAction,
    setSelectedDraftId,
    setSelectedSession,
    setStatus,
  })
  const relationSuggestion = useImportRelationSuggestionAction({
    selectedSession,
    selectedDraftId,
    handleRequestError,
    setConfirmationPreflight,
    setDraft,
    setError,
    setPendingAction,
    setSelectedDraftId,
    setSelectedSession,
    setStatus,
  })
  const sessionLifecycle = useImportSessionLifecycleActions({
    selectedSession,
    includeArchivedSessions,
    refreshSessions,
    handleRequestError,
    setConfirmationPreflight,
    setDraft,
    setError,
    setPendingAction,
    setSelectedDraftId,
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
    if (session.sourceKind !== 'localFiles') {
      setError('External metadata sessions do not have a folder to rescan.')
      setStatus('Rescan unavailable')
      return
    }

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

  const openSession = useCallback(
    async (sessionId: string, requestedDraftId = '') => {
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

        const firstDraft =
          session.drafts?.find((item) => item.id === requestedDraftId) ??
          session.drafts?.[0] ??
          null
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
    },
    [handleRequestError],
  )

  useEffect(() => {
    const params = new URLSearchParams(locationSearch)
    const sessionId = params.get('session')
    const draftId = params.get('draft') ?? ''
    if (!sessionId || skipServerImportRequests()) {
      return
    }

    queueMicrotask(() => {
      openSession(sessionId, draftId).catch((requestError: unknown) => {
        handleRequestError(requestError, 'Load failed')
      })
    })
  }, [handleRequestError, locationSearch, openSession])

  function selectDraft(draftId: string) {
    const selected =
      selectedSession?.drafts?.find((item) => item.id === draftId) ?? null
    setSelectedDraftId(selected?.id ?? '')
    setDraft(selected ? cloneDraft(selected) : null)
    setConfirmationPreflight(null)
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
      const savedSession = await draftSave.saveDraft()
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

  async function confirmExternalOriginalDraft() {
    if (
      !selectedSession ||
      draft?.sourceKind !== 'externalMetadata' ||
      !draft.selectedOriginalBinding ||
      !draftIsValid(draft)
    ) {
      return
    }

    const draftId = draft.id
    setConfirmationPreflight(null)
    setStatus('Confirming original release')
    setPendingAction('external-original-confirm')
    setError(null)
    try {
      const result = await executeExternalOriginalConfirmation({
        draft,
        saveDraft: async () => {
          const savedSession = await draftSave.saveDraft()
          if (!savedSession) {
            return null
          }
          const savedDraft =
            savedSession.drafts?.find((item) => item.id === draftId) ?? draft
          return {
            sessionId: savedSession.id,
            draft: savedDraft,
          }
        },
        preflight: preflightImportDraftConfirmation,
        confirm: confirmImportDraft,
      })

      if (result.kind === 'notSaved') {
        return
      }
      if (result.kind === 'blocked') {
        setError(
          result.preflight.blockingErrors
            .map((issue) => issue.message)
            .join(' '),
        )
        setStatus('Confirmation blocked')
        return
      }

      const session = result.session
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
      setStatus('Original release confirmed')
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

  return {
    actions: {
      archiveSession: sessionLifecycle.archiveSession,
      cancelDraftConfirmation,
      chooseLocalFolder,
      confirmDraft,
      confirmDraftAfterPreflight,
      confirmExternalOriginalDraft,
      createLooseFileDraft: looseFileDraft.createLooseFileDraft,
      deleteSession: sessionLifecycle.deleteSession,
      openSession,
      applyExternalDiscogsRelease: externalReview.applyDiscogsRelease,
      rescanSessionSource,
      rebindDiscogs: externalReview.rebindDiscogs,
      rebindMusicBrainz: externalReview.rebindMusicBrainz,
      saveDraft: draftSave.saveDraftFromEditor,
      selectExternalReleaseProvenance: externalReview.selectRelease,
      selectExternalTrackProvenance: externalReview.selectTrack,
      selectDraft,
      setIncludeArchivedSessions,
      setSessionFilter,
      skipDraft,
      updateDraft: setDraft,
      updateRelationSuggestion: relationSuggestion.updateRelationSuggestion,
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
    ownedItems,
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
