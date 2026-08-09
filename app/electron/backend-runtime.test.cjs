// @vitest-environment node

const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')

const { createBackendRuntime } = require('./backend-runtime.cjs')

describe('desktop backend runtime', () => {
  it('starts a packaged backend from the executable directory', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'discweave-runtime-'))
    const executableDir = path.join(root, 'api')
    const executablePath = path.join(executableDir, 'fake-backend.cjs')
    const cwdOutputPath = path.join(root, 'backend-cwd.txt')
    await fs.mkdir(executableDir, { recursive: true })
    await fs.writeFile(
      executablePath,
      `#!/usr/bin/env node
const fs = require('node:fs')
const http = require('node:http')
const url = new URL(process.env.ASPNETCORE_URLS)
fs.writeFileSync(process.env.DISCWEAVE_TEST_CWD_OUTPUT, process.cwd())
const server = http.createServer((_request, response) => response.end('ok'))
server.listen(Number(url.port), url.hostname)
process.on('SIGTERM', () => server.close(() => process.exit(0)))
`,
    )
    await fs.chmod(executablePath, 0o755)

    const previousExecutable = process.env.DISCWEAVE_API_EXECUTABLE
    const previousCwdOutput = process.env.DISCWEAVE_TEST_CWD_OUTPUT
    process.env.DISCWEAVE_API_EXECUTABLE = executablePath
    process.env.DISCWEAVE_TEST_CWD_OUTPUT = cwdOutputPath
    let runtime
    try {
      runtime = await createBackendRuntime({
        isPackaged: true,
        getPath: vi.fn((name) => {
          if (name === 'appData') return root
          if (name === 'userData') return path.join(root, 'user-data')
          throw new Error(`Unsupported path: ${name}`)
        }),
      })

      const expectedCwd = await fs.realpath(executableDir)
      await expect(fs.readFile(cwdOutputPath, 'utf8')).resolves.toBe(
        expectedCwd,
      )
    } finally {
      runtime?.stop()
      restoreEnvironment('DISCWEAVE_API_EXECUTABLE', previousExecutable)
      restoreEnvironment('DISCWEAVE_TEST_CWD_OUTPUT', previousCwdOutput)
    }
  })

  it('copies legacy userData runtime data into the canonical appData directory', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'discweave-runtime-'))
    const appData = path.join(root, 'Application Support')
    const userData = path.join(appData, 'DiscWeave')
    const legacyDataDir = path.join(userData, 'DiscWeave')
    const canonicalDataDir = path.join(appData, 'DiscWeave')
    await fs.mkdir(path.join(legacyDataDir, 'artifacts', 'covers'), {
      recursive: true,
    })
    await fs.writeFile(path.join(legacyDataDir, 'discweave.sqlite'), 'db')
    await fs.writeFile(
      path.join(legacyDataDir, 'artifacts', 'covers', 'cover.bin'),
      'cover',
    )
    const app = {
      isPackaged: false,
      getPath: vi.fn((name) => {
        if (name === 'appData') {
          return appData
        }

        if (name === 'userData') {
          return userData
        }

        throw new Error(`Unsupported path: ${name}`)
      }),
    }

    const runtime = await createBackendRuntime(app)

    expect(runtime.getStatus().dataDir).toBe(canonicalDataDir)
    await expect(
      fs.readFile(path.join(canonicalDataDir, 'discweave.sqlite'), 'utf8'),
    ).resolves.toBe('db')
    await expect(
      fs.readFile(
        path.join(canonicalDataDir, 'artifacts', 'covers', 'cover.bin'),
        'utf8',
      ),
    ).resolves.toBe('cover')
  })
})

function restoreEnvironment(name, value) {
  if (value === undefined) {
    delete process.env[name]
    return
  }

  process.env[name] = value
}
