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
    ])
    expect(Object.keys(bridge.imports)).toEqual(['pickAndScan'])
    expect(Object.keys(bridge.exports)).toEqual(['download'])

    await expect(bridge.imports.pickAndScan()).resolves.toEqual({
      cancelled: true,
    })
    await expect(bridge.exports.download('json')).resolves.toEqual({
      cancelled: false,
      path: '/tmp/export.json',
    })
    expect(invoke).toHaveBeenNthCalledWith(1, 'cratebase:imports:pick-and-scan')
    expect(invoke).toHaveBeenNthCalledWith(
      2,
      'cratebase:exports:download',
      'json',
    )
  })
})
