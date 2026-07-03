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

  it('exposes only the discweaveDesktop bridge and routes imports and exports over IPC', async () => {
    const exposeInMainWorld = vi.fn()
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({ health: 'ready' })
      .mockResolvedValueOnce({ cancelled: true })
      .mockResolvedValueOnce({ sourceRoot: '/music', files: [] })
      .mockResolvedValueOnce({ cancelled: false, path: '/tmp/export.json' })
      .mockResolvedValueOnce({ path: '/music/track.flac' })
      .mockResolvedValueOnce({ ok: true, changes: [] })
      .mockResolvedValueOnce({ applied: true, files: [] })
      .mockResolvedValueOnce({ ok: true, path: '/music/track.flac' })

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
    expect(bridgeName).toBe('discweaveDesktop')
    expect(Object.keys(bridge).sort()).toEqual([
      'backend',
      'exports',
      'imports',
      'isDesktop',
      'localEdits',
      'localFiles',
    ])
    expect(Object.keys(bridge.backend)).toEqual(['status'])
    expect(Object.keys(bridge.imports).sort()).toEqual([
      'pickAndScan',
      'rescanSource',
    ])
    expect(Object.keys(bridge.exports)).toEqual(['download'])
    expect(Object.keys(bridge.localEdits)).toEqual([
      'inspect',
      'preview',
      'apply',
    ])
    expect(Object.keys(bridge.localFiles)).toEqual(['open'])

    await expect(bridge.backend.status()).resolves.toEqual({ health: 'ready' })
    await expect(
      bridge.imports.pickAndScan({ mode: 'namesOnly' }),
    ).resolves.toEqual({
      cancelled: true,
    })
    await expect(
      bridge.imports.rescanSource('/music', { mode: 'full' }),
    ).resolves.toEqual({
      sourceRoot: '/music',
      files: [],
    })
    await expect(bridge.exports.download('json')).resolves.toEqual({
      cancelled: false,
      path: '/tmp/export.json',
    })
    await expect(
      bridge.localEdits.inspect({
        localAudioFileId: 'owned-track',
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
    await expect(
      bridge.localFiles.open({
        digitalTrackFileLinkId: 'owned-track-link',
        localAudioFileId: 'owned-track',
        path: '/music/track.flac',
      }),
    ).resolves.toEqual({
      ok: true,
      path: '/music/track.flac',
    })
    expect(invoke).toHaveBeenNthCalledWith(1, 'discweave:backend:status')
    expect(invoke).toHaveBeenNthCalledWith(
      2,
      'discweave:imports:pick-and-scan',
      { mode: 'namesOnly' },
    )
    expect(invoke).toHaveBeenNthCalledWith(
      3,
      'discweave:imports:rescan-source',
      '/music',
      { mode: 'full' },
    )
    expect(invoke).toHaveBeenNthCalledWith(
      4,
      'discweave:exports:download',
      'json',
    )
    expect(invoke).toHaveBeenNthCalledWith(5, 'discweave:local-edits:inspect', {
      localAudioFileId: 'owned-track',
      path: '/music/track.flac',
    })
    expect(invoke).toHaveBeenNthCalledWith(6, 'discweave:local-edits:preview', {
      files: [],
    })
    expect(invoke).toHaveBeenNthCalledWith(7, 'discweave:local-edits:apply', {
      files: [],
    })
    expect(invoke).toHaveBeenNthCalledWith(8, 'discweave:local-files:open', {
      digitalTrackFileLinkId: 'owned-track-link',
      localAudioFileId: 'owned-track',
      path: '/music/track.flac',
    })
  })
})
