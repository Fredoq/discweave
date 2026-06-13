const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const fsSync = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const writableTagFormats = new Set(['flac', 'mp3', 'm4a', 'ogg'])
const scalarTagFields = new Set([
  'title',
  'album',
  'date',
  'label',
  'catalogNumber',
  'comment',
])
const numericTagFields = new Set(['trackNumber', 'year'])
const listTagFields = new Set([
  'artists',
  'albumArtists',
  'genre',
  'composer',
  'producer',
  'remixer',
])
const knownTagFields = new Set([
  ...scalarTagFields,
  ...numericTagFields,
  ...listTagFields,
])
const tagLibFieldAliases = new Map([['remixer', 'remixedBy']])
const reservedNativeTagFields = new Set([
  ...[...knownTagFields].map((field) => field.toUpperCase()),
  'ALBUMARTIST',
  'ALBUMARTISTS',
  'CATALOGNUMBER',
  'CATALOGNO',
  'DATE',
  'ORIGINALDATE',
  'RELEASEDATE',
  'REMIXER',
  'TRACKNUMBER',
])

async function inspectLocalFile(request, options = {}) {
  const filePath = requireAbsolutePath(request?.path, 'path')
  const stats = await fs.stat(filePath)
  const metadata = await readMetadata(filePath, options.metadataReader)

  return {
    path: filePath,
    format: fileFormat(filePath),
    sizeBytes: stats.size,
    lastModifiedAt: stats.mtime.toISOString(),
    tags: tagsFromMetadata(metadata),
    technical: technicalFromMetadata(metadata),
  }
}

async function previewLocalEdits(request) {
  const files = Array.isArray(request?.files) ? request.files : []
  const targetCounts = new Map()
  for (const file of files) {
    if (
      typeof file?.targetPath === 'string' &&
      path.isAbsolute(file.targetPath)
    ) {
      const targetPath = path.normalize(file.targetPath)
      targetCounts.set(targetPath, (targetCounts.get(targetPath) ?? 0) + 1)
    }
  }

  const changes = []
  for (const file of files) {
    changes.push(await previewFileChange(file, targetCounts))
  }

  return {
    ok: changes.every((change) =>
      change.issues.every((issue) => issue.severity !== 'error'),
    ),
    changes,
  }
}

async function applyLocalEdits(request, options = {}) {
  const preview = await previewLocalEdits(request)
  if (!preview.ok) {
    return {
      applied: false,
      operationLogPath: null,
      changes: preview.changes,
      files: [],
    }
  }

  const tagAdapter = options.tagAdapter ?? defaultTagAdapter
  const logRoot =
    options.logRoot ??
    path.join(os.homedir(), '.discweave', 'local-edit-operation-logs')
  const operations = []
  const updatedFiles = []
  await fs.mkdir(logRoot, { recursive: true })
  const directoryMove = await planReleaseDirectoryMove(preview.changes)

  for (const change of preview.changes) {
    const sourcePath = sourcePathForChange(change, directoryMove)
    const operation = {
      ownedItemId: change.ownedItemId,
      previousPath: change.currentPath,
      nextPath: change.targetPath,
      sourcePath,
      previousTags: null,
      requestedTags: change.tagChanges,
      state: 'planned',
      result: 'pending',
    }
    operations.push(operation)

    try {
      if (hasTagChanges(change.tagChanges) && change.tagWritable) {
        operation.previousTags = await readPreviousTags(tagAdapter, sourcePath)
        await tagAdapter.writeTags(sourcePath, change.tagChanges)
      }

      if (change.rename && sourcePath !== change.targetPath) {
        await fs.mkdir(path.dirname(change.targetPath), { recursive: true })
        await fs.rename(sourcePath, change.targetPath)
      }

      const stats = await fs.stat(change.targetPath)
      const updatedFile = {
        ownedItemId: change.ownedItemId,
        path: change.targetPath,
        format: change.format,
        sizeBytes: stats.size,
        lastModifiedAt: stats.mtime.toISOString(),
        contentHash: await sha256File(change.targetPath),
      }
      updatedFiles.push(updatedFile)
      operation.state = 'fileApplied'
      operation.result = 'applied'
      operation.updatedFile = updatedFile
    } catch (error) {
      operation.state = 'failed'
      operation.result = 'failed'
      operation.error =
        error instanceof Error ? error.message : 'Local edit failed'
      break
    }
  }

  const operationLogPath = path.join(
    logRoot,
    `${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID()}.json`,
  )
  await fs.writeFile(
    operationLogPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        operations,
      },
      null,
      2,
    ),
  )

  return {
    applied: operations.every((operation) => operation.result === 'applied'),
    operationLogPath,
    changes: changesWithOperationFailures(preview.changes, operations),
    failedFile: failedFileFromOperations(operations),
    files: updatedFiles,
  }
}

