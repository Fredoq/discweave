import { useSyncExternalStore } from 'react'
import type { WatchedImportFolder } from '../../desktop'
import {
  appendDesktopFolderScan,
  createDesktopFolderScan,
  getImportFolderBaseline,
  loadImportSessions,
  updateLocalAudioFile,
  type ReleaseImportSession,
} from '../catalog/catalogApi'
import { diffWatchedFolder, type DraftDiskChanges } from './folderWatchDiff'

export type WatchedFolderState = {
  sourceRoot: string
  /** Import session that receives this folder's new releases. */
  sessionId: string | null
  status: 'idle' | 'checking' | 'error'
  error: string | null
  lastCheckedAt: string | null
  /** Drafts the watcher added that the user has not opened yet. */
  newDraftIds: string[]
  /** Drafts and catalog releases whose files differ on disk and were not dismissed. */
  changes: DraftDiskChanges[]
}

/** Watched folders by source root. */
export type FolderWatchState = Readonly<Record<string, WatchedFolderState>>

type SessionListener = (session: ReleaseImportSession) => void

let state: FolderWatchState = {}
let folders: WatchedImportFolder[] = []
let started = false
const stateListeners = new Set<() => void>()
const sessionListeners = new Set<SessionListener>()
const runningChecks = new Map<string, Promise<void>>()
const queuedChecks = new Set<string>()

export function useFolderWatch() {
  return useSyncExternalStore(subscribe, () => state)
}

export function folderWatchAttentionCount(current: FolderWatchState) {
  return Object.values(current).reduce(
    (total, folder) =>
      total + folder.newDraftIds.length + folder.changes.length,
    0,
  )
}

/** Loads watched folders once per app run and checks each of them. */
export function startFolderWatch() {
  const desktop = desktopWatch()
  if (started || !desktop) {
    return
  }

  started = true
  desktop.onChanged((sourceRoot) => {
    void checkWatchedFolder(sourceRoot)
  })
  void desktop
    .list()
    .then((listed) => {
      applyFolders(listed)
      for (const folder of listed) {
        void checkWatchedFolder(folder.sourceRoot)
      }
    })
    .catch(() => {
      started = false
    })
}

export function onWatchedSessionUpdated(listener: SessionListener) {
  sessionListeners.add(listener)
  return () => {
    sessionListeners.delete(listener)
  }
}

/**
 * Starts watching a folder. Without a session the user picks the folder;
 * with one, that import's folder is watched and the import receives its new
 * releases.
 */
export async function addWatchedFolder(
  session?: Pick<ReleaseImportSession, 'id' | 'sourceRoot'>,
) {
  const desktop = requiredDesktopWatch()
  const added = await desktop.add(
    session?.sourceRoot ? { sourceRoot: session.sourceRoot } : undefined,
  )
  if (added.cancelled) {
    return
  }

  applyFolders(added.folders)
  const folder = requiredFolder(added.sourceRoot)
  if (session && folder.sessionId !== session.id) {
    applyFolders(
      await desktop.update(folder.sourceRoot, { sessionId: session.id }),
    )
  }
  await checkWatchedFolder(folder.sourceRoot)
}

export async function removeWatchedFolder(sourceRoot: string) {
  applyFolders(await requiredDesktopWatch().remove(sourceRoot))
}

/** Runs one check at a time per folder; a request during a run queues one more. */
export function checkWatchedFolder(sourceRoot: string): Promise<void> {
  const running = runningChecks.get(sourceRoot)
  if (running) {
    queuedChecks.add(sourceRoot)
    return running
  }

  const check = runCheck(sourceRoot).finally(() => {
    runningChecks.delete(sourceRoot)
    if (queuedChecks.delete(sourceRoot)) {
      void checkWatchedFolder(sourceRoot)
    }
  })
  runningChecks.set(sourceRoot, check)
  return check
}

export async function recreateWatchedDraft(
  sourceRoot: string,
  draftId: string,
) {
  const desktop = requiredDesktopWatch()
  const changes = requiredChanges(sourceRoot, draftId)
  const scan = await desktop.scanFiles(sourceRoot, changes.scanPaths)
  const session = await appendDesktopFolderScan(
    requiredSessionId(sourceRoot),
    scan,
    [draftId],
  )
  await checkWatchedFolder(sourceRoot)
  return {
    session,
    draftId: pendingDraftIdsWithFiles(session, changes.scanPaths)[0] ?? null,
  }
}

