const fs = require('node:fs/promises')
const path = require('node:path')

const audioExtensions = new Set(['.flac', '.mp3', '.wav', '.ogg', '.m4a'])
const coverExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const maxCoverArtifactSizeBytes = 10 * 1024 * 1024

async function scanFolder(sourceRoot) {
  const root = path.resolve(sourceRoot)
  const files = []
  const ignored = { count: 0 }
  await walk(root, root, files, ignored)

  return {
    sourceRoot: root,
    files,
    ignoredFileCount: ignored.count,
  }
}

async function walk(root, current, files, ignored) {
  let entries
  try {
    entries = await fs.readdir(current, { withFileTypes: true })
  } catch {
    ignored.count += 1
    return
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      ignored.count += 1
      continue
    }

    const fullPath = path.join(current, entry.name)
    if (entry.isDirectory()) {
      await walk(root, fullPath, files, ignored)
      continue
    }

    if (!entry.isFile()) {
      ignored.count += 1
      continue
    }

    const extension = path.extname(entry.name).toLowerCase()
    if (audioExtensions.has(extension)) {
      await addScannedFile(files, ignored, () =>
        audioFile(root, fullPath, extension),
      )
      continue
    }

    if (coverExtensions.has(extension)) {
      await addScannedFile(files, ignored, () =>
        coverFile(root, fullPath, extension),
      )
      continue
    }

    ignored.count += 1
  }
}

async function addScannedFile(files, ignored, createFile) {
  try {
    files.push(await createFile())
  } catch {
    ignored.count += 1
  }
}

async function audioFile(root, filePath, extension) {
  const stats = await fs.stat(filePath)
  const metadata = await readAudioMetadata(filePath)

  return {
    filePath,
    relativePath: path.relative(root, filePath),
    format: extension.slice(1),
    sizeBytes: stats.size,
    lastModifiedAt: stats.mtime.toISOString(),
    audioMetadata: metadata,
    coverArtifact: null,
  }
}

async function coverFile(root, filePath, extension) {
  const stats = await fs.stat(filePath)
  const contentBase64 =
    stats.size <= maxCoverArtifactSizeBytes
      ? (await fs.readFile(filePath)).toString('base64')
      : ''

  return {
    filePath,
    relativePath: path.relative(root, filePath),
    format: null,
    sizeBytes: stats.size,
    lastModifiedAt: stats.mtime.toISOString(),
    audioMetadata: null,
    coverArtifact: {
      fileName: path.basename(filePath),
      extension,
      contentType: coverContentType(extension),
      sizeBytes: stats.size,
      contentBase64,
    },
  }
}

async function readAudioMetadata(filePath) {
  try {
    const musicMetadata = await import('music-metadata')
    const metadata = await musicMetadata.parseFile(filePath, {
      duration: true,
      skipCovers: true,
    })
    const common = metadata.common ?? {}

    return {
      title: stringOrNull(common.title),
      artists: stringArray(common.artists) ?? singleStringArray(common.artist),
      albumTitle: stringOrNull(common.album),
      albumArtists:
        stringArray(common.albumartists) ??
        singleStringArray(common.albumartist),
      catalogNumber: catalogNumber(common, metadata.native),
      releaseDate: releaseDate(common),
      year: Number.isInteger(common.year) ? common.year : null,
      durationSeconds:
        typeof metadata.format?.duration === 'number'
          ? Math.round(metadata.format.duration)
          : null,
      trackNumber:
        Number.isInteger(common.track?.no) && common.track.no > 0
          ? common.track.no
          : null,
    }
  } catch {
    return {
      title: null,
      artists: [],
      albumTitle: null,
      albumArtists: [],
      catalogNumber: null,
      releaseDate: null,
      year: null,
      durationSeconds: null,
      trackNumber: null,
    }
  }
}

function catalogNumber(common, nativeTags) {
  const direct =
    stringOrNull(common.catalogNumber) ??
    stringOrNull(common.catalognumber) ??
    stringOrNull(common.catalogNo)
  if (direct) {
    return direct
  }

  for (const tags of Object.values(nativeTags ?? {})) {
    for (const tag of tags ?? []) {
      if (/catalog/i.test(tag.id) && typeof tag.value === 'string') {
        return tag.value.trim()
      }
    }
  }

  return null
}

function releaseDate(common) {
  return (
    stringOrNull(common.date) ??
    stringOrNull(common.originaldate) ??
    stringOrNull(common.releasedate) ??
    null
  )
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

function singleStringArray(value) {
  const item = stringOrNull(value)
  return item ? [item] : []
}

function stringOrNull(value) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null
}

function coverContentType(extension) {
  switch (extension) {
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    default:
      return 'application/octet-stream'
  }
}

module.exports = { scanFolder }