function failedFileFromOperations(operations) {
  const failedOperation = operations.find(
    (operation) => operation.result === 'failed',
  )
  if (!failedOperation) {
    return null
  }

  return {
    ownedItemId: failedOperation.ownedItemId,
    currentPath: failedOperation.previousPath,
    targetPath: failedOperation.nextPath,
    error: failedOperation.error ?? 'Local edit failed',
  }
}

async function previewFileChange(file, targetCounts) {
  const ownedItemId =
    typeof file?.ownedItemId === 'string' ? file.ownedItemId : ''
  const currentPath = normalizeMaybeAbsolute(file?.currentPath)
  const targetPath = normalizeMaybeAbsolute(file?.targetPath)
  const issues = []
  const currentExists = currentPath ? await exists(currentPath) : false
  const targetExists = targetPath ? await exists(targetPath) : false
  const alreadyAtTarget = Boolean(
    currentPath &&
    targetPath &&
    currentPath !== targetPath &&
    !currentExists &&
    targetExists,
  )

  if (!currentPath) {
    issues.push(errorIssue('current_path_absolute_required'))
  } else if (!currentExists && !alreadyAtTarget) {
    issues.push(errorIssue('current_missing'))
  }

  if (!targetPath) {
    issues.push(errorIssue('target_path_absolute_required'))
  } else {
    if (hasUnsafePathBytes(targetPath)) {
      issues.push(errorIssue('target_path_unsafe'))
    }
    if (
      currentPath &&
      targetPath !== currentPath &&
      targetExists &&
      !alreadyAtTarget
    ) {
      issues.push(errorIssue('target_exists'))
    }
    if ((targetCounts.get(targetPath) ?? 0) > 1) {
      issues.push(errorIssue('target_conflict'))
    }
  }

  const resolvedPath = targetPath ?? currentPath ?? ''
  const format = fileFormat(resolvedPath)
  const rename = Boolean(
    currentPath && targetPath && currentPath !== targetPath,
  )
  const tagChanges = tagObject(file?.tags)
  const tagWritable = writableTagFormats.has(format)
  if (hasTagChanges(tagChanges) && !tagWritable) {
    issues.push({
      code: 'tags_unsupported',
      message: 'Tags are read-only for this file format',
      severity: rename ? 'warning' : 'error',
    })
  }

  return {
    ownedItemId,
    currentPath: currentPath ?? String(file?.currentPath ?? ''),
    targetPath: targetPath ?? String(file?.targetPath ?? ''),
    format,
    rename,
    alreadyAtTarget,
    tagWritable,
    tagChanges,
    issues,
  }
}

