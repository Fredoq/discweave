const fs = require('node:fs/promises')
const fsSync = require('node:fs')
const crypto = require('node:crypto')
const path = require('node:path')

const storeVersion = 2
const changeDebounceMs = 1500

// Watched import folders live in desktop settings, not in the collection
// database. A folder is watched by its path; the import session that receives
// its new releases is replaceable state the app assigns.
function createFolderWatch({
  storePath,
  scanFolder,
  manifestRoot,
  confirmSourceRoot,
  pickSourceRoot,
  trustSourceRoot,
  trustScan,
  notifyChanged,
  resolveRoot = fs.realpath,
  watchDirectory = fsSync.watch,
  debounceMs = changeDebounceMs,
}) {
  let folders = null
  const watchers = new Map()
  const timers = new Map()

  return { add, list, remove, scanFiles, snapshot, start, stop, update }

  async function start() {
    for (const folder of await load()) {
      trustSourceRoot(folder.sourceRoot)
      ensureWatcher(folder)
    }
  }

  function stop() {
    for (const sourceRoot of watchers.keys()) {
      closeWatcher(sourceRoot)
    }
  }

  async function list() {
    return structuredClone(await load())
  }

  // Without a path the user picks the folder; with one, a folder that was not
  // picked in this run is confirmed first.
  async function add(request) {
    const chosenRoot =
      typeof request?.sourceRoot === 'string'
        ? await confirmSourceRoot(request.sourceRoot)
        : await pickSourceRoot()
    if (!chosenRoot) {
      return { cancelled: true }
    }

    const sourceRoot = await resolveRoot(chosenRoot)
    trustSourceRoot(sourceRoot)
    const current = await load()
    const existing = current.find((item) => item.sourceRoot === sourceRoot)
    const folder = existing ?? {
      sourceRoot,
      sessionId: null,
      newDraftIds: [],
      dismissed: {},
      lastCheckedAt: null,
    }
    const next = existing ? current : await save([...current, folder])
    ensureWatcher(folder)
    return { cancelled: false, sourceRoot, folders: structuredClone(next) }
  }

  async function remove(sourceRootValue) {
    const sourceRoot = requiredSourceRoot(sourceRootValue)
    closeWatcher(sourceRoot)
    return await save(
      (await load()).filter((item) => item.sourceRoot !== sourceRoot),
    )
  }

  async function update(sourceRootValue, patch) {
    const sourceRoot = requiredSourceRoot(sourceRootValue)
    const current = await load()
    return await save(
      current.map((item) =>
        item.sourceRoot === sourceRoot
          ? {
              ...item,
              sessionId:
                typeof patch?.sessionId === 'string'
                  ? patch.sessionId
                  : item.sessionId,
              newDraftIds: Array.isArray(patch?.newDraftIds)
                ? patch.newDraftIds.filter((id) => typeof id === 'string')
                : item.newDraftIds,
              dismissed: isStringRecord(patch?.dismissed)
                ? patch.dismissed
                : item.dismissed,
              lastCheckedAt:
                typeof patch?.lastCheckedAt === 'string'
                  ? patch.lastCheckedAt
                  : item.lastCheckedAt,
            }
          : item,
      ),
    )
  }

  // Names-only walk: sizes and timestamps without opening audio files.
  async function snapshot(sourceRootValue) {
    const folder = await watchedFolder(sourceRootValue)
    const scan = await scanFolder(folder.sourceRoot, { mode: 'namesOnly' })
    ensureWatcher(folder)
    return {
      sourceRoot: scan.sourceRoot,
      files: scan.files
        .filter((file) => file.format)
        .map((file) => ({
          filePath: file.filePath,
          sizeBytes: file.sizeBytes,
          lastModifiedAt: file.lastModifiedAt,
        })),
    }
  }

  // Full scan limited to the given audio files and the covers of their releases.
  async function scanFiles(sourceRootValue, filePaths) {
    const folder = await watchedFolder(sourceRootValue)
    const relativeFiles = new Set()
    const relativeDirectories = new Set()
    for (const filePath of Array.isArray(filePaths) ? filePaths : []) {
      const relativePath = relativePathInside(folder.sourceRoot, filePath)
      if (relativePath) {
        relativeFiles.add(relativePath)
        // A multi-disc release keeps its cover one level above the disc folders.
        relativeDirectories.add(path.dirname(relativePath))
        relativeDirectories.add(path.dirname(path.dirname(relativePath)))
      }
    }

    const scan = await scanFolder(folder.sourceRoot, {
      includeFile: (relativePath, kind) =>
        kind === 'audio'
          ? relativeFiles.has(relativePath)
          : relativeDirectories.has(path.dirname(relativePath)),
      manifestRoot: manifestRoot(),
      mode: 'full',
    })
    trustScan(scan)
    return scan
  }

  async function watchedFolder(sourceRootValue) {
    const sourceRoot = requiredSourceRoot(sourceRootValue)
    const folder = (await load()).find((item) => item.sourceRoot === sourceRoot)
    if (!folder) {
      throw new Error('Import folder is not watched.')
    }

    return folder
  }

  function ensureWatcher(folder) {
    const sourceRoot = folder.sourceRoot
    if (watchers.has(sourceRoot)) {
      return
    }

    try {
      const watcher = watchDirectory(
        sourceRoot,
        { recursive: true },
        (_eventType, fileName) => {
          if (!isHiddenPath(fileName)) {
            scheduleChange(sourceRoot)
          }
        },
      )
      watcher.on?.('error', () => closeWatcher(sourceRoot))
      watchers.set(sourceRoot, watcher)
    } catch {
      // An unavailable folder is reported by the next check and retried then.
    }
  }

  function scheduleChange(sourceRoot) {
    clearTimeout(timers.get(sourceRoot))
    timers.set(
      sourceRoot,
      setTimeout(() => {
        timers.delete(sourceRoot)
        notifyChanged(sourceRoot)
      }, debounceMs),
    )
  }

  function closeWatcher(sourceRoot) {
    clearTimeout(timers.get(sourceRoot))
    timers.delete(sourceRoot)
    watchers.get(sourceRoot)?.close()
    watchers.delete(sourceRoot)
  }

  async function load() {
    folders ??= await readStore(storePath)
    return folders
  }

  async function save(next) {
    folders = next
    await fs.mkdir(path.dirname(storePath), { recursive: true })
    const temporaryPath = `${storePath}.${process.pid}.${crypto.randomUUID()}.tmp`
    await fs.writeFile(
      temporaryPath,
      `${JSON.stringify({ version: storeVersion, folders: next }, null, 2)}\n`,
    )
    await fs.rename(temporaryPath, storePath)
    return structuredClone(next)
  }
}

