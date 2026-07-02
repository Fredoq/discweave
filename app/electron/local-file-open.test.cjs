// @vitest-environment node

const { createLocalFileOpenHandler } = require('./local-file-open.cjs')

function handlerWith({ resolveTrustedFile, stat, openPath }) {
  return createLocalFileOpenHandler({
    fs: { stat },
    resolveTrustedFile,
    shell: { openPath },
  })
}

describe('local file open handler', () => {
  it('rejects empty, relative, and URL paths', async () => {
    const stat = vi.fn()
    const openPath = vi.fn()
    const handler = handlerWith({ stat, openPath })

    await expect(
      handler(null, { localAudioFileId: 'local-a', path: '' }),
    ).resolves.toEqual({
      ok: false,
      reason: 'invalid-path',
      message: 'A valid absolute local file path is required.',
    })
    await expect(
      handler(null, {
        localAudioFileId: 'local-a',
        path: 'relative/song.flac',
      }),
    ).resolves.toEqual({
      ok: false,
      reason: 'invalid-path',
      message: 'A valid absolute local file path is required.',
    })
    await expect(
      handler(null, {
        localAudioFileId: 'local-a',
        path: 'file:///tmp/song.flac',
      }),
    ).resolves.toEqual({
      ok: false,
      reason: 'invalid-path',
      message: 'A valid absolute local file path is required.',
    })
    await expect(
      handler(null, {
        localAudioFileId: 'local-a',
        path: '//example.test/song.flac',
      }),
    ).resolves.toEqual({
      ok: false,
      reason: 'invalid-path',
      message: 'A valid absolute local file path is required.',
    })

    expect(stat).not.toHaveBeenCalled()
    expect(openPath).not.toHaveBeenCalled()
  })

  it('rejects paths that do not match the trusted catalog file', async () => {
    const stat = vi.fn()
    const openPath = vi.fn()
    const resolveTrustedFile = vi.fn().mockResolvedValue({
      localAudioFileId: 'local-a',
      path: '/music/trusted.flac',
    })
    const handler = handlerWith({ resolveTrustedFile, stat, openPath })

    await expect(
      handler(null, {
        localAudioFileId: 'local-a',
        path: '/music/other.flac',
      }),
    ).resolves.toEqual({
      ok: false,
      path: '/music/other.flac',
      reason: 'invalid-path',
      message: 'Local file open is not allowed for this file.',
    })
    expect(resolveTrustedFile).toHaveBeenCalledWith(null, 'local-a')
    expect(stat).not.toHaveBeenCalled()
    expect(openPath).not.toHaveBeenCalled()
  })

  it('reports missing files', async () => {
    const stat = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('missing'), { code: 'ENOENT' }),
      )
    const openPath = vi.fn()
    const resolveTrustedFile = vi.fn().mockResolvedValue({
      localAudioFileId: 'local-a',
      path: '/music/missing.flac',
    })
    const handler = handlerWith({ resolveTrustedFile, stat, openPath })

    await expect(
      handler(null, {
        localAudioFileId: 'local-a',
        path: '/music/missing.flac',
      }),
    ).resolves.toEqual({
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
    const resolveTrustedFile = vi.fn().mockResolvedValue({
      localAudioFileId: 'local-a',
      path: '/music/folder',
    })
    const handler = handlerWith({ resolveTrustedFile, stat, openPath })

    await expect(
      handler(null, { localAudioFileId: 'local-a', path: '/music/folder' }),
    ).resolves.toEqual({
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
    const resolveTrustedFile = vi.fn().mockResolvedValue({
      localAudioFileId: 'local-a',
      path: '/music/song.flac',
    })
    const handler = handlerWith({ resolveTrustedFile, stat, openPath })

    await expect(
      handler(null, { localAudioFileId: 'local-a', path: '/music/song.flac' }),
    ).resolves.toEqual({
      ok: false,
      path: '/music/song.flac',
      reason: 'system-error',
      message: 'No application is associated with this file.',
    })
  })

  it('opens one trusted catalog file path', async () => {
    const stat = vi.fn().mockResolvedValue({ isFile: () => true })
    const openPath = vi.fn().mockResolvedValue('')
    const resolveTrustedFile = vi.fn().mockResolvedValue({
      localAudioFileId: 'local-a',
      path: '/music/song.flac',
    })
    const handler = handlerWith({ resolveTrustedFile, stat, openPath })

    await expect(
      handler(null, { localAudioFileId: 'local-a', path: '/music/song.flac' }),
    ).resolves.toEqual({
      ok: true,
      path: '/music/song.flac',
    })
    expect(resolveTrustedFile).toHaveBeenCalledWith(null, 'local-a')
    expect(stat).toHaveBeenCalledWith('/music/song.flac')
    expect(openPath).toHaveBeenCalledWith('/music/song.flac')
  })
})