async function planReleaseDirectoryMove(changes) {
  const renameChanges = changes.filter(
    (change) =>
      change.currentPath &&
      change.targetPath &&
      change.currentPath !== change.targetPath,
  )
  if (renameChanges.length < 2) {
    return null
  }

  const currentRoot = commonDirectory(
    renameChanges.map((change) => path.dirname(change.currentPath)),
  )
  const targetRoot = commonDirectory(
    renameChanges.map((change) => path.dirname(change.targetPath)),
  )
  if (!currentRoot || !targetRoot || currentRoot === targetRoot) {
    return null
  }
  if (
    !renameChanges.every(
      (change) =>
        isPathInside(currentRoot, change.currentPath) &&
        isPathInside(targetRoot, change.targetPath),
    )
  ) {
    return null
  }

  const currentExists = await Promise.all(
    renameChanges.map((change) => exists(change.currentPath)),
  )
  const targetExists = await Promise.all(
    renameChanges.map((change) => exists(change.targetPath)),
  )
  const currentRootExists = await exists(currentRoot)
  const targetRootExists = await exists(targetRoot)

  if (currentExists.every(Boolean) && !targetRootExists) {
    await fs.mkdir(path.dirname(targetRoot), { recursive: true })
    await fs.rename(currentRoot, targetRoot)
    return { currentRoot, targetRoot, mode: 'release-folder-rename' }
  }

  if (
    currentRootExists &&
    targetRootExists &&
    currentExists.every((value) => !value) &&
    targetExists.every(Boolean)
  ) {
    await mergeDirectoryContents(currentRoot, targetRoot)
    return { currentRoot, targetRoot, mode: 'release-folder-recovery' }
  }

  return null
}

function sourcePathForChange(change, directoryMove) {
  if (change.alreadyAtTarget) {
    return change.targetPath
  }

  if (
    directoryMove &&
    isPathInside(directoryMove.currentRoot, change.currentPath)
  ) {
    return path.join(
      directoryMove.targetRoot,
      path.relative(directoryMove.currentRoot, change.currentPath),
    )
  }

  return change.currentPath
}

async function mergeDirectoryContents(currentRoot, targetRoot) {
  const entries = await fs.readdir(currentRoot, { withFileTypes: true })
  for (const entry of entries) {
    const targetPath = path.join(targetRoot, entry.name)
    if (await exists(targetPath)) {
      throw new Error(`Target release folder already contains ${entry.name}`)
    }
  }

  for (const entry of entries) {
    await fs.rename(
      path.join(currentRoot, entry.name),
      path.join(targetRoot, entry.name),
    )
  }

  await fs.rmdir(currentRoot).catch(() => undefined)
}

function commonDirectory(paths) {
  if (paths.length === 0) {
    return null
  }

  const resolvedPaths = paths.map((item) => path.resolve(item))
  let commonPath = resolvedPaths[0]
  while (
    !resolvedPaths.every(
      (item) =>
        item === commonPath || item.startsWith(`${commonPath}${path.sep}`),
    )
  ) {
    const parent = path.dirname(commonPath)
    if (parent === commonPath) {
      return commonPath
    }
    commonPath = parent
  }

  return commonPath
}

function isPathInside(root, filePath) {
  const relative = path.relative(root, filePath)
  return (
    relative.length > 0 &&
    !relative.startsWith('..') &&
    !path.isAbsolute(relative)
  )
}

async function readMetadata(filePath, metadataReader) {
  if (metadataReader) {
    return await metadataReader(filePath)
  }

  try {
    const musicMetadata = await import('music-metadata')
    return await musicMetadata.parseFile(filePath, {
      duration: true,
      skipCovers: true,
    })
  } catch {
    return { common: {}, format: {}, native: {} }
  }
}

function tagsFromMetadata(metadata) {
  const common = metadata?.common ?? {}

  return {
    title: stringOrNull(common.title),
    artists: stringArray(common.artists) ?? singleStringArray(common.artist),
    album: stringOrNull(common.album),
    albumArtists:
      stringArray(common.albumartists) ?? singleStringArray(common.albumartist),
    trackNumber:
      Number.isInteger(common.track?.no) && common.track.no > 0
        ? common.track.no
        : null,
    date: releaseDate(common),
    year: Number.isInteger(common.year) ? common.year : null,
    genre: stringArray(common.genre) ?? [],
    label: firstString(common.label) ?? firstString(common.publisher),
    catalogNumber: catalogNumber(common, metadata?.native),
    comment: firstComment(common.comment),
    composer: stringArray(common.composer) ?? [],
    producer: nativeValues(metadata?.native, /producer/i),
    remixer: nativeValues(metadata?.native, /remix/i),
    ...customTagsFromNative(metadata?.native),
  }
}

