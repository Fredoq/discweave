// @vitest-environment node

const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')

const { createBackendRuntime } = require('./backend-runtime.cjs')

describe('desktop backend runtime', () => {
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