/**
 * Points catalog files at their renamed, moved or modified versions on disk.
 * New files come back as a draft of the same release for review; missing
 * files stay flagged and nothing is deleted.
 */
export async function applyWatchedCatalogChanges(
  sourceRoot: string,
  releaseId: string,
) {
  const desktop = requiredDesktopWatch()
  const changes = requiredChanges(sourceRoot, releaseId)
  const fileChanges = changes.changes.flatMap((change) =>
    change.kind === 'added' || change.kind === 'missing' ? [] : [change],
  )
  if (fileChanges.length > 0) {
    const scan = await desktop.scanFiles(
      sourceRoot,
      fileChanges.map((change) => change.path),
    )
    const scannedByPath = new Map(
      scan.files.map((file) => [file.filePath, file]),
    )
    for (const change of fileChanges) {
      const file = scannedByPath.get(change.path)
      if (file && change.localAudioFileId) {
        await updateLocalAudioFile(change.localAudioFileId, {
          path: file.filePath,
          sizeBytes: file.sizeBytes,
          lastModifiedAt: file.lastModifiedAt,
          contentHash: 'contentHash' in file ? file.contentHash : null,
        })
      }
    }
  }

  let session: ReleaseImportSession | null = null
  if (changes.changes.some((change) => change.kind === 'added')) {
    const scan = await desktop.scanFiles(sourceRoot, changes.scanPaths)
    session = await appendDesktopFolderScan(requiredSessionId(sourceRoot), scan)
    const folder = requiredFolder(sourceRoot)
    applyFolders(
      await desktop.update(sourceRoot, {
        newDraftIds: [
          ...new Set([
            ...folder.newDraftIds,
            ...pendingDraftIdsWithFiles(session, changes.scanPaths),
          ]),
        ],
      }),
    )
  }

  await checkWatchedFolder(sourceRoot)
  return session
}

export async function dismissWatchedChanges(sourceRoot: string, key: string) {
  const changes = requiredChanges(sourceRoot, key)
  const folder = requiredFolder(sourceRoot)
  applyFolders(
    await requiredDesktopWatch().update(sourceRoot, {
      dismissed: { ...folder.dismissed, [key]: changes.signature },
    }),
  )
  patchFolder(sourceRoot, {
    changes: (state[sourceRoot]?.changes ?? []).filter(
      (item) => item.key !== key,
    ),
  })
}

export async function markWatchedDraftSeen(sessionId: string, draftId: string) {
  const folder = folders.find((item) => item.sessionId === sessionId)
  const desktop = desktopWatch()
  if (!desktop || !folder?.newDraftIds.includes(draftId)) {
    return
  }

  applyFolders(
    await desktop.update(folder.sourceRoot, {
      newDraftIds: folder.newDraftIds.filter((id) => id !== draftId),
    }),
  )
}

async function runCheck(sourceRoot: string) {
  const desktop = desktopWatch()
  if (!desktop || !folders.some((item) => item.sourceRoot === sourceRoot)) {
    return
  }

  patchFolder(sourceRoot, { status: 'checking', error: null })
  try {
    const { sessionId, baseline } = await loadBaseline(sourceRoot)
    const folder = requiredFolder(sourceRoot)
    const snapshot = await desktop.snapshot(sourceRoot)
    const diff = diffWatchedFolder(baseline, snapshot.files)
    const pendingDraftIds = new Set(
      baseline.drafts.flatMap((draft) =>
        draft.draftId ? [draft.draftId] : [],
      ),
    )
    let newDraftIds = folder.newDraftIds
    if (diff.newFilePaths.length > 0) {
      const scan = await desktop.scanFiles(sourceRoot, diff.newFilePaths)
      const session = await appendDesktopFolderScan(sessionId, scan)
      const added = pendingDraftIdsWithFiles(session, diff.newFilePaths)
      newDraftIds = [...new Set([...newDraftIds, ...added])]
      for (const draftId of added) {
        pendingDraftIds.add(draftId)
      }
      notifySessionUpdated(session)
    }

    const dismissed = Object.fromEntries(
      diff.drafts
        .filter((draft) => folder.dismissed[draft.key] === draft.signature)
        .map((draft) => [draft.key, draft.signature]),
    )
    applyFolders(
      await desktop.update(sourceRoot, {
        newDraftIds: newDraftIds.filter((id) => pendingDraftIds.has(id)),
        dismissed,
        lastCheckedAt: new Date().toISOString(),
      }),
    )
    patchFolder(sourceRoot, {
      status: 'idle',
      changes: diff.drafts.filter(
        (draft) => dismissed[draft.key] !== draft.signature,
      ),
    })
  } catch (error) {
    patchFolder(sourceRoot, {
      status: 'error',
      error: error instanceof Error ? error.message : 'Folder check failed.',
    })
  }
}

