const fs = require('node:fs/promises')
const fsSync = require('node:fs')
const crypto = require('node:crypto')
const path = require('node:path')

const audioExtensions = new Set(['.flac', '.mp3', '.wav', '.ogg', '.m4a'])
const coverExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const maxCoverArtifactSizeBytes = 10 * 1024 * 1024
const maxScanDepth = 24

async function scanFolder(sourceRoot, options = {}) {
  const root = await trustedScanRoot(sourceRoot)
  const mode = scanMode(options)
  const files = []
  const scanState = { diagnostics: [], ignoredFileCount: 0 }
  await walk(root, root, files, scanState, mode, 0)

  return {
    sourceRoot: root,
    files,
    ignoredFileCount: scanState.ignoredFileCount,
    diagnostics: scanState.diagnostics,
  }
}

async function trustedScanRoot(sourceRoot) {
  if (typeof sourceRoot !== 'string' || !path.isAbsolute(sourceRoot)) {
    throw new Error(
      'Import folder must be an absolute path selected by the desktop shell.',
    )
  }

  const root = path.resolve(sourceRoot)
  const realRoot = await fs.realpath(root)
  const stats = await fs.stat(realRoot)
  if (!stats.isDirectory()) {
    throw new Error('Import folder must be a directory.')
  }

  return realRoot
}

function scanMode(options) {
  return options?.mode === 'namesOnly' ? 'namesOnly' : 'full'
}

async function walk(root, current, files, scanState, mode, depth) {
  if (depth > maxScanDepth) {
    recordIgnoredDiagnostic(scanState, root, current, {
      code: 'depth_limit',
      message:
        'Import scanner skipped a directory because it exceeded the maximum scan depth.',
      severity: 'warning',
    })
    return
  }
  let entries
  try {
    entries = await fs.readdir(current, { withFileTypes: true })
  } catch {
    recordIgnoredDiagnostic(scanState, root, current, {
      code: 'directory_unreadable',
      message: 'Import scanner could not read this directory.',
      severity: 'warning',
    })
    return
  }

  for (const entry of entries) {
    const fullPath = path.join(current, entry.name)
    if (entry.name.startsWith('.')) {
      recordIgnoredDiagnostic(scanState, root, fullPath, {
        code: 'hidden_path',
        message: 'Import scanner skipped a hidden filesystem entry.',
        severity: 'info',
      })
      continue
    }

    if (entry.isDirectory()) {
      await walk(root, fullPath, files, scanState, mode, depth + 1)
      continue
    }

    if (!entry.isFile()) {
      recordIgnoredDiagnostic(scanState, root, fullPath, {
        code: entry.isSymbolicLink() ? 'symlink_ignored' : 'non_file_ignored',
        message: entry.isSymbolicLink()
          ? 'Import scanner skipped a symbolic link.'
          : 'Import scanner skipped a filesystem entry that is not a regular file.',
        severity: 'info',
      })
      continue
    }

    const extension = path.extname(entry.name).toLowerCase()
    if (audioExtensions.has(extension)) {
      await addScannedFile(files, scanState, root, fullPath, () =>
        audioFile(root, fullPath, extension, mode, scanState),
      )
      continue
    }

    if (coverExtensions.has(extension)) {
      await addScannedFile(files, scanState, root, fullPath, () =>
        coverFile(root, fullPath, extension, mode, scanState),
      )
      continue
    }

    recordIgnoredDiagnostic(scanState, root, fullPath, {
      code: 'unsupported_extension',
      extension,
      message: 'Import scanner skipped an unsupported file extension.',
      severity: 'info',
    })
  }
}

async function addScannedFile(files, scanState, root, filePath, createFile) {
  try {
    files.push(await createFile())
  } catch {
    recordIgnoredDiagnostic(scanState, root, filePath, {
      code: 'file_stat_failed',
      message: 'Import scanner could not read file metadata for this file.',
      severity: 'warning',
    })
  }
}

