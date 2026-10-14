const os = require('node:os')
const path = require('node:path')

const audioExtensions = new Set(['.flac', '.mp3', '.wav', '.ogg', '.m4a'])
const otherFileSampleLimit = 5

// Import drafts are not in the catalog yet, so their files are trusted only
// when a scan of this desktop shell captured them.
function createImportFileActions({
  fs,
  shell,
  isTrustedFilePath,
  protectedFolders = async () => [],
  homeDirectory = os.homedir(),
}) {
  return { openFile, planReleaseTrash, trashRelease }

  async function openFile(request) {
    const filePath = normalizedAbsolutePath(request?.path)
    if (!filePath) {
      return failure('invalid-path', 'A valid absolute file path is required.')
    }
    if (!(await isTrustedFilePath(filePath))) {
      return failure(
        'invalid-path',
        'This file was not captured by an import scan.',
        filePath,
      )
    }

    const stat = await safeStat(filePath)
    if (!stat) {
      return failure('missing', 'The file does not exist.', filePath)
    }
    if (!stat.isFile()) {
      return failure('not-file', 'The path is not a file.', filePath)
    }

    try {
      const errorMessage = await shell.openPath(filePath)
      return errorMessage
        ? failure('system-error', errorMessage, filePath)
        : { ok: true, path: filePath }
    } catch (error) {
      return failure(
        'system-error',
        errorMessage(error, 'The system could not open this file.'),
        filePath,
      )
    }
  }

  async function planReleaseTrash(request) {
    const filePaths = uniquePaths(request?.filePaths)
    if (filePaths.length === 0) {
      throw new Error('At least one release file is required.')
    }

    const files = await Promise.all(
      filePaths.map(async (filePath) => ({
        filePath,
        isTrusted: await isTrustedFilePath(filePath),
        stat: await safeStat(filePath),
      })),
    )
    if (files.some((file) => !file.isTrusted)) {
      throw new Error('Release files must be captured by an import scan.')
    }
    const existingFiles = files
      .filter((file) => file.stat?.isFile())
      .map((file) => file.filePath)
    const missingFiles = files
      .filter((file) => !file.stat?.isFile())
      .map((file) => file.filePath)

    const folderPath = await releaseFolder(request?.sourcePath, filePaths)
    const listing = folderPath ? await listFolderFiles(folderPath) : null
    const foreignAudioFiles = listing
      ? listing.audioFiles.filter((filePath) => !filePaths.includes(filePath))
      : []
    const canTrashFolder = Boolean(listing) && foreignAudioFiles.length === 0
    const otherFiles = canTrashFolder ? listing.otherFiles : []

    return {
      mode: canTrashFolder ? 'folder' : 'files',
      folderPath: folderPath ?? commonParent(filePaths),
      audioFiles: existingFiles,
      missingFiles,
      otherFileCount: otherFiles.length,
      otherFileSamples: otherFiles
        .slice(0, otherFileSampleLimit)
        .map((filePath) => path.relative(folderPath, filePath)),
      foreignAudioFileCount: foreignAudioFiles.length,
    }
  }

  async function trashRelease(request) {
    const plan = await planReleaseTrash(request)
    const targets =
      plan.mode === 'folder' ? [plan.folderPath] : [...plan.audioFiles]
    const trashedPaths = []

    for (const target of targets) {
      try {
        await shell.trashItem(target)
        trashedPaths.push(target)
      } catch (error) {
        return {
          ok: false,
          mode: plan.mode,
          trashedPaths,
          failedPath: target,
          message: errorMessage(error, 'The system could not move this item.'),
        }
      }
    }

    return { ok: true, mode: plan.mode, trashedPaths, failedPath: null }
  }

  // The scan's release root is preferred; it falls back to the files' common
  // parent when the root is protected, as for loose-file drafts.
  async function releaseFolder(sourcePath, filePaths) {
    const protectedPaths = (await protectedFolders())
      .map(normalizedAbsolutePath)
      .filter(Boolean)
    const candidates = [
      normalizedAbsolutePath(sourcePath),
      commonParent(filePaths),
    ]

    for (const candidate of candidates) {
      if (
        candidate &&
        filePaths.every((filePath) => isInside(candidate, filePath)) &&
        !isUnsafeFolder(candidate, protectedPaths) &&
        (await safeStat(candidate))?.isDirectory()
      ) {
        return candidate
      }
    }

    return null
  }

  function isUnsafeFolder(folderPath, protectedPaths) {
    return (
      folderPath === path.parse(folderPath).root ||
      isInside(folderPath, homeDirectory) ||
      folderPath === path.resolve(homeDirectory) ||
      protectedPaths.some(
        (protectedPath) =>
          protectedPath === folderPath || isInside(folderPath, protectedPath),
      )
    )
  }

  async function listFolderFiles(folderPath) {
    const audioFiles = []
    const otherFiles = []
    const pending = [folderPath]

    while (pending.length > 0) {
      const directory = pending.pop()
      let entries
      try {
        entries = await fs.readdir(directory, { withFileTypes: true })
      } catch {
        return null
      }

      for (const entry of entries) {
        const entryPath = path.join(directory, entry.name)
        if (entry.isDirectory()) {
          pending.push(entryPath)
        } else if (
          audioExtensions.has(path.extname(entry.name).toLowerCase())
        ) {
          audioFiles.push(entryPath)
        } else {
          otherFiles.push(entryPath)
        }
      }
    }

    otherFiles.sort((left, right) => left.localeCompare(right))
    return { audioFiles, otherFiles }
  }

  async function safeStat(filePath) {
    try {
      return await fs.stat(filePath)
    } catch {
      return null
    }
  }
}

function uniquePaths(filePaths) {
  if (!Array.isArray(filePaths)) {
    return []
  }

  const paths = filePaths.map(normalizedAbsolutePath)
  if (paths.some((filePath) => !filePath)) {
    throw new Error('Release file paths must be absolute.')
  }

  return [...new Set(paths)]
}

function commonParent(filePaths) {
  if (filePaths.length === 0) {
    return null
  }

  let parent = path.dirname(filePaths[0])
  while (!filePaths.every((filePath) => isInside(parent, filePath))) {
    const next = path.dirname(parent)
    if (next === parent) {
      return null
    }
    parent = next
  }

  return parent
}

function isInside(folderPath, filePath) {
  const relativePath = path.relative(folderPath, filePath)
  return (
    Boolean(relativePath) &&
    !relativePath.startsWith('..') &&
    !path.isAbsolute(relativePath)
  )
}

function normalizedAbsolutePath(filePath) {
  if (typeof filePath !== 'string') {
    return null
  }

  const trimmed = filePath.trim()
  if (
    !trimmed ||
    trimmed.startsWith('//') ||
    /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ||
    !path.isAbsolute(trimmed)
  ) {
    return null
  }

  return path.resolve(trimmed)
}

function failure(reason, message, filePath) {
  return filePath
    ? { ok: false, path: filePath, reason, message }
    : { ok: false, reason, message }
}

function errorMessage(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback
}

module.exports = { createImportFileActions }