function technicalFromMetadata(metadata) {
  const format = metadata?.format ?? {}

  return {
    bitDepth: Number.isInteger(format.bitsPerSample)
      ? format.bitsPerSample
      : null,
    durationSeconds:
      typeof format.duration === 'number' ? Math.round(format.duration) : null,
    sampleRate: Number.isInteger(format.sampleRate) ? format.sampleRate : null,
  }
}

function tagObject(tags) {
  if (!tags || typeof tags !== 'object') {
    return {}
  }

  const normalized = {}
  for (const [field, value] of Object.entries(tags)) {
    if (scalarTagFields.has(field)) {
      normalized[field] = normalizedNullableString(value)
    } else if (numericTagFields.has(field)) {
      normalized[field] = normalizedNullableNumber(value)
    } else if (listTagFields.has(field)) {
      normalized[field] = normalizedStringArray(value)
    } else if (isCustomTagField(field)) {
      normalized[field] = normalizedDynamicTagValue(value)
    }
  }

  return normalized
}

function hasTagChanges(tags) {
  return tags && Object.keys(tags).length > 0
}

async function readPreviousTags(tagAdapter, filePath) {
  if (typeof tagAdapter.readTags !== 'function') {
    return null
  }

  try {
    return await tagAdapter.readTags(filePath)
  } catch {
    return null
  }
}

const defaultTagAdapter = {
  readTags: readTagsWithTagLib,
  writeTags: writeTagsWithTagLib,
}

async function readTagsWithTagLib(filePath) {
  const taglib = await import('taglib-wasm/simple')
  return await taglib.readTags(filePath)
}

async function writeTagsWithTagLib(filePath, tags) {
  const taglib = await import('taglib-wasm/simple')
  await taglib.applyTagsToFile(filePath, toTagLibTags(tags))
}

function toTagLibTags(tags) {
  const mapped = {}
  mapTag(mapped, 'title', tags.title)
  mapTag(mapped, 'artist', joinTag(tags.artists))
  mapTag(mapped, 'album', tags.album)
  mapTag(mapped, 'albumArtist', joinTag(tags.albumArtists))
  mapTag(mapped, 'track', tags.trackNumber)
  if (Object.prototype.hasOwnProperty.call(tags, 'date')) {
    mapTag(mapped, 'date', tags.date)
  } else if (Object.prototype.hasOwnProperty.call(tags, 'year')) {
    mapTag(mapped, 'date', tags.year)
  }
  mapTag(mapped, 'genre', joinTag(tags.genre, '; '))
  mapTag(mapped, 'label', tags.label)
  mapTag(mapped, 'catalogNumber', tags.catalogNumber)
  mapTag(mapped, 'comment', tags.comment)
  mapTag(mapped, 'composer', joinTag(tags.composer))
  mapTag(mapped, 'producer', joinTag(tags.producer))
  mapStandardTagField(mapped, 'remixer', tags.remixer)
  for (const [field, value] of Object.entries(tags)) {
    if (!knownTagFields.has(field) && isCustomTagField(field)) {
      mapTag(mapped, field, joinTag(value))
    }
  }
  return mapped
}

function mapStandardTagField(target, field, value) {
  mapTag(target, tagLibFieldAliases.get(field) ?? field, joinTag(value))
}

function mapTag(target, key, value) {
  if (value === undefined) {
    return
  }

  target[key] = value === null ? '' : value
}

function joinTag(value, separator = ', ') {
  return Array.isArray(value) ? value.join(separator) : value
}

function normalizedNullableString(value) {
  if (value === null || value === undefined) {
    return null
  }

  const stringValue = String(value).trim()
  return stringValue.length > 0 ? stringValue : null
}

function normalizedNullableNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function normalizedStringArray(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map((item) => String(item).trim()).filter(Boolean)
}

function normalizedDynamicTagValue(value) {
  if (Array.isArray(value)) {
    return normalizedStringArray(value)
  }

  if (value === null || value === undefined) {
    return []
  }

  const stringValue = String(value).trim()
  return stringValue.length > 0 ? [stringValue] : []
}

