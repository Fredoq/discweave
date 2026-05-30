// @vitest-environment node

const Module = require('node:module')
const path = require('node:path')

const preloadPath = path.join(__dirname, 'preload.cjs')
const originalLoad = Module._load

describe('desktop preload contract', () => {
  afterEach(() => {
    Module._load = originalLoad
    delete require.cache[preloadPath]
  })

  it('exposes only the cratebaseDesktop bridge and routes imports and exports over IPC', async () => {
    const exposeInMainWorld = vi.fn()
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({ cancelled: true })
      .mockResolvedValueOnce({ cancelled: false, path: '/tmp/export.json' })
      .mockResolvedValueOnce({ path: '/music/track.flac' })
      .mockResolvedValueOnce({ ok: true, changes: [] })
      .mockResolvedValueOnce({ applied: true, files: [] })

    Module._load = function load(request, parent, isMain) {
      if (request === 'electron') {
        return {
          contextBridge: { exposeInMainWorld },
          ipcRenderer: { invoke },
        }
      }

      return originalLoad.call(this, request, parent, isMain)
    }

    require(preloadPath)

    expect(exposeInMainWorld).toHaveBeenCalledTimes(1)
    const [bridgeName, bridge] = exposeInMainWorld.mock.calls[0]
    expect(bridgeName).toBe('cratebaseDesktop')
    expect(Object.keys(bridge).sort()).toEqual([
      'exports',
      'imports',
      'isDesktop',
      'localEdits',
    ])
    expect(Object.keys(bridge.imports)).toEqual(['pickAndScan'])
    expect(Object.keys(bridge.exports)).toEqual(['download'])
    expect(Object.keys(bridge.localEdits)).toEqual([
      'inspect',
      'preview',
      'apply',
    ])

    await expect(
      bridge.imports.pickAndScan({ mode: 'namesOnly' }),
    ).resolves.toEqual({
      cancelled: true,
    })
    await expect(bridge.exports.download('json')).resolves.toEqual({
      cancelled: false,
      path: '/tmp/export.json',
    })
    await expect(
      bridge.localEdits.inspect({
        ownedItemId: 'owned-track',
        path: '/music/track.flac',
      }),
    ).resolves.toEqual({
      path: '/music/track.flac',
    })
    await expect(bridge.localEdits.preview({ files: [] })).resolves.toEqual({
      ok: true,
      changes: [],
    })
    await expect(bridge.localEdits.apply({ files: [] })).resolves.toEqual({
      applied: true,
      files: [],
    })
    expect(invoke).toHaveBeenNthCalledWith(
      1,
      'cratebase:imports:pick-and-scan',
      { mode: 'namesOnly' },
    )
    expect(invoke).toHaveBeenNthCalledWith(
      2,
      'cratebase:exports:download',
      'json',
    )
    expect(invoke).toHaveBeenNthCalledWith(3, 'cratebase:local-edits:inspect', {
      ownedItemId: 'owned-track',
      path: '/music/track.flac',
    })
    expect(invoke).toHaveBeenNthCalledWith(4, 'cratebase:local-edits:preview', {
      files: [],
    })
    expect(invoke).toHaveBeenNthCalledWith(5, 'cratebase:local-edits:apply', {
      files: [],
    })
  })
})
