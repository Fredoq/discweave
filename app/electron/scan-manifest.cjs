const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')

const scannerVersion = 1

async function createScanManifestSession(manifestRoot, sourceRoot, scanMode) {
  if (!manifestRoot || scanMode !== 'full') {
    return null
  }

  const filePath = scanManifestPath(manifestRoot, sourceRoot, scanMode)
  const entries = await readManifestEntries(filePath, sourceRoot, scanMode)
  return {
    entries,
    filePath,
    nextEntries: new Map(),
    scanMode,
    sourceRoot,
  }
}

function cachedAudioManifestEntry(session, relativePath, stats) {
  if (!session) {
    return null
  }

  const entry = session.entries.get(relativePath)
  if (!entry || !isReusableEntry(entry, stats)) {
    return null
  }

  return {
    audioMetadata: entry.audioMetadata ?? null,
    contentHash: entry.contentHash ?? null,
    format: entry.format,
  }
}

function recordAudioManifestEntry(session, file) {
  if (!session || !file.contentHash || !file.audioMetadata) {
    return
  }

  session.nextEntries.set(file.relativePath, {
    audioMetadata: file.audioMetadata,
    contentHash: file.contentHash,
    format: file.format,
    lastModifiedAt: file.lastModifiedAt,
    relativePath: file.relativePath,
    sizeBytes: file.sizeBytes,
  })
}

async function saveScanManifestSession(session) {
  if (!session) {
    return
  }

  await fs.mkdir(path.dirname(session.filePath), { recursive: true })
  const manifest = {
    scannerVersion,
    sourceRoot: session.sourceRoot,
    scanMode: session.scanMode,
    files: Object.fromEntries(
      [...session.nextEntries.entries()].sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  }
  const temporaryPath = `${session.filePath}.${process.pid}.${crypto.randomUUID()}.tmp`
  await fs.writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`)
  await fs.rename(temporaryPath, session.filePath)
}

async function readManifestEntries(filePath, sourceRoot, scanMode) {
  try {
    const manifest = JSON.parse(await fs.readFile(filePath, 'utf8'))
    if (!isCompatibleManifest(manifest, sourceRoot, scanMode)) {
      return new Map()
    }

    return new Map(
      Object.entries(manifest.files ?? {}).filter(([, entry]) =>
        isManifestEntry(entry),
      ),
    )
  } catch {
    return new Map()
  }
}

function isCompatibleManifest(manifest, sourceRoot, scanMode) {
  return (
    manifest?.scannerVersion === scannerVersion &&
    manifest.sourceRoot === sourceRoot &&
    manifest.scanMode === scanMode &&
    typeof manifest.files === 'object' &&
    manifest.files !== null &&
    !Array.isArray(manifest.files)
  )
}

function isManifestEntry(entry) {
  return (
    typeof entry?.relativePath === 'string' &&
    typeof entry.format === 'string' &&
    typeof entry.sizeBytes === 'number' &&
    typeof entry.lastModifiedAt === 'string' &&
    typeof entry.contentHash === 'string' &&
    typeof entry.audioMetadata === 'object' &&
    entry.audioMetadata !== null
  )
}

function isReusableEntry(entry, stats) {
  return (
    entry.sizeBytes === stats.size &&
    entry.lastModifiedAt === stats.mtime.toISOString()
  )
}

function scanManifestPath(manifestRoot, sourceRoot, scanMode) {
  const digest = crypto
    .createHash('sha256')
    .update(`${scanMode}\n${sourceRoot}`)
    .digest('hex')
  return path.join(manifestRoot, `${digest}.json`)
}

module.exports = {
  cachedAudioManifestEntry,
  createScanManifestSession,
  recordAudioManifestEntry,
  saveScanManifestSession,
  scannerVersion,
}
