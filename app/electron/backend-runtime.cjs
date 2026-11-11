const { spawn } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const net = require('node:net')
const path = require('node:path')
const { runArchiveCommand } = require('./archive-command.cjs')
const { readBoundedJson } = require('./discover-json.cjs')

const loopbackHttpProtocol = 'http'

async function createBackendRuntime(app) {
  const dataDir = await resolveDataDir(app)
  const logDir = path.join(dataDir, 'logs')
  await fsp.mkdir(logDir, { recursive: true })

  const externalBaseUrl = process.env.DISCWEAVE_API_BASE_URL
  if (externalBaseUrl) {
    const status = {
      baseUrl: externalBaseUrl,
      dataDir,
      executable: null,
      health: 'external',
      logDir,
      pid: null,
    }

    return {
      baseUrl: externalBaseUrl,
      getStatus: () => ({ ...status }),
      requestHeaders: () => ({}),
      stop: () => {},
      archiveStatus: async () => unavailableArchiveStatus(),
      upgradeArchive: async () => ({
        status: 'blocked',
        code: 'archive.external_backend',
        backupDirectory: null,
      }),
    }
  }

  const port = await reserveLoopbackPort()
  const token = crypto.randomBytes(32).toString('base64url')
  const baseUrl = `${loopbackHttpProtocol}://127.0.0.1:${port}`
  const executable = resolveBackendExecutable(app)
  const status = {
    baseUrl,
    dataDir,
    executable,
    health: 'starting',
    logDir,
    pid: null,
  }

  let processHandle = null
  let upgradePromise = null
  async function start() {
    if (!executable) {
      status.health = 'external'
      return
    }
    status.health = 'starting'
    const log = fs.createWriteStream(path.join(logDir, 'backend.log'), {
      flags: 'a',
    })
    processHandle = spawn(executable.command, executable.args, {
      cwd: path.dirname(executable.command),
      env: {
        ...process.env,
        ASPNETCORE_URLS: baseUrl,
        DISCWEAVE_DATA_DIR: dataDir,
        DISCWEAVE_RUNTIME_MODE: 'LocalDesktop',
        DiscWeave__LocalDesktop__Token: token,
        DiscWeave__StorageProvider: 'Sqlite',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    status.pid = processHandle.pid ?? null
    processHandle.stdout.pipe(log, { end: false })
    processHandle.stderr.pipe(log, { end: false })
    processHandle.once('close', () => log.end())
    let rejectStartupFailure = null
    const startupFailure = new Promise((_, reject) => {
      rejectStartupFailure = reject
    })
    processHandle.on('error', (error) => {
      status.health = 'failed'
      status.exitCode = null
      status.pid = null
      log.write(
        `[backend-runtime] failed to start ${executable.command} for ${baseUrl}: ${error.message}\n`,
      )
      rejectStartupFailure?.(error)
    })
    processHandle.on('exit', (code) => {
      rejectStartupFailure?.(
        new Error('The local backend stopped before becoming ready.'),
      )
      status.health = code === 0 ? 'stopped' : 'failed'
      status.exitCode = code
    })
    let startupFinished = false
    try {
      await Promise.race([
        waitForHealth(baseUrl, token, () => startupFinished),
        startupFailure,
      ])
      status.health = 'ready'
    } finally {
      startupFinished = true
      rejectStartupFailure = null
    }
  }
  async function startSafely() {
    try {
      await start()
    } catch {
      await stopBackendAndWait(processHandle, status).catch(() => {})
      status.health = 'failed'
    }
  }
  await startSafely()

  async function archiveStatus() {
    if (!executable) return unavailableArchiveStatus()
    if (upgradePromise)
      return {
        status: 'upgradeRequired',
        upgradeId: 'label-import-links-v1',
        canUpgrade: false,
        code: 'archive.upgrading',
      }
    const schema = await runArchiveCommand(
      executable,
      'status',
      dataDir,
      app.getPath('userData'),
    )
    if (
      schema.code !== 'archive.configuration_unsupported' ||
      status.health !== 'ready'
    )
      return schema
    // Inspect the actual configured database through the owned, authenticated runtime.
    // This fallback is read-only and never authorizes the canonical-path CLI upgrade.
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    try {
      const response = await fetch(
        new URL('/api/maintenance/schema', baseUrl),
        {
          headers: { 'x-discweave-local-token': token },
          signal: controller.signal,
          redirect: 'error',
        },
      )
      if (!response.ok) return schema
      const active = await readBoundedJson(
        response,
        65536,
        'Invalid schema status response',
      )
      if (
        !['current', 'upgradeRequired', 'unsupported'].includes(
          active?.status,
        ) ||
        active.upgradeId !== 'label-import-links-v1' ||
        (active.code !== null && typeof active.code !== 'string')
      )
        return schema
      return {
        ...active,
        canUpgrade: false,
        code:
          active.status === 'unsupported'
            ? active.code
            : 'archive.configuration_unsupported',
      }
    } catch {
      return schema
    } finally {
      clearTimeout(timeout)
    }
  }

  function upgradeArchive() {
    if (upgradePromise) return upgradePromise
    if (!executable)
      return Promise.resolve({
        status: 'blocked',
        code: 'archive.external_backend',
        backupDirectory: null,
      })
    upgradePromise = (async () => {
      const schema = await runArchiveCommand(
        executable,
        'status',
        dataDir,
        app.getPath('userData'),
      )
      if (schema.status === 'current')
        return { status: 'current', code: null, backupDirectory: null }
      if (schema.status !== 'upgradeRequired' || !schema.canUpgrade)
        return {
          status: 'blocked',
          code: schema.code ?? 'archive.schema_unsupported',
          backupDirectory: null,
        }
      await stopBackendAndWait(processHandle, status)
      let result
      try {
        result = await runArchiveCommand(
          executable,
          'upgrade',
          dataDir,
          app.getPath('userData'),
        )
      } finally {
        await startSafely()
      }
      return status.health === 'ready'
        ? result
        : { ...result, status: 'blocked', code: 'archive.restart_failed' }
    })().finally(() => {
      upgradePromise = null
    })
    return upgradePromise
  }

  return {
    baseUrl,
    getStatus: () => ({ ...status }),
    requestHeaders: () =>
      processHandle ? { 'x-discweave-local-token': token } : {},
    stop: () => stopBackend(processHandle, status),
    archiveStatus,
    upgradeArchive,
  }
}

function unavailableArchiveStatus() {
  return {
    status: 'unsupported',
    upgradeId: 'label-import-links-v1',
    canUpgrade: false,
    code: 'archive.external_backend',
  }
}

function stopBackendAndWait(processHandle, status) {
  if (
    !processHandle ||
    processHandle.exitCode !== null ||
    processHandle.signalCode !== null
  )
    return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      processHandle.removeListener('exit', exited)
      reject(
        new Error('The backend did not stop. The archive was not upgraded.'),
      )
    }, 12000)
    function exited() {
      clearTimeout(timer)
      resolve()
    }
    processHandle.once('exit', exited)
    stopBackend(processHandle, status)
  })
}

