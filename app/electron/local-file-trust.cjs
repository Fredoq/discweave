const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const fsSync = require('node:fs')
const path = require('node:path')

const trustStoreVersion = 1

function createLocalFileTrust({
  storePath,
  legacyOperationLogRoot,
  isScanTrustedPath = async () => false,
}) {
  const normalizedStorePath = normalizedAbsolutePath(storePath)
  if (!normalizedStorePath) {
    throw new Error('A valid absolute local file trust store path is required.')
  }
  const normalizedLegacyOperationLogRoot = legacyOperationLogRoot
    ? normalizedAbsolutePath(legacyOperationLogRoot)
    : null
  if (legacyOperationLogRoot && !normalizedLegacyOperationLogRoot) {
    throw new Error(
      'A valid absolute local edit operation log root is required.',
    )
  }

  return {
    isTrustedFile,
    trustEditedFiles,
  }

  async function isTrustedFile(file) {
    const filePath = normalizedAbsolutePath(file?.path)
    if (!filePath) {
      return false
    }

    try {
      if (await isScanTrustedPath(filePath)) {
        return true
      }
    } catch {
      // Fall through to persisted local edit trust.
    }

    const localAudioFileId = normalizedLocalAudioFileId(file?.localAudioFileId)
    if (!localAudioFileId) {
      return false
    }

    const trustedFile = (
      await loadTrustRecords(
        normalizedStorePath,
        normalizedLegacyOperationLogRoot,
      )
    ).get(localAudioFileId)
    if (!trustedFile || trustedFile.path !== filePath) {
      return false
    }

    try {
      const stats = await fs.stat(filePath)
      if (
        !stats.isFile() ||
        stats.size !== trustedFile.sizeBytes ||
        stats.mtime.toISOString() !== trustedFile.lastModifiedAt
      ) {
        return false
      }

      return (await sha256File(filePath)) === trustedFile.contentHash
    } catch {
      return false
    }
  }

  async function trustEditedFiles(files) {
    if (!Array.isArray(files)) {
      throw new Error('Local edit trust descriptors are required.')
    }
    if (files.length === 0) {
      return
    }

    const descriptors = files.map(normalizedTrustDescriptor)
    if (descriptors.some((descriptor) => !descriptor)) {
      throw new Error('Invalid local edit trust descriptor.')
    }

    const records = await loadTrustRecords(
      normalizedStorePath,
      normalizedLegacyOperationLogRoot,
    )
    for (const descriptor of descriptors) {
      records.set(descriptor.localAudioFileId, {
        path: descriptor.path,
        sizeBytes: descriptor.sizeBytes,
        lastModifiedAt: descriptor.lastModifiedAt,
        contentHash: descriptor.contentHash,
      })
    }
    await writeTrustRecords(normalizedStorePath, records)
  }
}

async function loadTrustRecords(storePath, legacyOperationLogRoot) {
  const records = await readTrustRecords(storePath)
  if (
    legacyOperationLogRoot &&
    (await mergeLegacyOperationRecords(records, legacyOperationLogRoot))
  ) {
    await writeTrustRecords(storePath, records).catch(() => undefined)
  }
  return records
}

async function mergeLegacyOperationRecords(records, operationLogRoot) {
  let entries
  try {
    entries = await fs.readdir(operationLogRoot, { withFileTypes: true })
  } catch {
    return false
  }

  const legacyRecords = new Map()
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    if (!entry.isFile() || path.extname(entry.name) !== '.json') {
      continue
    }

    const operationLog = await readJsonFile(
      path.join(operationLogRoot, entry.name),
    )
    for (const operation of Array.isArray(operationLog?.operations)
      ? operationLog.operations
      : []) {
      if (
        operation?.state !== 'fileApplied' ||
        operation.result !== 'applied'
      ) {
        continue
      }

      const descriptor = normalizedTrustDescriptor(operation.updatedFile)
      if (descriptor) {
        legacyRecords.set(descriptor.localAudioFileId, descriptor)
      }
    }
  }

  let changed = false
  for (const [localAudioFileId, descriptor] of legacyRecords) {
    if (records.has(localAudioFileId)) {
      continue
    }
    records.set(localAudioFileId, {
      path: descriptor.path,
      sizeBytes: descriptor.sizeBytes,
      lastModifiedAt: descriptor.lastModifiedAt,
      contentHash: descriptor.contentHash,
    })
    changed = true
  }
  return changed
}

function normalizedTrustDescriptor(file) {
  const localAudioFileId = normalizedLocalAudioFileId(file?.localAudioFileId)
  const filePath = normalizedAbsolutePath(file?.path)
  const sizeBytes = file?.sizeBytes
  const lastModifiedAt = normalizedTimestamp(file?.lastModifiedAt)
  const contentHash = normalizedContentHash(file?.contentHash)
  if (
    !localAudioFileId ||
    !filePath ||
    !Number.isSafeInteger(sizeBytes) ||
    sizeBytes < 0 ||
    !lastModifiedAt ||
    !contentHash
  ) {
    return null
  }

  return {
    localAudioFileId,
    path: filePath,
    sizeBytes,
    lastModifiedAt,
    contentHash,
  }
}

async function readTrustRecords(storePath) {
  try {
    const store = await readJsonFile(storePath)
    if (
      store?.version !== trustStoreVersion ||
      typeof store.files !== 'object' ||
      store.files === null ||
      Array.isArray(store.files)
    ) {
      return new Map()
    }

    const records = new Map()
    for (const [localAudioFileId, file] of Object.entries(store.files)) {
      const descriptor = normalizedTrustDescriptor({
        ...file,
        localAudioFileId,
      })
      if (!descriptor) {
        return new Map()
      }
      records.set(localAudioFileId, {
        path: descriptor.path,
        sizeBytes: descriptor.sizeBytes,
        lastModifiedAt: descriptor.lastModifiedAt,
        contentHash: descriptor.contentHash,
      })
    }
    return records
  } catch {
    return new Map()
  }
}

async function readJsonFile(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'))
  } catch {
    return null
  }
}

async function writeTrustRecords(storePath, records) {
  await fs.mkdir(path.dirname(storePath), { recursive: true })
  const temporaryPath = `${storePath}.${process.pid}.${crypto.randomUUID()}.tmp`
  const store = {
    version: trustStoreVersion,
    files: Object.fromEntries(
      [...records.entries()].sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  }

  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`)
    await fs.rename(temporaryPath, storePath)
  } finally {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined)
  }
}

function normalizedAbsolutePath(filePath) {
  if (
    typeof filePath !== 'string' ||
    !filePath.trim() ||
    filePath.trim().startsWith('//') ||
    /^[a-z][a-z0-9+.-]*:/i.test(filePath.trim())
  ) {
    return null
  }

  const trimmed = filePath.trim()
  return path.isAbsolute(trimmed) ? path.normalize(trimmed) : null
}

function normalizedLocalAudioFileId(localAudioFileId) {
  return typeof localAudioFileId === 'string' && localAudioFileId.trim()
    ? localAudioFileId.trim()
    : ''
}

function normalizedTimestamp(value) {
  if (typeof value !== 'string') {
    return null
  }

  const timestamp = new Date(value)
  return !Number.isNaN(timestamp.valueOf()) && timestamp.toISOString() === value
    ? value
    : null
}

function normalizedContentHash(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
    ? value
    : null
}

async function sha256File(filePath) {
  return await new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fsSync.createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

module.exports = { createLocalFileTrust }
