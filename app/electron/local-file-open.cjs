const path = require('node:path')

function createLocalFileOpenHandler({ fs, shell }) {
  return async function handleLocalFileOpen(_event, filePath) {
    const normalizedPath = normalizedAbsoluteLocalPath(filePath)
    if (!normalizedPath) {
      return {
        ok: false,
        reason: 'invalid-path',
        message: 'A valid absolute local file path is required.',
      }
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
  if (!trimmed || trimmed.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return null
  }

  return path.isAbsolute(trimmed) ? path.normalize(trimmed) : null
}

module.exports = {
  createLocalFileOpenHandler,
  normalizedAbsoluteLocalPath,
}
