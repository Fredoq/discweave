import type {
  ImportFolderBaseline,
  ImportFolderBaselineDraft,
  ImportFolderBaselineFile,
} from '../catalog/catalogApi'

export type WatchedDiskFile = {
  filePath: string
  sizeBytes: number
  lastModifiedAt: string
}

export type DiskChange =
  | {
      kind: 'renamed' | 'moved'
      path: string
      previousPath: string
      localAudioFileId: string | null
    }
  | {
      kind: 'modified' | 'missing'
      path: string
      localAudioFileId: string | null
    }
  | { kind: 'added'; path: string }

export type DraftDiskChanges = {
  /** Draft id for a draft in review, release id for a catalog release. */
  key: string
  title: string
  inCatalog: boolean
  changes: DiskChange[]
  /** Files that a rescan of this release should read. */
  scanPaths: string[]
  signature: string
}

export type WatchedFolderDiff = {
  /** Files that belong to no known release yet. */
  newFilePaths: string[]
  drafts: DraftDiskChanges[]
}

type DraftState = {
  draft: ImportFolderBaselineDraft
  folder: string | null
  hasSubfolders: boolean
  changes: DiskChange[]
  scanPaths: string[]
}

type MissingFile = { state: DraftState; file: ImportFolderBaselineFile }

export function diffWatchedFolder(
  baseline: ImportFolderBaseline,
  diskFiles: WatchedDiskFile[],
): WatchedFolderDiff {
  const disk = new Map(diskFiles.map((file) => [file.filePath, file]))
  const known = new Set(baseline.otherKnownPaths)
  const states = baseline.drafts.map((draft) => draftState(draft))
  const missing: MissingFile[] = []

  for (const state of states) {
    for (const file of state.draft.files) {
      known.add(file.path)
      const onDisk = disk.get(file.path)
      if (!onDisk) {
        missing.push({ state, file })
        continue
      }

      state.scanPaths.push(file.path)
      if (isModified(file, onDisk)) {
        state.changes.push({
          kind: 'modified',
          path: file.path,
          localAudioFileId: file.localAudioFileId,
        })
      }
    }
  }

  const unknown = diskFiles.filter((file) => !known.has(file.filePath))
  const relocated = pairRelocatedFiles(missing, unknown)
  const newFilePaths: string[] = []
  for (const file of unknown) {
    if (relocated.has(file.filePath)) {
      continue
    }

    const owner = ownerOf(file.filePath, states, baseline.sourceRoot)
    if (owner) {
      owner.changes.push({ kind: 'added', path: file.filePath })
      owner.scanPaths.push(file.filePath)
    } else {
      newFilePaths.push(file.filePath)
    }
  }

  return {
    newFilePaths: [...newFilePaths].sort(comparePaths),
    drafts: states
      .filter((state) => state.changes.length > 0)
      .map((state) => {
        const changes = [...state.changes].sort(
          (left, right) =>
            comparePaths(left.kind, right.kind) ||
            comparePaths(left.path, right.path),
        )
        return {
          key: state.draft.draftId ?? state.draft.releaseId ?? '',
          title: state.draft.title,
          inCatalog: state.draft.status === 'confirmed',
          changes,
          scanPaths: [...state.scanPaths].sort(comparePaths),
          signature: changeSignature(changes),
        }
      }),
  }
}

function draftState(draft: ImportFolderBaselineDraft): DraftState {
  const folder =
    draft.status === 'confirmed'
      ? (commonDirectory(draft.files.map((file) => file.path)) ??
        draft.sourcePath)
      : draft.sourcePath
  return {
    draft,
    folder,
    hasSubfolders:
      folder !== null &&
      draft.files.some((file) => directoryOf(file.path) !== folder),
    changes: [],
    scanPaths: [],
  }
}

