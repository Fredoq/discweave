// @vitest-environment node

const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { createImportScanAccess } = require('./import-scan-access.cjs')

describe('desktop import scan access', () => {
  const tempRoots = []

  afterEach(async () => {
    await Promise.all(
      tempRoots.splice(0).map((root) =>
        fs.rm(root, {
          force: true,
          recursive: true,
        }),
      ),
    )
  })

  async function createTempRoot() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'discweave-access-'))
    tempRoots.push(root)
    return root
  }

  it('does not scan an untrusted rescan source when folder confirmation is cancelled', async () => {
    const scanFolder = vi.fn()
    const showOpenDialog = vi
      .fn()
      .mockResolvedValue({ canceled: true, filePaths: [] })
    const access = createImportScanAccess({
      dialog: { showOpenDialog },
      manifestRoot: () => '/app/scan-manifests',
      scanFolder,
    })

    await expect(
      access.rescanSource('/Users/example/Music', { mode: 'full' }),
    ).rejects.toThrow('Source folder confirmation cancelled.')

    expect(showOpenDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: '/Users/example/Music',
        properties: ['openDirectory'],
      }),
    )
    expect(scanFolder).not.toHaveBeenCalled()
  })

  it('rescans a source selected through the native picker without prompting again', async () => {
    const scanFolder = vi
      .fn()
      .mockResolvedValueOnce({ sourceRoot: '/Users/example/Music', files: [] })
      .mockResolvedValueOnce({ sourceRoot: '/Users/example/Music', files: [] })
    const showOpenDialog = vi.fn().mockResolvedValue({
      canceled: false,
      filePaths: ['/Users/example/Music'],
    })
    const access = createImportScanAccess({
      dialog: { showOpenDialog },
      manifestRoot: () => '/app/scan-manifests',
      scanFolder,
    })

    await expect(access.pickAndScan({ mode: 'full' })).resolves.toEqual({
      cancelled: false,
      scan: { sourceRoot: '/Users/example/Music', files: [] },
    })
    await expect(
      access.rescanSource('/Users/example/Music', { mode: 'namesOnly' }),
    ).resolves.toEqual({ sourceRoot: '/Users/example/Music', files: [] })

    expect(showOpenDialog).toHaveBeenCalledTimes(1)
    expect(scanFolder).toHaveBeenNthCalledWith(2, '/Users/example/Music', {
      manifestRoot: '/app/scan-manifests',
      mode: 'namesOnly',
    })
  })

  it('trusts exact file paths captured by the native scan flow', async () => {
    const scanFolder = vi.fn().mockResolvedValue({
      sourceRoot: '/Users/example/Music',
      files: [{ filePath: '/Users/example/Music/01 Track.flac' }],
    })
    const showOpenDialog = vi.fn().mockResolvedValue({
      canceled: false,
      filePaths: ['/Users/example/Music'],
    })
    const access = createImportScanAccess({
      dialog: { showOpenDialog },
      manifestRoot: () => '/app/scan-manifests',
      scanFolder,
    })

    await access.pickAndScan({ mode: 'full' })

    await expect(
      access.isTrustedFilePath('/Users/example/Music/01 Track.flac'),
    ).resolves.toBe(true)
    await expect(
      access.isTrustedFilePath('/Users/example/Music/02 Other.flac'),
    ).resolves.toBe(false)
  })

  it('trusts persisted full-scan manifest entries when file stats still match', async () => {
    const root = await createTempRoot()
    const manifestRoot = await createTempRoot()
    const audioPath = path.join(root, 'release', '01 Track.flac')
    const mtime = new Date('2026-07-02T10:00:00Z')
    await fs.mkdir(path.dirname(audioPath), { recursive: true })
    await fs.writeFile(audioPath, Buffer.from('audio bytes'))
    await fs.utimes(audioPath, mtime, mtime)
    await fs.writeFile(
      path.join(manifestRoot, 'manifest.json'),
      `${JSON.stringify({
        scannerVersion: 1,
        sourceRoot: root,
        scanMode: 'full',
        files: {
          'release/01 Track.flac': {
            relativePath: path.join('release', '01 Track.flac'),
            format: 'flac',
            sizeBytes: 'audio bytes'.length,
            lastModifiedAt: mtime.toISOString(),
            contentHash: sha256Content('audio bytes'),
            audioMetadata: { title: 'Track' },
          },
        },
      })}\n`,
    )
    const access = createImportScanAccess({
      dialog: { showOpenDialog: vi.fn() },
      manifestRoot: () => manifestRoot,
      scanFolder: vi.fn(),
    })

    await expect(access.isTrustedFilePath(audioPath)).resolves.toBe(true)
    await expect(
      access.isTrustedFilePath(path.join(root, 'release', '02 Other.flac')),
    ).resolves.toBe(false)
  })

  it('does not trust persisted manifest entries when the file content hash changed', async () => {
    const root = await createTempRoot()
    const manifestRoot = await createTempRoot()
    const audioPath = path.join(root, 'release', '01 Track.flac')
    const mtime = new Date('2026-07-02T10:00:00Z')
    await fs.mkdir(path.dirname(audioPath), { recursive: true })
    await fs.writeFile(audioPath, Buffer.from('other bytes'))
    await fs.utimes(audioPath, mtime, mtime)
    await fs.writeFile(
      path.join(manifestRoot, 'manifest.json'),
      `${JSON.stringify({
        scannerVersion: 1,
        sourceRoot: root,
        scanMode: 'full',
        files: {
          'release/01 Track.flac': {
            relativePath: path.join('release', '01 Track.flac'),
            format: 'flac',
            sizeBytes: 'audio bytes'.length,
            lastModifiedAt: mtime.toISOString(),
            contentHash: sha256Content('audio bytes'),
            audioMetadata: { title: 'Track' },
          },
        },
      })}\n`,
    )
    const access = createImportScanAccess({
      dialog: { showOpenDialog: vi.fn() },
      manifestRoot: () => manifestRoot,
      scanFolder: vi.fn(),
    })

    await expect(access.isTrustedFilePath(audioPath)).resolves.toBe(false)
  })

  it('rejects confirmation when the selected folder does not match the requested source', async () => {
    const scanFolder = vi.fn()
    const showOpenDialog = vi.fn().mockResolvedValue({
      canceled: false,
      filePaths: ['/Users/example/Other'],
    })
    const access = createImportScanAccess({
      dialog: { showOpenDialog },
      manifestRoot: () => '/app/scan-manifests',
      scanFolder,
    })

    await expect(
      access.rescanSource('/Users/example/Music', { mode: 'full' }),
    ).rejects.toThrow('Selected folder must match the original import source.')

    expect(scanFolder).not.toHaveBeenCalled()
  })
})

function sha256Content(content) {
  return crypto.createHash('sha256').update(content).digest('hex')
}
