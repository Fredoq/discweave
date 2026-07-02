// @vitest-environment node

const { createLocalFileOpenHandler } = require('./local-file-open.cjs')

function handlerWith({ stat, openPath }) {
  return createLocalFileOpenHandler({
    fs: { stat },
    shell: { openPath },
  })
}

describe('local file open handler', () => {
  it('rejects empty, relative, and URL paths', async () => {
    const stat = vi.fn()
    const openPath = vi.fn()
    const handler = handlerWith({ stat, openPath })

    await expect(handler(null, '')).resolves.toEqual({
      ok: false,
      reason: 'invalid-path',
      message: 'A valid absolute local file path is required.',
    })
    await expect(handler(null, 'relative/song.flac')).resolves.toEqual({
      ok: false,
      reason: 'invalid-path',
      message: 'A valid absolute local file path is required.',
    })
    await expect(handler(null, 'file:///tmp/song.flac')).resolves.toEqual({
      ok: false,
      reason: 'invalid-path',
      message: 'A valid absolute local file path is required.',
    })
    await expect(handler(null, '//example.test/song.flac')).resolves.toEqual({
      ok: false,
      reason: 'invalid-path',
      message: 'A valid absolute local file path is required.',
    })

    expect(stat).not.toHaveBeenCalled()
    expect(openPath).not.toHaveBeenCalled()
  })

  it('reports missing files', async () => {
    const stat = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }))
    const openPath = vi.fn()
    const handler = handlerWith({ stat, openPath })

    await expect(handler(null, '/music/missing.flac')).resolves.toEqual({
      ok: false,
      path: '/music/missing.flac',
      reason: 'missing',
      message: 'The local file does not exist.',
    })
    expect(openPath).not.toHaveBeenCalled()
  })

  it('rejects directories', async () => {
    const stat = vi.fn().mockResolvedValue({ isFile: () => false })
    const openPath = vi.fn()
    const handler = handlerWith({ stat, openPath })

    await expect(handler(null, '/music/folder')).resolves.toEqual({
      ok: false,
      path: '/music/folder',
      reason: 'not-file',
      message: 'The local path is not a file.',
    })
    expect(openPath).not.toHaveBeenCalled()
  })

  it('reports shell failures', async () => {
    const stat = vi.fn().mockResolvedValue({ isFile: () => true })
    const openPath = vi
      .fn()
      .mockResolvedValue('No application is associated with this file.')
    const handler = handlerWith({ stat, openPath })

    await expect(handler(null, '/music/song.flac')).resolves.toEqual({
      ok: false,
      path: '/music/song.flac',
      reason: 'system-error',
      message: 'No application is associated with this file.',
    })
  })

  it('opens one verified file path', async () => {
    const stat = vi.fn().mockResolvedValue({ isFile: () => true })
    const openPath = vi.fn().mockResolvedValue('')
    const handler = handlerWith({ stat, openPath })

    await expect(handler(null, '/music/song.flac')).resolves.toEqual({
      ok: true,
      path: '/music/song.flac',
    })
    expect(stat).toHaveBeenCalledWith('/music/song.flac')
    expect(openPath).toHaveBeenCalledWith('/music/song.flac')
  })
})