function isModified(file: ImportFolderBaselineFile, onDisk: WatchedDiskFile) {
  return (
    (file.sizeBytes !== null && file.sizeBytes !== onDisk.sizeBytes) ||
    (file.lastModifiedAt !== null &&
      Date.parse(file.lastModifiedAt) !== Date.parse(onDisk.lastModifiedAt))
  )
}

// A rename or move keeps size and modification time, so a missing file and an
// unknown file that share both, unambiguously, are the same file.
function pairRelocatedFiles(
  missing: MissingFile[],
  unknown: WatchedDiskFile[],
) {
  const unknownByFingerprint = groupBy(unknown, (file) =>
    fingerprint(file.sizeBytes, file.lastModifiedAt),
  )
  const missingByFingerprint = groupBy(
    missing.filter(
      ({ file }) => file.sizeBytes !== null && file.lastModifiedAt !== null,
    ),
    ({ file }) => fingerprint(file.sizeBytes, file.lastModifiedAt),
  )
  const relocated = new Set<string>()

  for (const { state, file } of missing) {
    const key = fingerprint(file.sizeBytes, file.lastModifiedAt)
    const candidates = unknownByFingerprint.get(key) ?? []
    const target =
      candidates.length === 1 && missingByFingerprint.get(key)?.length === 1
        ? candidates[0]
        : null
    if (!target) {
      state.changes.push({
        kind: 'missing',
        path: file.path,
        localAudioFileId: file.localAudioFileId,
      })
      continue
    }

    relocated.add(target.filePath)
    state.scanPaths.push(target.filePath)
    state.changes.push({
      kind:
        directoryOf(target.filePath) === directoryOf(file.path)
          ? 'renamed'
          : 'moved',
      path: target.filePath,
      previousPath: file.path,
      localAudioFileId: file.localAudioFileId,
    })
  }

  return relocated
}

// A new file belongs to the release whose folder holds it. Files in a new
// subfolder only join releases that already span subfolders (discs); anything
// else, including files directly in the watched root, is a new release.
function ownerOf(filePath: string, states: DraftState[], sourceRoot: string) {
  const directory = directoryOf(filePath)
  let owner: DraftState | null = null
  for (const state of states) {
    const folder = state.folder
    if (
      folder === null ||
      folder === sourceRoot ||
      !(directory === folder || directory.startsWith(`${folder}/`)) ||
      (directory !== folder && !state.hasSubfolders)
    ) {
      continue
    }

    const currentFolder = owner?.folder ?? ''
    if (
      !owner ||
      folder.length > currentFolder.length ||
      (folder.length === currentFolder.length &&
        state.draft.status !== 'confirmed')
    ) {
      owner = state
    }
  }

  return owner
}

function commonDirectory(paths: string[]) {
  if (paths.length === 0) {
    return null
  }

  let common = directoryOf(paths[0])
  for (const path of paths.slice(1)) {
    const directory = directoryOf(path)
    while (
      common &&
      directory !== common &&
      !directory.startsWith(`${common}/`)
    ) {
      common = directoryOf(common)
    }
  }

  return common || null
}

function directoryOf(path: string) {
  const index = path.lastIndexOf('/')
  return index <= 0 ? '' : path.slice(0, index)
}

function fingerprint(sizeBytes: number | null, lastModifiedAt: string | null) {
  return `${sizeBytes}:${lastModifiedAt === null ? '' : Date.parse(lastModifiedAt)}`
}

function groupBy<T>(items: T[], keyOf: (item: T) => string) {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const key = keyOf(item)
    groups.set(key, [...(groups.get(key) ?? []), item])
  }

  return groups
}

function changeSignature(changes: DiskChange[]) {
  return changes
    .map((change) =>
      [
        change.kind,
        change.path,
        'previousPath' in change ? change.previousPath : '',
      ].join('|'),
    )
    .join('\n')
}

function comparePaths(left: string, right: string) {
  if (left === right) {
    return 0
  }

  return left < right ? -1 : 1
}
