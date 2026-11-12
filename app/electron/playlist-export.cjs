const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { randomUUID } = require('node:crypto')
const { constants } = require('node:fs')

const audioExtensions = new Set([
  '.flac',
  '.mp3',
  '.wav',
  '.ogg',
  '.m4a',
  '.aiff',
  '.aif',
  '.aac',
  '.opus',
  '.oga',
])

function createPlaylistExportHandlers({
  fs,
  dialog,
  resolveTrack,
  resolveTrustedFile,
  isTrustedFile = async () => false,
  validateSender,
  now = Date.now,
}) {
  const plans = new WeakMap()
  const busy = new WeakSet()
  function validate(event) {
    validateSender(event)
  }

  async function inspect(event, request) {
    validate(event)
    const entries = validateEntries(request?.entries)
    const checked = await checkEntries(event, entries)
    return storeInspection(event, entries, checked)
  }

  function storeInspection(event, entries, checked) {
    const inspectionId = randomUUID()
    plans.set(event.sender, {
      inspectionId,
      entries,
      checked,
      expires: now() + 5 * 60_000,
    })
    return inspectionResult(inspectionId, checked)
  }

  async function exportPlaylist(event, request) {
    validate(event)
    if (busy.has(event.sender))
      throw new Error('A playlist export is already in progress.')
    const entries = validateEntries(request?.entries)
    const plan = plans.get(event.sender)
    if (
      !plan ||
      plan.inspectionId !== request?.inspectionId ||
      plan.expires <= now() ||
      JSON.stringify(plan.entries) !== JSON.stringify(entries)
    ) {
      return {
        cancelled: false,
        blocked: true,
        ...(await inspect(event, { entries })),
      }
    }
    busy.add(event.sender)
    try {
      let checked = await checkEntries(event, entries)
      if (!sameInspection(plan.checked, checked))
        return blocked(event, entries, checked)
      if (!canExport(checked, request.allowPartial === true))
        return blocked(event, entries, checked)
      const result = await dialog.showSaveDialog({
        title: 'Export playlist for an external player',
        defaultPath: `${safeName(request.name)}.m3u8`,
        filters: [{ name: 'UTF-8 playlist', extensions: ['m3u8'] }],
      })
      if (result.canceled || !result.filePath) return { cancelled: true }
      const destination = absoluteLocalPath(result.filePath)
      if (!destination || path.extname(destination).toLowerCase() !== '.m3u8')
        throw new Error(
          'Choose a local .m3u8 destination. Audio files are never overwritten.',
        )
      if (
        entries.some(
          (entry) =>
            entry.file && absoluteLocalPath(entry.file.path) === destination,
        )
      )
        throw new Error('The export cannot overwrite a source file.')
      checked = await checkEntries(event, entries)
      if (!sameInspection(plan.checked, checked))
        return blocked(event, entries, checked)
      if (!canExport(checked, request.allowPartial === true))
        return blocked(event, entries, checked)
      const available = entries.filter(
        (_, index) => checked[index].status === 'available',
      )
      if (plan.expires <= now()) return blocked(event, entries, checked)
      await writePlaylist(destination, encodeM3u8(available), fs)
      plans.delete(event.sender)
      return {
        cancelled: false,
        path: destination,
        exportedCount: available.length,
        omittedCount: entries.length - available.length,
      }
    } finally {
      busy.delete(event.sender)
    }
  }

  function blocked(event, entries, checked) {
    return {
      cancelled: false,
      blocked: true,
      ...storeInspection(event, entries, checked),
    }
  }

  async function checkEntries(event, entries) {
    const tracks = new Map()
    const files = new Map()
    const checks = new Map()
    const referenceKey = (entry) => JSON.stringify([entry.trackId, entry.file])
    const jobs = [
      ...new Map(entries.map((entry) => [referenceKey(entry), entry])),
    ]
    let nextJob = 0
    const controller = new AbortController()
    let timer
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort()
        reject(
          new Error(
            'Playlist inspection timed out. Please retry with fewer entries.',
          ),
        )
      }, 60000)
    })
    async function checkNext() {
      controller.signal.throwIfAborted()
      const job = jobs[nextJob++]
      if (!job) return
      const [key, entry] = job
      const result = await Promise.race([
        checkEntry(event, entry, tracks, files, controller.signal),
        deadline,
      ])
      controller.signal.throwIfAborted()
      checks.set(key, result)
      return checkNext()
    }
    // Bound both concurrency and the entire scan. A timed-out worker never
    // schedules another row, even if its underlying transport ignores abort.
    try {
      await Promise.all(
        Array.from({ length: Math.min(4, jobs.length) }, checkNext),
      )
    } finally {
      clearTimeout(timer)
      controller.abort()
    }
    return entries.map((entry) => ({
      key: entry.key,
      ...checks.get(referenceKey(entry)),
    }))
  }

  async function checkEntry(event, entry, tracks, files, signal) {
    const file = entry.file
    if (!file)
      return { status: 'unlinked', message: 'No local audio file selected.' }
    const normalized = absoluteLocalPath(file.path)
    if (
      !normalized ||
      !audioExtensions.has(path.extname(normalized).toLowerCase())
    )
      return {
        status: 'unsupported',
        message:
          'A supported absolute local audio path without line breaks is required.',
      }
    try {
      if (!tracks.has(entry.trackId))
        tracks.set(entry.trackId, resolveTrack(event, entry.trackId))
      const track = await tracks.get(entry.trackId)
      signal.throwIfAborted()
      const linked = track?.digitalFiles?.some(
        (candidate) =>
          candidate.digitalTrackFileLinkId === file.digitalTrackFileLinkId &&
          candidate.localAudioFileId === file.localAudioFileId &&
          absoluteLocalPath(candidate.path) === normalized,
      )
      if (!linked)
        return {
          status: 'untrusted',
          message:
            'This file is not linked to this track in the current collection.',
        }
      if (!files.has(file.localAudioFileId))
        files.set(
          file.localAudioFileId,
          resolveTrustedFile(event, file.localAudioFileId),
        )
      const trustedFile = await files.get(file.localAudioFileId)
      signal.throwIfAborted()
      if (absoluteLocalPath(trustedFile?.path) !== normalized)
        return {
          status: 'untrusted',
          message: 'The catalog file path has changed. Refresh the catalog.',
        }
      if (
        !(await isTrustedFile({
          localAudioFileId: file.localAudioFileId,
          path: normalized,
        }))
      )
        return {
          status: 'untrusted',
          message: 'Access to this local file has not been verified.',
        }
    } catch {
      return {
        status: 'untrusted',
        message: 'The current collection file link could not be verified.',
      }
    }
    try {
      signal.throwIfAborted()
      const stat = await fs.lstat(normalized)
      signal.throwIfAborted()
      if (!stat.isFile() || stat.isSymbolicLink())
        return {
          status: 'unsupported',
          message: 'Directories and symbolic links cannot be exported.',
        }
      await fs.access(normalized, constants.R_OK)
      signal.throwIfAborted()
      return {
        status: 'available',
        signature: JSON.stringify([
          normalized,
          stat.dev,
          stat.ino,
          stat.size,
          stat.mtimeMs,
        ]),
      }
    } catch {
      return {
        status: 'missing',
        message: 'The local audio file is missing or unreadable.',
      }
    }
  }
  return { inspect, export: exportPlaylist }
}

function validateEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > 10000)
    throw new Error('Export requires between 1 and 10000 track entries.')
  const keys = new Set()
  return entries.map((entry) => {
    if (
      !entry ||
      !shortString(entry.key, 200) ||
      keys.has(entry.key) ||
      typeof entry.trackId !== 'string' ||
      entry.trackId.length > 200
    )
      throw new Error('Invalid playlist entry.')
    keys.add(entry.key)
    const result = {
      key: entry.key,
      trackId: entry.trackId,
      title: metadata(entry.title),
      artist: metadata(entry.artist),
      duration: metadata(entry.duration),
    }
    if (entry.file != null) {
      const file = entry.file
      if (
        !shortString(file.localAudioFileId, 200) ||
        !shortString(file.digitalTrackFileLinkId, 200) ||
        typeof file.path !== 'string' ||
        file.path.length > 32768 ||
        !entry.trackId
      )
        throw new Error('Invalid local audio reference.')
      result.file = {
        path: file.path,
        localAudioFileId: file.localAudioFileId,
        digitalTrackFileLinkId: file.digitalTrackFileLinkId,
      }
    }
    return result
  })
}
function shortString(value, max) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= max &&
    !/[\r\n\0]/.test(value)
  )
}
function metadata(value) {
  return typeof value === 'string'
    ? value
        .slice(0, 4000)
        .replace(/[\r\n\0]+/g, ' ')
        .trim()
    : ''
}
function absoluteLocalPath(value) {
  if (
    typeof value !== 'string' ||
    /[\r\n\0]/.test(value) ||
    value.startsWith('//') ||
    /^[a-z][a-z0-9+.-]*:/i.test(value) ||
    !path.isAbsolute(value)
  )
    return null
  return path.normalize(value)
}
function sameInspection(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}
function canExport(checked, allowPartial) {
  const count = checked.filter((item) => item.status === 'available').length
  return count > 0 && (allowPartial || count === checked.length)
}
function inspectionResult(inspectionId, checked) {
  return {
    inspectionId,
    entries: checked.map(({ signature, ...entry }) => entry),
    availableCount: checked.filter((entry) => entry.status === 'available')
      .length,
  }
}
function safeName(value) {
  return (
    metadata(value)
      .replace(/[/\\:*?"<>|]/g, '_')
      .replace(/^\.+/, '')
      .slice(0, 150) || 'playlist'
  )
}
function durationSeconds(value) {
  const parts = value.split(':')
  if (
    parts.length < 2 ||
    parts.length > 3 ||
    parts.some((part) => !/^\d+$/.test(part))
  )
    return -1
  const numbers = parts.map(Number)
  if (numbers.slice(1).some((number) => number > 59)) return -1
  const result = numbers.reduce((total, number) => total * 60 + number, 0)
  return Number.isSafeInteger(result) && result >= 0 ? result : -1
}
function encodeM3u8(entries) {
  return (
    '#EXTM3U\n' +
    entries
      .map(
        (entry) =>
          `#EXTINF:${durationSeconds(entry.duration)},${metadata(entry.artist)} - ${metadata(entry.title)}\n${pathToFileURL(absoluteLocalPath(entry.file.path)).href}\n`,
      )
      .join('')
  )
}
async function writePlaylist(destination, content, fs) {
  const temporary = path.join(
    path.dirname(destination),
    `.discweave-playlist-${randomUUID()}.tmp`,
  )
  try {
    await fs.writeFile(temporary, content, {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    })
    // Atomic replacement never follows a destination symlink into an audio file.
    await fs.rename(temporary, destination)
  } finally {
    await fs.unlink(temporary).catch(() => {})
  }
}

function registerPlaylistExportIpc({
  ipcMain,
  handlers,
  trustedOrigin,
  isOwnedSender,
}) {
  for (const name of ['inspect', 'export'])
    ipcMain.handle(`discweave:playlists:${name}`, async (event, request) => {
      let origin
      try {
        origin = new URL(event.senderFrame?.url).origin
      } catch {
        /* Invalid frame. */
      }
      if (
        !isOwnedSender(event.sender) ||
        !event.senderFrame ||
        event.senderFrame !== event.sender.mainFrame ||
        !trustedOrigin() ||
        origin !== trustedOrigin()
      )
        throw new Error(
          'Playlist export requires the trusted application window.',
        )
      return handlers[name](event, request)
    })
}
async function withPlaylistLookupDeadline(action, timeoutMs = 15000) {
  const controller = new AbortController()
  let timer
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new Error('Local audio lookup timed out. Please retry.'))
    }, timeoutMs)
  })
  try {
    return await Promise.race([
      Promise.resolve().then(() => action(controller.signal)),
      deadline,
    ])
  } finally {
    clearTimeout(timer)
  }
}
module.exports = {
  withPlaylistLookupDeadline,
  createPlaylistExportHandlers,
  registerPlaylistExportIpc,
  encodeM3u8,
  absoluteLocalPath,
}
