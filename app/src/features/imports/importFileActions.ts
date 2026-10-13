import type {
  ImportFileOpenResult,
  ImportReleaseTrashPlan,
  ImportReleaseTrashRequest,
  ImportReleaseTrashResult,
} from '../../desktop'
import type {
  ReleaseImportDraft,
  ReleaseImportDraftTrack,
} from '../catalog/catalogApi'

export type {
  ImportFileOpenResult,
  ImportReleaseTrashPlan,
  ImportReleaseTrashResult,
}

function importsBridge() {
  return globalThis.window?.discweaveDesktop?.imports
}

export function isImportFileOpenAvailable() {
  return Boolean(importsBridge()?.openFile)
}

export function isImportReleaseTrashAvailable() {
  const bridge = importsBridge()
  return Boolean(bridge?.planReleaseTrash && bridge.trashRelease)
}

export function importTrackFilePath(track: ReleaseImportDraftTrack) {
  return track.sourceKind === 'localFiles' ? track.filePath.trim() : ''
}

export function canTrashImportDraft(draft: ReleaseImportDraft) {
  return (
    draft.sourceKind === 'localFiles' &&
    draft.status !== 'confirmed' &&
    importReleaseTrashRequest(draft).filePaths.length > 0
  )
}

export function importReleaseTrashRequest(
  draft: ReleaseImportDraft,
): ImportReleaseTrashRequest {
  return {
    sourcePath: draft.sourceKind === 'localFiles' ? draft.sourcePath : null,
    filePaths: [
      ...new Set(draft.tracks.map(importTrackFilePath).filter(Boolean)),
    ],
  }
}

export async function openImportFile(
  filePath: string,
): Promise<ImportFileOpenResult> {
  const openFile = importsBridge()?.openFile
  if (!openFile) {
    return {
      ok: false,
      path: filePath,
      reason: 'system-error',
      message: 'Playback is available only in the desktop app.',
    }
  }

  try {
    return await openFile({ path: filePath })
  } catch (error) {
    return {
      ok: false,
      path: filePath,
      reason: 'system-error',
      message:
        error instanceof Error
          ? error.message
          : 'The system could not open this file.',
    }
  }
}

export async function planImportReleaseTrash(
  draft: ReleaseImportDraft,
): Promise<ImportReleaseTrashPlan> {
  const plan = importsBridge()?.planReleaseTrash
  if (!plan) {
    throw new Error(
      'Moving files to Trash is available only in the desktop app.',
    )
  }

  return await plan(importReleaseTrashRequest(draft))
}

export async function trashImportRelease(
  draft: ReleaseImportDraft,
): Promise<ImportReleaseTrashResult> {
  const trash = importsBridge()?.trashRelease
  if (!trash) {
    throw new Error(
      'Moving files to Trash is available only in the desktop app.',
    )
  }

  return await trash(importReleaseTrashRequest(draft))
}
