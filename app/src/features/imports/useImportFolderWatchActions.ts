import { useEffect } from 'react'
import type {
  ReleaseImportDraft,
  ReleaseImportSession,
} from '../catalog/catalogApi'
import {
  addWatchedFolder,
  applyWatchedCatalogChanges,
  checkWatchedFolder,
  dismissWatchedChanges,
  markWatchedDraftSeen,
  onWatchedSessionUpdated,
  recreateWatchedDraft,
  removeWatchedFolder,
  useFolderWatch,
} from './folderWatchStore'
import { cloneDraft, errorMessage } from './importHelpers'

type Props = Readonly<{
  selectedSession: ReleaseImportSession | null
  selectedDraftId: string
  onCatalogChanged: () => void
  refreshSessions: () => Promise<boolean>
  setConfirmationPreflight: (value: null) => void
  setDraft: (value: ReleaseImportDraft | null) => void
  setError: (value: string | null) => void
  setPendingAction: (value: string | null) => void
  setSelectedDraftId: (value: string) => void
  setSelectedSession: (value: ReleaseImportSession | null) => void
  setStatus: (value: string) => void
}>

export function useImportFolderWatchActions({
  selectedSession,
  selectedDraftId,
  onCatalogChanged,
  refreshSessions,
  setConfirmationPreflight,
  setDraft,
  setError,
  setPendingAction,
  setSelectedDraftId,
  setSelectedSession,
  setStatus,
}: Props) {
  const watch = useFolderWatch()
  const selectedSessionId = selectedSession?.id ?? ''

  // Releases the watcher adds in the background join the open session's draft
  // list without replacing the draft the user is editing.
  useEffect(
    () =>
      onWatchedSessionUpdated((session) => {
        if (session.id === selectedSessionId) {
          setSelectedSession(session)
        }
        void refreshSessions()
      }),
    [refreshSessions, selectedSessionId, setSelectedSession],
  )

  useEffect(() => {
    if (selectedSessionId && selectedDraftId) {
      void markWatchedDraftSeen(selectedSessionId, selectedDraftId)
    }
  }, [selectedDraftId, selectedSessionId])

  async function run(
    action: string,
    labels: [progress: string, done: string, failed: string],
    work: () => Promise<void>,
  ) {
    setStatus(labels[0])
    setPendingAction(action)
    setError(null)
    try {
      await work()
      setStatus(labels[1])
    } catch (requestError) {
      setError(errorMessage(requestError))
      setStatus(labels[2])
    } finally {
      setPendingAction(null)
    }
  }

  function showSession(session: ReleaseImportSession, draftId: string) {
    const nextDraft =
      session.drafts?.find((item) => item.id === draftId) ?? null
    setSelectedSession(session)
    setSelectedDraftId(nextDraft?.id ?? '')
    setDraft(nextDraft ? cloneDraft(nextDraft) : null)
    setConfirmationPreflight(null)
  }

  return {
    watch,
    /** The watched folder whose new releases land in the open import. */
    selectedFolder: Object.values(watch).find(
      (folder) => selectedSessionId && folder.sessionId === selectedSessionId,
    ),
    addFolder: (session?: ReleaseImportSession) =>
      run(
        'watch-add',
        [
          'Starting folder watch',
          'Folder watch updated',
          'Folder watch failed',
        ],
        async () => {
          await addWatchedFolder(session)
          await refreshSessions()
        },
      ),
    removeFolder: (sourceRoot: string) =>
      run(
        'watch-remove',
        [
          'Stopping folder watch',
          'Folder watch stopped',
          'Folder watch failed',
        ],
        () => removeWatchedFolder(sourceRoot),
      ),
    checkNow: (sourceRoot: string) =>
      run(
        'watch-check',
        ['Checking folder', 'Folder checked', 'Folder check failed'],
        () => checkWatchedFolder(sourceRoot),
      ),
    recreateDraft: (sourceRoot: string, draftId: string) =>
      run(
        'watch-recreate',
        ['Recreating draft', 'Draft recreated', 'Recreate failed'],
        async () => {
          const result = await recreateWatchedDraft(sourceRoot, draftId)
          showSession(result.session, result.draftId ?? '')
          await refreshSessions()
        },
      ),
    applyCatalogChanges: (sourceRoot: string, releaseId: string) =>
      run(
        'watch-apply',
        [
          'Applying disk changes to catalog',
          'Disk changes applied',
          'Apply failed',
        ],
        async () => {
          const session = await applyWatchedCatalogChanges(
            sourceRoot,
            releaseId,
          )
          if (session?.id === selectedSessionId) {
            setSelectedSession(session)
          }
          if (session) {
            await refreshSessions()
          }
          onCatalogChanged()
        },
      ),
    dismissChanges: (sourceRoot: string, key: string) =>
      run(
        'watch-dismiss',
        ['Dismissing disk changes', 'Disk changes dismissed', 'Dismiss failed'],
        () => dismissWatchedChanges(sourceRoot, key),
      ),
  }
}

export type ImportFolderWatchActions = ReturnType<
  typeof useImportFolderWatchActions
>
