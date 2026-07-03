const path = require('node:path')

function createLocalFileOpenHandler({
  fs,
  isTrustedPath = async () => true,
  resolveTrustedFile,
  shell,
}) {
  return async function handleLocalFileOpen(event, request) {
    const normalizedPath = normalizedAbsoluteLocalPath(request?.path)
    if (!normalizedPath) {
      return {
        ok: false,
        reason: 'invalid-path',
        message: 'A valid absolute local file path is required.',
      }
    }

    const localAudioFileId = normalizedLocalAudioFileId(
      request?.localAudioFileId,
    )
    const digitalTrackFileLinkId = normalizedLocalAudioFileId(
      request?.digitalTrackFileLinkId,
    )
    if (!localAudioFileId || !digitalTrackFileLinkId) {
      return disallowedLocalFileOpen(normalizedPath)
    }

    let trustedFile
    try {
      trustedFile = await resolveTrustedFile(event, localAudioFileId)
    } catch {
      return disallowedLocalFileOpen(normalizedPath)
    }

    const trustedPath = normalizedAbsoluteLocalPath(trustedFile?.path)
    if (!trustedPath || !samePath(normalizedPath, trustedPath)) {
      return disallowedLocalFileOpen(normalizedPath)
    }
    if (!(await isTrustedPath(trustedPath))) {
      return disallowedLocalFileOpen(normalizedPath)
    }

    let stat
    try {
      stat = await fs.stat(normalizedPath)
    } catch {
      return {
        ok: false,
        path: normalizedPath,
        reason: 'missing',
        message: 'The local file does not exist.',
      }
    }

    if (!stat.isFile()) {
      return {
        ok: false,
        path: normalizedPath,
        reason: 'not-file',
        message: 'The local path is not a file.',
      }
    }

    try {
      const errorMessage = await shell.openPath(normalizedPath)
      if (errorMessage) {
        return {
          ok: false,
          path: normalizedPath,
          reason: 'system-error',
          message: errorMessage,
        }
      }
    } catch (error) {
      return {
        ok: false,
        path: normalizedPath,
        reason: 'system-error',
        message:
          error instanceof Error
            ? error.message
            : 'The system could not open this file.',
      }
    }

    return { ok: true, path: normalizedPath }
  }
}

function normalizedAbsoluteLocalPath(filePath) {
  if (typeof filePath !== 'string') {
    return null
  }

  const trimmed = filePath.trim()
  if (
    !trimmed ||
    trimmed.startsWith('//') ||
    /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
  ) {
    return null
  }

  return path.isAbsolute(trimmed) ? path.normalize(trimmed) : null
}

function normalizedLocalAudioFileId(localAudioFileId) {
  if (typeof localAudioFileId !== 'string') {
    return ''
  }

  return localAudioFileId.trim()
}

function samePath(left, right) {
  return path.normalize(left) === path.normalize(right)
}

function disallowedLocalFileOpen(filePath) {
  return {
    ok: false,
    path: filePath,
    reason: 'invalid-path',
    message: 'Local file open is not allowed for this file.',
  }
}

module.exports = {
  createLocalFileOpenHandler,
  normalizedAbsoluteLocalPath,
}
