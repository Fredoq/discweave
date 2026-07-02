const fs = require('node:fs/promises')
const path = require('node:path')
const { scannerVersion } = require('./scan-manifest.cjs')

function createImportScanAccess({ dialog, manifestRoot, scanFolder }) {
  const trustedFilePaths = new Set()
  const trustedSourceRoots = new Set()

  return {
    isTrustedFilePath,
    pickAndScan,
    rescanSource,
    trustFilePath,
  }

  async function pickAndScan(options) {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Choose import folder',
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { cancelled: true }
    }

    const sourceRoot = normalizeSourceRoot(result.filePaths[0])
    const scan = await scanFolder(sourceRoot, scanOptions(options))
    trustedSourceRoots.add(sourceRoot)
    trustScan(scan)
    return { cancelled: false, scan }
  }

  async function rescanSource(sourceRoot, options) {
    const normalizedSourceRoot = normalizeSourceRoot(sourceRoot)
    if (!trustedSourceRoots.has(normalizedSourceRoot)) {
      await confirmSourceRoot(normalizedSourceRoot)
    }

    const scan = await scanFolder(normalizedSourceRoot, scanOptions(options))
    trustScan(scan)
    return scan
  }

  async function confirmSourceRoot(sourceRoot) {
    const result = await dialog.showOpenDialog({
      buttonLabel: 'Rescan folder',
      defaultPath: sourceRoot,
      properties: ['openDirectory'],
      title: 'Confirm import folder',
    })

    if (result.canceled || result.filePaths.length === 0) {
      throw new Error('Source folder confirmation cancelled.')
    }

    const selectedRoot = normalizeSourceRoot(result.filePaths[0])
    if (selectedRoot !== sourceRoot) {
      throw new Error('Selected folder must match the original import source.')
    }

    trustedSourceRoots.add(sourceRoot)
  }

  function scanOptions(options) {
    return {
      manifestRoot: manifestRoot(),
      mode: options?.mode === 'namesOnly' ? 'namesOnly' : 'full',
    }
  }

  function trustScan(scan) {
    for (const file of Array.isArray(scan?.files) ? scan.files : []) {
      trustFilePath(file?.filePath)
    }
  }

  function trustFilePath(filePath) {
    const normalizedPath = normalizeFilePath(filePath)
    if (normalizedPath) {
      trustedFilePaths.add(normalizedPath)
    }
  }

  async function isTrustedFilePath(filePath) {
    const normalizedPath = normalizeFilePath(filePath)
    return Boolean(
      normalizedPath &&
      (trustedFilePaths.has(normalizedPath) ||
        (await isManifestTrustedFilePath(normalizedPath))),
    )
  }

  async function isManifestTrustedFilePath(filePath) {
    let stats
    let root
    let manifestEntries
    try {
      root = manifestRoot()
      stats = await fs.stat(filePath)
      manifestEntries = await fs.readdir(root, {
        withFileTypes: true,
      })
    } catch {
      return false
    }

    if (!stats.isFile()) {
      return false
    }

    for (const entry of manifestEntries) {
      if (!entry.isFile()) {
        continue
      }

      const manifest = await readScanManifest(path.join(root, entry.name))
      if (isPathCapturedByManifest(filePath, stats, manifest)) {
        trustedFilePaths.add(filePath)
        return true
      }
    }

    return false
  }
}

function normalizeSourceRoot(sourceRoot) {
  if (typeof sourceRoot !== 'string' || sourceRoot.trim().length === 0) {
    throw new Error('Source folder is required.')
  }

  return path.resolve(sourceRoot)
}

function normalizeFilePath(filePath) {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) {
    return null
  }

  return path.resolve(filePath)
}

async function readScanManifest(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'))
  } catch {
    return null
  }
}

function isPathCapturedByManifest(filePath, stats, manifest) {
  if (
    manifest?.scannerVersion !== scannerVersion ||
    manifest.scanMode !== 'full' ||
    typeof manifest.sourceRoot !== 'string' ||
    typeof manifest.files !== 'object' ||
    manifest.files === null ||
    Array.isArray(manifest.files)
  ) {
    return false
  }

  const relativePath = path.relative(
    path.resolve(manifest.sourceRoot),
    filePath,
  )
  if (
    !relativePath ||
    relativePath.startsWith('..') ||
    path.isAbsolute(relativePath)
  ) {
    return false
  }

  return Object.values(manifest.files).some(
    (entry) =>
      isManifestFileEntry(entry) &&
      path.normalize(entry.relativePath) === relativePath &&
      entry.sizeBytes === stats.size &&
      entry.lastModifiedAt === stats.mtime.toISOString(),
  )
}

function isManifestFileEntry(entry) {
  return (
    typeof entry?.relativePath === 'string' &&
    typeof entry.sizeBytes === 'number' &&
    typeof entry.lastModifiedAt === 'string'
  )
}

module.exports = { createImportScanAccess }
