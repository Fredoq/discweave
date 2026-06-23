const path = require('node:path')

function createImportScanAccess({ dialog, manifestRoot, scanFolder }) {
  const trustedSourceRoots = new Set()

  return {
    pickAndScan,
    rescanSource,
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
    return { cancelled: false, scan }
  }

  async function rescanSource(sourceRoot, options) {
    const normalizedSourceRoot = normalizeSourceRoot(sourceRoot)
    if (!trustedSourceRoots.has(normalizedSourceRoot)) {
      await confirmSourceRoot(normalizedSourceRoot)
    }

    return await scanFolder(normalizedSourceRoot, scanOptions(options))
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
}

function normalizeSourceRoot(sourceRoot) {
  if (typeof sourceRoot !== 'string' || sourceRoot.trim().length === 0) {
    throw new Error('Source folder is required.')
  }

  return path.resolve(sourceRoot)
}

module.exports = { createImportScanAccess }
