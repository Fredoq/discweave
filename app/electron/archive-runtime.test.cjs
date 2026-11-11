// @vitest-environment node
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { createBackendRuntime } = require('./backend-runtime.cjs')

const roots = []
afterEach(async () => {
  for (const root of roots.splice(0))
    await fs.rm(root, { recursive: true, force: true })
})

async function setup(mode = 'success') {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'discweave-archive-runtime-'),
  )
  roots.push(root)
  const executable = path.join(root, 'backend.cjs')
  await fs.writeFile(
    executable,
    `#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const root = process.env.DISCWEAVE_DATA_DIR
const live = path.join(root, 'running')
const mode = ${JSON.stringify(mode)}
if (process.argv.includes('--archive-status')) {
  console.log(JSON.stringify({status:mode === 'unknown' || mode.startsWith('configured') ? 'unsupported' : 'upgradeRequired', upgradeId:'label-import-links-v1', canUpgrade:mode !== 'unknown' && !mode.startsWith('configured'), code:mode === 'unknown' ? 'archive.schema_unsupported' : mode.startsWith('configured') ? 'archive.configuration_unsupported' : null}))
} else if (process.argv.includes('--upgrade-archive')) {
  if (fs.existsSync(live)) process.exit(5)
  fs.writeFileSync(path.join(root, 'settings-path'), process.env.DISCWEAVE_DESKTOP_SETTINGS_DIR)
  fs.appendFileSync(path.join(root, 'upgrades'), 'upgrade\\n')
  if (mode === 'crash') process.exit(2)
  else { console.log(JSON.stringify({status:mode === 'blocked' ? 'blocked' : 'upgraded', code:mode === 'blocked' ? 'archive.backup_failed' : null, backupDirectory: mode === 'blocked' ? null : path.join(root, 'backup')})); process.exit(mode === 'blocked' ? 1 : 0) }
} else {
  if (mode === 'unknown' || (mode === 'restart-fail' && fs.existsSync(path.join(root, 'upgrades')))) process.exit(3)
  fs.writeFileSync(live, String(process.pid))
  const url = new URL(process.env.ASPNETCORE_URLS)
  const server = http.createServer((request, response) => {
    if (request.url === '/api/maintenance/schema') {
      if (request.headers['x-discweave-local-token'] !== process.env.DiscWeave__LocalDesktop__Token) { response.writeHead(401); response.end(); return }
      if (mode === 'configured-failure') { response.writeHead(500); response.end(); return }
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify({ status: mode === 'configured-unknown' ? 'unsupported' : 'upgradeRequired', upgradeId: 'label-import-links-v1', canUpgrade: true, code: mode === 'configured-unknown' ? 'archive.schema_unsupported' : null }))
    } else response.end('ok')
  })
  server.listen(Number(url.port), url.hostname)
  process.on('SIGTERM', () => setTimeout(() => { fs.unlinkSync(live); server.close(() => process.exit(0)) }, 50))
}
`,
  )
  await fs.chmod(executable, 0o755)
  const previous = process.env.DISCWEAVE_API_EXECUTABLE
  const external = process.env.DISCWEAVE_API_BASE_URL
  process.env.DISCWEAVE_API_EXECUTABLE = executable
  delete process.env.DISCWEAVE_API_BASE_URL
  const settingsDir = path.join(root, 'profile')
  let runtime
  try {
    runtime = await createBackendRuntime({
      isPackaged: true,
      getPath: (name) => (name === 'appData' ? root : settingsDir),
    })
  } finally {
    if (previous === undefined) delete process.env.DISCWEAVE_API_EXECUTABLE
    else process.env.DISCWEAVE_API_EXECUTABLE = previous
    if (external === undefined) delete process.env.DISCWEAVE_API_BASE_URL
    else process.env.DISCWEAVE_API_BASE_URL = external
  }
  return { runtime, root, settingsDir, dataDir: path.join(root, 'DiscWeave') }
}

async function stop(runtime) {
  runtime.stop()
  await vi.waitFor(() =>
    expect(['stopped', 'failed']).toContain(runtime.getStatus().health),
  )
}

