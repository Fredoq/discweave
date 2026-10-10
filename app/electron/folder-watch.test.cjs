// @vitest-environment node

const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { createFolderWatch } = require('./folder-watch.cjs')
const { scanFolder } = require('./scanner.cjs')

describe('desktop folder watch', () => {
  const tempRoots = []

  afterEach(async () => {
    vi.useRealTimers()
    await Promise.all(
      tempRoots
        .splice(0)
        .map((root) => fs.rm(root, { force: true, recursive: true })),
    )
  })

  async function createTempRoot() {
    const root = await fs.realpath(
      await fs.mkdtemp(path.join(os.tmpdir(), 'discweave-watch-')),
    )
    tempRoots.push(root)
    return root
  }

  function createWatch(root, overrides = {}) {
    const listeners = new Map()
    const closed = []
    const dependencies = {
      storePath: path.join(root, 'settings', 'watched.json'),
      scanFolder,
      manifestRoot: () => path.join(root, 'manifests'),
      confirmSourceRoot: vi.fn(async (sourceRoot) => sourceRoot),
      pickSourceRoot: vi.fn(async () => null),
      trustSourceRoot: vi.fn(),
      trustScan: vi.fn(),
      notifyChanged: vi.fn(),
      watchDirectory: (sourceRoot, _options, listener) => {
        listeners.set(sourceRoot, listener)
        return { close: () => closed.push(sourceRoot), on: () => {} }
      },
      debounceMs: 50,
      ...overrides,
    }
    return {
      closed,
      dependencies,
      listeners,
      watch: createFolderWatch(dependencies),
    }
  }

  it('watches a folder once by path and restores it after a restart', async () => {
    const root = await createTempRoot()
    const music = path.join(root, 'music')
    await fs.mkdir(music)
    const first = createWatch(root, {
      pickSourceRoot: vi.fn(async () => music),
    })

    const picked = await first.watch.add()
    await first.watch.update(music, {
      sessionId: 'session-1',
      newDraftIds: ['draft-1'],
      dismissed: { 'release-2': 'signature' },
    })
    const again = await first.watch.add({ sourceRoot: music })
    const restarted = createWatch(root)
    await restarted.watch.start()

    expect(picked).toMatchObject({ cancelled: false, sourceRoot: music })
    expect(first.dependencies.confirmSourceRoot).toHaveBeenCalledWith(music)
    expect(again.folders).toHaveLength(1)
    expect(await restarted.watch.list()).toEqual([
      {
        sourceRoot: music,
        sessionId: 'session-1',
        newDraftIds: ['draft-1'],
        dismissed: { 'release-2': 'signature' },
        lastCheckedAt: null,
      },
    ])
    expect(restarted.dependencies.trustSourceRoot).toHaveBeenCalledWith(music)
    expect(restarted.listeners.has(music)).toBe(true)

    expect(await restarted.watch.remove(music)).toEqual([])
    expect(restarted.closed).toEqual([music])
  })

  it('does not watch a folder when picking or confirming it is declined', async () => {
    const root = await createTempRoot()
    const { watch } = createWatch(root, {
      confirmSourceRoot: vi.fn().mockRejectedValue(new Error('cancelled')),
    })

    expect(await watch.add()).toEqual({ cancelled: true })
    await expect(watch.add({ sourceRoot: root })).rejects.toThrow('cancelled')
    expect(await watch.list()).toEqual([])
  })

  it('debounces live changes and ignores hidden files', async () => {
    const root = await createTempRoot()
    const { dependencies, listeners, watch } = createWatch(root)
    await watch.add({ sourceRoot: root })
    vi.useFakeTimers()

    listeners.get(root)('change', '.DS_Store')
    vi.advanceTimersByTime(100)
    expect(dependencies.notifyChanged).not.toHaveBeenCalled()

    listeners.get(root)('rename', 'Album/01.flac')
    listeners.get(root)('rename', 'Album/02.flac')
    vi.advanceTimersByTime(100)
    expect(dependencies.notifyChanged).toHaveBeenCalledTimes(1)
    expect(dependencies.notifyChanged).toHaveBeenCalledWith(root)
  })

  it('snapshots audio names and fully scans only the requested files', async () => {
    const root = await createTempRoot()
    const music = path.join(root, 'music')
    await fs.mkdir(path.join(music, 'Old'), { recursive: true })
    await fs.mkdir(path.join(music, 'New'), { recursive: true })
    await fs.writeFile(path.join(music, 'Old', '01.flac'), 'old audio')
    await fs.writeFile(path.join(music, 'Old', 'cover.jpg'), 'old cover')
    await fs.writeFile(path.join(music, 'New', '01.flac'), 'new audio')
    await fs.writeFile(path.join(music, 'New', 'cover.jpg'), 'new cover')
    const metadataReader = vi.fn().mockResolvedValue({ common: {}, format: {} })
    const { dependencies, watch } = createWatch(root, {
      scanFolder: (sourceRoot, options) =>
        scanFolder(sourceRoot, { ...options, metadataReader }),
    })
    await watch.add({ sourceRoot: music })

    const snapshot = await watch.snapshot(music)
    const scan = await watch.scanFiles(music, [
      path.join(music, 'New', '01.flac'),
      path.join(root, 'outside.flac'),
    ])

    expect(snapshot.files.map((file) => file.filePath).sort()).toEqual([
      path.join(music, 'New', '01.flac'),
      path.join(music, 'Old', '01.flac'),
    ])
    expect(scan.files.map((file) => file.relativePath).sort()).toEqual([
      path.join('New', '01.flac'),
      path.join('New', 'cover.jpg'),
    ])
    expect(
      scan.files.every((file) => file.format === null || file.contentHash),
    ).toBeTruthy()
    expect(metadataReader).toHaveBeenCalledTimes(1)
    expect(dependencies.trustScan).toHaveBeenCalledWith(scan)
    await expect(watch.snapshot(root)).rejects.toThrow(
      'Import folder is not watched.',
    )
  })
})