// A watched folder outlives its import: when the import is archived, deleted
// or was never assigned, the newest open import of the folder takes over, or
// an empty one is created to receive new releases.
async function loadBaseline(sourceRoot: string) {
  const assigned = requiredFolder(sourceRoot).sessionId
  const assignedBaseline = assigned
    ? await getImportFolderBaseline(assigned)
    : null
  if (assigned && assignedBaseline) {
    return { sessionId: assigned, baseline: assignedBaseline }
  }

  const open = (await loadImportSessions()).items.find(
    (session) => session.sourceRoot === sourceRoot && !session.archivedAt,
  )
  const session =
    open ??
    (await createDesktopFolderScan({
      sourceRoot,
      scanMode: 'full',
      files: [],
      ignoredFileCount: 0,
      diagnostics: [],
    }))
  applyFolders(
    await requiredDesktopWatch().update(sourceRoot, {
      sessionId: session.id,
      newDraftIds: [],
    }),
  )
  notifySessionUpdated(session)
  const baseline = await getImportFolderBaseline(session.id)
  if (!baseline) {
    throw new Error('Import for the watched folder is unavailable.')
  }

  return { sessionId: session.id, baseline }
}

function pendingDraftIdsWithFiles(
  session: ReleaseImportSession,
  filePaths: string[],
) {
  const paths = new Set(filePaths)
  return (session.drafts ?? [])
    .filter(
      (draft) =>
        (draft.status === 'ready' || draft.status === 'needsReview') &&
        draft.tracks.some(
          (track) => track.filePath && paths.has(track.filePath),
        ),
    )
    .map((draft) => draft.id)
}

function applyFolders(next: WatchedImportFolder[]) {
  folders = next
  state = Object.fromEntries(
    next.map((folder) => [
      folder.sourceRoot,
      {
        status: state[folder.sourceRoot]?.status ?? ('idle' as const),
        error: state[folder.sourceRoot]?.error ?? null,
        changes: state[folder.sourceRoot]?.changes ?? [],
        sourceRoot: folder.sourceRoot,
        sessionId: folder.sessionId,
        lastCheckedAt: folder.lastCheckedAt,
        newDraftIds: folder.newDraftIds,
      },
    ]),
  )
  emit()
}

function patchFolder(sourceRoot: string, patch: Partial<WatchedFolderState>) {
  const current = state[sourceRoot]
  if (!current) {
    return
  }

  state = { ...state, [sourceRoot]: { ...current, ...patch } }
  emit()
}

function notifySessionUpdated(session: ReleaseImportSession) {
  for (const listener of sessionListeners) {
    listener(session)
  }
}

function requiredChanges(sourceRoot: string, key: string) {
  const changes = state[sourceRoot]?.changes.find((item) => item.key === key)
  if (!changes) {
    throw new Error('Check the folder again before changing this release.')
  }

  return changes
}

function requiredFolder(sourceRoot: string) {
  const folder = folders.find((item) => item.sourceRoot === sourceRoot)
  if (!folder) {
    throw new Error('Import folder is not watched.')
  }

  return folder
}

function requiredSessionId(sourceRoot: string) {
  const sessionId = requiredFolder(sourceRoot).sessionId
  if (!sessionId) {
    throw new Error('Check the folder again before changing this release.')
  }

  return sessionId
}

function requiredDesktopWatch() {
  const desktop = desktopWatch()
  if (!desktop) {
    throw new Error('Update the macOS desktop app to watch import folders.')
  }

  return desktop
}

function desktopWatch() {
  // Older desktop builds and test bridges may not expose the imports API.
  const bridge: Partial<NonNullable<Window['discweaveDesktop']>> | undefined =
    globalThis.discweaveDesktop
  return bridge?.imports?.watch ?? null
}

function subscribe(listener: () => void) {
  stateListeners.add(listener)
  return () => {
    stateListeners.delete(listener)
  }
}

function emit() {
  for (const listener of stateListeners) {
    listener()
  }
}

/** Test seam: forgets all module state between test cases. */
export function resetFolderWatchForTests() {
  state = {}
  folders = []
  started = false
  runningChecks.clear()
  queuedChecks.clear()
  sessionListeners.clear()
}