function requireAbsolutePath(value, fieldName) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) {
    throw new Error(`${fieldName} must be an absolute path`)
  }

  return path.normalize(value)
}

function normalizeMaybeAbsolute(value) {
  return typeof value === 'string' && path.isAbsolute(value)
    ? path.normalize(value)
    : null
}

function hasUnsafePathBytes(value) {
  return value.includes('\0') || path.basename(value).trim().length === 0
}

function errorIssue(code) {
  return {
    code,
    message: code,
    severity: 'error',
  }
}

function changesWithOperationFailures(changes, operations) {
  const failedOperationsByOwnedItemId = new Map(
    operations
      .filter((operation) => operation.result === 'failed')
      .map((operation) => [operation.ownedItemId, operation]),
  )

  if (failedOperationsByOwnedItemId.size === 0) {
    return changes
  }

  return changes.map((change) => {
    const failedOperation = failedOperationsByOwnedItemId.get(
      change.ownedItemId,
    )
    if (!failedOperation) {
      return change
    }

    return {
      ...change,
      issues: [
        ...change.issues,
        {
          code: 'local_edit_failed',
          message: failedOperation.error ?? 'Local edit failed',
          severity: 'error',
        },
      ],
    }
  })
}

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
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

function fileFormat(filePath) {
  return path.extname(filePath).slice(1).toLowerCase()
}

function catalogNumber(common, nativeTags) {
  return (
    firstString(common.catalogNumber) ??
    firstString(common.catalognumber) ??
    firstString(common.catalogNo) ??
    nativeValues(nativeTags, /catalog/i)[0] ??
    null
  )
}

function releaseDate(common) {
  return (
    stringOrNull(common.date) ??
    stringOrNull(common.originaldate) ??
    stringOrNull(common.releasedate) ??
    null
  )
}

function nativeValues(nativeTags, pattern) {
  const values = []
  for (const tags of Object.values(nativeTags ?? {})) {
    for (const tag of tags ?? []) {
      if (pattern.test(String(tag.id)) && typeof tag.value === 'string') {
        values.push(tag.value.trim())
      }
    }
  }

  return [...new Set(values.filter(Boolean))]
}

function customTagsFromNative(nativeTags) {
  const tags = {}
  for (const nativeGroup of Object.values(nativeTags ?? {})) {
    for (const tag of nativeGroup ?? []) {
      const field = String(tag.id ?? '').trim()
      if (
        !isCustomTagField(field) ||
        knownTagFields.has(field) ||
        reservedNativeTagFields.has(normalizedNativeTagField(field))
      ) {
        continue
      }

      const value = typeof tag.value === 'string' ? tag.value.trim() : ''
      if (!value) {
        continue
      }

      tags[field] = [...new Set([...(tags[field] ?? []), value])]
    }
  }

  return tags
}

function normalizedNativeTagField(field) {
  return field.split(':').at(-1)?.toUpperCase() ?? field.toUpperCase()
}

function isCustomTagField(field) {
  return /^[A-Za-z0-9_.:-]{1,64}$/.test(field)
}

function stringArray(value) {
  if (!Array.isArray(value)) {
    return null
  }

  const values = value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
  return values.length > 0 ? values : null
}

function firstString(value) {
  const values = stringArray(value)
  if (values) {
    return values[0]
  }

  return stringOrNull(value)
}

function firstComment(value) {
  const stringValue = firstString(value)
  if (stringValue) {
    return stringValue
  }

  if (!Array.isArray(value)) {
    return null
  }

  for (const item of value) {
    const text = stringOrNull(item?.text)
    if (text) {
      return text
    }
  }

  return null
}

function singleStringArray(value) {
  const item = stringOrNull(value)
  return item ? [item] : []
}

function stringOrNull(value) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null
}

module.exports = {
  applyLocalEdits,
  inspectLocalFile,
  previewLocalEdits,
  toTagLibTags,
  writableTagFormats,
}