async function audioFile(root, filePath, extension, mode, scanState) {
  const stats = await fs.stat(filePath)
  const metadata =
    mode === 'namesOnly'
      ? null
      : await readAudioMetadata(root, filePath, scanState)
  const contentHash =
    mode === 'namesOnly'
      ? null
      : await safeSha256File(root, filePath, scanState)

  return {
    filePath,
    relativePath: path.relative(root, filePath),
    format: scannedAudioFormat(extension, metadata),
    sizeBytes: stats.size,
    lastModifiedAt: stats.mtime.toISOString(),
    contentHash,
    audioMetadata: metadata,
    coverArtifact: null,
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

async function safeSha256File(root, filePath, scanState) {
  try {
    return await sha256File(filePath)
  } catch {
    addDiagnostic(scanState, root, filePath, {
      code: 'hash_read_failed',
      message:
        'Import scanner could not calculate a SHA-256 content hash for this audio file.',
      severity: 'warning',
      source: 'hashing',
    })
    return null
  }
}

async function coverFile(root, filePath, extension, mode, scanState) {
  const stats = await fs.stat(filePath)
  const coverArtifact = await coverArtifactPayload(
    root,
    filePath,
    extension,
    mode,
    stats,
    scanState,
  )

  return {
    filePath,
    relativePath: path.relative(root, filePath),
    format: null,
    sizeBytes: stats.size,
    lastModifiedAt: stats.mtime.toISOString(),
    audioMetadata: null,
    coverArtifact,
  }
}

async function coverArtifactPayload(
  root,
  filePath,
  extension,
  mode,
  stats,
  scanState,
) {
  if (mode === 'namesOnly') {
    return null
  }

  if (stats.size > maxCoverArtifactSizeBytes) {
    addDiagnostic(scanState, root, filePath, {
      code: 'cover_too_large',
      message:
        'Import scanner kept the cover path but did not attach an oversized cover artifact.',
      severity: 'warning',
      sizeBytes: stats.size,
      source: 'cover',
    })
    return null
  }

  try {
    return {
      fileName: path.basename(filePath),
      extension,
      contentType: coverContentType(extension),
      sizeBytes: stats.size,
      contentBase64: (await fs.readFile(filePath)).toString('base64'),
    }
  } catch {
    addDiagnostic(scanState, root, filePath, {
      code: 'cover_read_failed',
      message:
        'Import scanner kept the cover path but could not read the cover artifact bytes.',
      severity: 'warning',
      sizeBytes: stats.size,
      source: 'cover',
    })
    return null
  }
}

async function readAudioMetadata(root, filePath, scanState) {
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
      codec: stringOrNull(metadata.format?.codec),
      container: stringOrNull(metadata.format?.container),
      lossless:
        typeof metadata.format?.lossless === 'boolean'
          ? metadata.format.lossless
          : null,
      bitrateKbps: bitrateKbps(metadata.format?.bitrate),
      sampleRateHz: positiveIntegerOrNull(metadata.format?.sampleRate),
      channels: positiveIntegerOrNull(metadata.format?.numberOfChannels),
    }
  } catch {
    addDiagnostic(scanState, root, filePath, {
      code: 'metadata_read_failed',
      message: 'Import scanner could not read audio metadata for this file.',
      severity: 'warning',
      source: 'metadata',
    })
    return emptyAudioMetadata()
  }
}

function emptyAudioMetadata() {
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
    codec: null,
    container: null,
    lossless: null,
    bitrateKbps: null,
    sampleRateHz: null,
    channels: null,
  }
}

function recordIgnoredDiagnostic(scanState, root, filePath, diagnostic) {
  scanState.ignoredFileCount += 1
  addDiagnostic(scanState, root, filePath, diagnostic)
}

function addDiagnostic(scanState, root, filePath, diagnostic) {
  scanState.diagnostics.push({
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    filePath,
    relativePath: path.relative(root, filePath),
    extension: diagnostic.extension ?? path.extname(filePath).toLowerCase(),
    sizeBytes: diagnostic.sizeBytes ?? null,
    source: diagnostic.source ?? 'scanner',
  })
}

function scannedAudioFormat(extension, metadata) {
  if (extension.toLowerCase() === '.m4a' && isAlacMetadata(metadata)) {
    return 'alac'
  }

  return extension.replace(/^\./, '').toLowerCase()
}

function isAlacMetadata(metadata) {
  const codec = stringOrNull(metadata?.codec)
  const container = stringOrNull(metadata?.container)
  return [codec, container].some((value) =>
    /^(alac|apple lossless)$/i.test(value ?? ''),
  )
}

function bitrateKbps(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value / 1000)
    : null
}

function positiveIntegerOrNull(value) {
  return Number.isInteger(value) && value > 0 ? value : null
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

module.exports = { scanFolder, scannedAudioFormat }