async function readStore(storePath) {
  try {
    const store = JSON.parse(await fs.readFile(storePath, 'utf8'))
    if (store?.version !== storeVersion || !Array.isArray(store.folders)) {
      return []
    }

    return store.folders.filter(isStoredFolder).map((folder) => ({
      sourceRoot: folder.sourceRoot,
      sessionId: typeof folder.sessionId === 'string' ? folder.sessionId : null,
      newDraftIds: Array.isArray(folder.newDraftIds)
        ? folder.newDraftIds.filter((id) => typeof id === 'string')
        : [],
      dismissed: isStringRecord(folder.dismissed) ? folder.dismissed : {},
      lastCheckedAt:
        typeof folder.lastCheckedAt === 'string' ? folder.lastCheckedAt : null,
    }))
  } catch {
    return []
  }
}

function isStoredFolder(folder) {
  return (
    typeof folder?.sourceRoot === 'string' && path.isAbsolute(folder.sourceRoot)
  )
}

function isStringRecord(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === 'string')
  )
}

function requiredSourceRoot(sourceRoot) {
  if (typeof sourceRoot !== 'string' || !path.isAbsolute(sourceRoot)) {
    throw new Error('Watched folder is required.')
  }

  return sourceRoot
}

function relativePathInside(root, filePath) {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) {
    return null
  }

  const relativePath = path.relative(root, path.resolve(filePath))
  return relativePath &&
    !relativePath.startsWith('..') &&
    !path.isAbsolute(relativePath)
    ? relativePath
    : null
}

function isHiddenPath(fileName) {
  return (
    typeof fileName === 'string' &&
    fileName.split(path.sep).some((segment) => segment.startsWith('.'))
  )
}

module.exports = { createFolderWatch }