describe('Archive runtime lifecycle', () => {
  it('waits for the owned backend to exit and restarts with the same origin and token', async () => {
    const { runtime, dataDir, settingsDir } = await setup()
    try {
      const baseUrl = runtime.baseUrl
      const headers = runtime.requestHeaders()
      const initialPid = runtime.getStatus().pid
      expect(await runtime.archiveStatus()).toMatchObject({
        status: 'upgradeRequired',
        canUpgrade: true,
      })
      const first = runtime.upgradeArchive()
      const repeated = runtime.upgradeArchive()
      expect(first).toBe(repeated)
      await expect(first).resolves.toMatchObject({ status: 'upgraded' })
      expect(runtime.getStatus().health).toBe('ready')
      expect(runtime.getStatus().pid).not.toBe(initialPid)
      expect(runtime.baseUrl).toBe(baseUrl)
      expect(runtime.requestHeaders()).toEqual(headers)
      expect(await fs.readFile(path.join(dataDir, 'upgrades'), 'utf8')).toBe(
        'upgrade\n',
      )
      expect(
        await fs.readFile(path.join(dataDir, 'settings-path'), 'utf8'),
      ).toBe(settingsDir)
    } finally {
      await stop(runtime)
    }
  })

  it('keeps read-only schema inspection available when an unknown archive prevents startup', async () => {
    const { runtime } = await setup('unknown')
    expect(runtime.getStatus().health).toBe('failed')
    await expect(runtime.archiveStatus()).resolves.toMatchObject({
      status: 'unsupported',
      canUpgrade: false,
      code: 'archive.schema_unsupported',
    })
  })

  it('preserves the verified backup and reports blocked when the backend cannot restart', async () => {
    const { runtime, dataDir } = await setup('restart-fail')
    try {
      await expect(runtime.upgradeArchive()).resolves.toEqual({
        status: 'blocked',
        code: 'archive.restart_failed',
        backupDirectory: path.join(dataDir, 'backup'),
      })
      expect(runtime.getStatus().health).toBe('failed')
    } finally {
      await stop(runtime)
    }
  })

  it('inspects a configured active archive without permitting the canonical-path upgrade', async () => {
    const { runtime, dataDir } = await setup('configured')
    try {
      const pid = runtime.getStatus().pid
      await expect(runtime.archiveStatus()).resolves.toMatchObject({
        status: 'upgradeRequired',
        canUpgrade: false,
        code: 'archive.configuration_unsupported',
      })
      await expect(runtime.upgradeArchive()).resolves.toEqual({
        status: 'blocked',
        code: 'archive.configuration_unsupported',
        backupDirectory: null,
      })
      expect(runtime.getStatus().pid).toBe(pid)
      await expect(fs.access(path.join(dataDir, 'upgrades'))).rejects.toThrow()
    } finally {
      await stop(runtime)
    }
  })

  it.each(['configured-unknown', 'configured-failure'])(
    'keeps %s fail-closed without guessing schema compatibility',
    async (mode) => {
      const { runtime } = await setup(mode)
      try {
        await expect(runtime.archiveStatus()).resolves.toMatchObject({
          status: 'unsupported',
          canUpgrade: false,
        })
      } finally {
        await stop(runtime)
      }
    },
  )

  it.each(['blocked', 'crash'])(
    'restores the old runtime after an upgrade is %s',
    async (mode) => {
      const { runtime } = await setup(mode)
      try {
        if (mode === 'blocked')
          await expect(runtime.upgradeArchive()).resolves.toMatchObject({
            status: 'blocked',
            code: 'archive.backup_failed',
          })
        else
          await expect(runtime.upgradeArchive()).rejects.toThrow(
            'did not finish safely',
          )
        expect(runtime.getStatus().health).toBe('ready')
        expect(await runtime.archiveStatus()).toMatchObject({
          status: 'upgradeRequired',
        })
      } finally {
        await stop(runtime)
      }
    },
  )
})