async function resolveDataDir(app) {
  const dataDir = path.join(app.getPath('appData'), 'DiscWeave')
  const legacyDataDir = path.join(app.getPath('userData'), 'DiscWeave')
  await copyLegacyDataDirIfNeeded(dataDir, legacyDataDir)

  return dataDir
}

async function copyLegacyDataDirIfNeeded(dataDir, legacyDataDir) {
  if (path.resolve(dataDir) === path.resolve(legacyDataDir)) {
    return
  }

  if (!(await pathExists(legacyDataDir))) {
    return
  }

  if (await hasDurableRuntimeData(dataDir)) {
    return
  }

  await fsp.mkdir(dataDir, { recursive: true })
  await copyDirectoryContents(legacyDataDir, dataDir)
}

async function hasDurableRuntimeData(dataDir) {
  return (
    (await pathExists(path.join(dataDir, 'discweave.sqlite'))) ||
    (await pathExists(path.join(dataDir, 'artifacts'))) ||
    (await pathExists(path.join(dataDir, 'integrations.local.json')))
  )
}

async function copyDirectoryContents(sourceDir, targetDir) {
  const entries = await fsp.readdir(sourceDir, { withFileTypes: true })
  await Promise.all(
    entries.map(async (entry) => {
      const sourcePath = path.join(sourceDir, entry.name)
      const targetPath = path.join(targetDir, entry.name)
      await fsp.cp(sourcePath, targetPath, {
        errorOnExist: false,
        force: false,
        recursive: entry.isDirectory(),
      })
    }),
  )
}

async function pathExists(candidatePath) {
  try {
    await fsp.access(candidatePath)
    return true
  } catch {
    return false
  }
}

function resolveBackendExecutable(app) {
  const configured = process.env.DISCWEAVE_API_EXECUTABLE
  if (configured) {
    return { args: [], command: configured }
  }

  if (!app.isPackaged) {
    return null
  }

  const candidate = path.join(process.resourcesPath, 'api', 'DiscWeave.Api')
  return fs.existsSync(candidate) ? { args: [], command: candidate } : null
}

function reserveLoopbackPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() => {
        if (!address || typeof address === 'string') {
          reject(new Error('Backend port reservation failed.'))
          return
        }

        resolve(address.port)
      })
    })
    server.on('error', reject)
  })
}

async function waitForHealth(baseUrl, token, stopped = () => false) {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline && !stopped()) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    try {
      const response = await fetch(new URL('/health', baseUrl), {
        headers: { 'x-discweave-local-token': token },
        signal: controller.signal,
      })
      if (response.ok) {
        return
      }
    } catch {
    } finally {
      clearTimeout(timeout)
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error('Local backend did not become healthy within 30 seconds.')
}

function stopBackend(processHandle, status) {
  if (
    !processHandle ||
    processHandle.exitCode !== null ||
    processHandle.signalCode !== null
  ) {
    return
  }

  status.health = 'stopping'
  processHandle.kill('SIGTERM')
  setTimeout(() => {
    if (processHandle.exitCode === null && processHandle.signalCode === null) {
      processHandle.kill('SIGKILL')
    }
  }, 5000).unref()
}

module.exports = { createBackendRuntime }
