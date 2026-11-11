const { spawn } = require('node:child_process')
const path = require('node:path')

// Commands and archive paths are owned by the main process, never the renderer.
function runArchiveCommand(
  executable,
  action,
  dataDir,
  settingsDir,
  options = {},
) {
  if (!['status', 'upgrade'].includes(action)) {
    return Promise.reject(new Error('Unsupported archive command.'))
  }
  const spawnProcess = options.spawnProcess ?? spawn
  return new Promise((resolve, reject) => {
    const child = spawnProcess(
      executable.command,
      [
        ...executable.args,
        action === 'status' ? '--archive-status' : '--upgrade-archive',
      ],
      {
        cwd: path.dirname(executable.command),
        env: {
          ...process.env,
          DISCWEAVE_DATA_DIR: dataDir,
          DISCWEAVE_DESKTOP_SETTINGS_DIR: settingsDir,
          DISCWEAVE_RUNTIME_MODE: 'LocalDesktop',
          DiscWeave__StorageProvider: 'Sqlite',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    )
    let output = ''
    let failure = null
    const timeout = setTimeout(
      () => {
        failure = new Error(
          'Archive operation timed out. The existing backup is retained.',
        )
        child.kill('SIGKILL')
      },
      options.timeoutMs ?? (action === 'status' ? 30000 : 30 * 60 * 1000),
    )
    child.stdout.on('data', (chunk) => {
      if (failure) return
      output += chunk.toString('utf8')
      if (Buffer.byteLength(output) > 65536) {
        failure = new Error('Invalid archive command response.')
        child.kill('SIGKILL')
      }
    })
    // Backend diagnostics may include private paths; do not return raw stderr.
    child.stderr.on('data', () => {})
    child.on('error', () => {
      failure = new Error('The archive command could not be started.')
    })
    child.on('close', (code) => {
      clearTimeout(timeout)
      if (failure) return reject(failure)
      try {
        const value = JSON.parse(output)
        if (!validResult(value, action, code)) throw new Error('Invalid result')
        resolve(value)
      } catch {
        reject(
          new Error(
            'The archive command did not finish safely. Restart DiscWeave before retrying.',
          ),
        )
      }
    })
  })
}

function validResult(value, action, exitCode) {
  if (!value || typeof value !== 'object' || ![0, 1].includes(exitCode))
    return false
  if (value.code !== null && typeof value.code !== 'string') return false
  if (action === 'status') {
    return (
      ['current', 'upgradeRequired', 'unsupported'].includes(value.status) &&
      value.upgradeId === 'label-import-links-v1' &&
      typeof value.canUpgrade === 'boolean'
    )
  }
  return (
    ['upgraded', 'current', 'blocked'].includes(value.status) &&
    (value.backupDirectory === null ||
      (typeof value.backupDirectory === 'string' &&
        path.isAbsolute(value.backupDirectory))) &&
    (exitCode === 0 ? value.status !== 'blocked' : value.status === 'blocked')
  )
}

module.exports = { runArchiveCommand }
