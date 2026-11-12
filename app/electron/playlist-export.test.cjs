// @vitest-environment node
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const {
  createPlaylistExportHandlers,
  registerPlaylistExportIpc,
  encodeM3u8,
} = require('./playlist-export.cjs')

function entry(key = 'one', filePath = '/music/Трек #1.flac') {
  return {
    key,
    trackId: 'track',
    title: 'Title\n#injected',
    artist: 'Artist',
    duration: '3:04',
    file: {
      path: filePath,
      localAudioFileId: 'audio',
      digitalTrackFileLinkId: 'link',
    },
  }
}
function setup(options = {}) {
  const event = { sender: { id: 1 } }
  const source = entry()
  const mockFs = {
    lstat: vi.fn().mockResolvedValue({
      isFile: () => true,
      isSymbolicLink: () => false,
      dev: 1,
      ino: 2,
      size: 42,
      mtimeMs: 100,
    }),
    access: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
  }
  const dialog = {
    showSaveDialog: vi
      .fn()
      .mockResolvedValue({ canceled: false, filePath: '/exports/list.m3u8' }),
  }
  const dependencies = {
    fs: mockFs,
    dialog,
    validateSender: vi.fn(),
    resolveTrack: vi.fn().mockResolvedValue({ digitalFiles: [source.file] }),
    resolveTrustedFile: vi.fn().mockResolvedValue({ path: source.file.path }),
    isTrustedFile: vi.fn().mockResolvedValue(true),
    ...options,
  }
  return {
    event,
    dependencies,
    handlers: createPlaylistExportHandlers(dependencies),
    entries: [source],
  }
}
async function inspectedExport(s, patch = {}) {
  const plan = await s.handlers.inspect(s.event, { entries: s.entries })
  return s.handlers.export(s.event, {
    name: 'Night/Selection',
    entries: s.entries,
    allowPartial: false,
    inspectionId: plan.inspectionId,
    ...patch,
  })
}

describe('desktop playlist export', () => {
  it('writes UTF8 file URLs in exact order including repeated occurrences', async () => {
    const s = setup()
    s.entries.push({ ...entry('two') })
    const result = await inspectedExport(s)
    expect(result).toMatchObject({
      cancelled: false,
      exportedCount: 2,
      omittedCount: 0,
    })
    const [temporary, content, options] =
      s.dependencies.fs.writeFile.mock.calls[0]
    expect(temporary).toMatch(/^\/exports\/\.discweave-playlist-.+\.tmp$/)
    expect(options).toMatchObject({ encoding: 'utf8', flag: 'wx', mode: 0o600 })
    expect(content).toBe(
      '#EXTM3U\n#EXTINF:184,Artist - Title #injected\nfile:///music/%D0%A2%D1%80%D0%B5%D0%BA%20%231.flac\n#EXTINF:184,Artist - Title #injected\nfile:///music/%D0%A2%D1%80%D0%B5%D0%BA%20%231.flac\n',
    )
    expect(s.dependencies.fs.rename).toHaveBeenCalledWith(
      temporary,
      '/exports/list.m3u8',
    )
    expect(s.dependencies.dialog.showSaveDialog).toHaveBeenCalledWith(
      expect.objectContaining({ defaultPath: 'Night_Selection.m3u8' }),
    )
  })
  it.each([
    'https://host/track.flac',
    'file:///music/track.flac',
    '/music/a.flac\n/secret',
    '/music/a.flac\0secret',
    '/music/script.sh',
    'relative.flac',
  ])(
    'rejects unsafe or non-audio paths before filesystem access: %s',
    async (filePath) => {
      const s = setup()
      s.entries = [entry('one', filePath)]
      const result = await s.handlers.inspect(s.event, { entries: s.entries })
      expect(result.entries[0].status).toBe('unsupported')
      expect(s.dependencies.fs.lstat).not.toHaveBeenCalled()
    },
  )
  it('requires file linkage to the requested track and current catalog path', async () => {
    const s = setup({
      resolveTrack: vi.fn().mockResolvedValue({ digitalFiles: [] }),
    })
    expect(
      (await s.handlers.inspect(s.event, { entries: s.entries })).entries[0]
        .status,
    ).toBe('untrusted')
    expect(s.dependencies.fs.lstat).not.toHaveBeenCalled()
    s.dependencies.resolveTrack.mockResolvedValue({
      digitalFiles: [entry().file],
    })
    s.dependencies.resolveTrustedFile.mockResolvedValue({
      path: '/different.flac',
    })
    expect(
      (await s.handlers.inspect(s.event, { entries: s.entries })).entries[0]
        .status,
    ).toBe('untrusted')
  })
  it('fails closed without local file trust', async () => {
    const s = setup({ isTrustedFile: undefined })
    expect(
      (await s.handlers.inspect(s.event, { entries: s.entries })).entries[0]
        .status,
    ).toBe('untrusted')
    expect(s.dependencies.fs.lstat).not.toHaveBeenCalled()
  })
  it('blocks symlinks and directories and reports missing files', async () => {
    const s = setup()
    s.dependencies.fs.lstat.mockResolvedValue({
      isFile: () => false,
      isSymbolicLink: () => true,
    })
    expect(
      (await s.handlers.inspect(s.event, { entries: s.entries })).entries[0]
        .status,
    ).toBe('unsupported')
    s.dependencies.fs.lstat.mockRejectedValue(new Error('ENOENT'))
    expect(
      (await s.handlers.inspect(s.event, { entries: s.entries })).entries[0]
        .status,
    ).toBe('missing')
  })
  it('requires explicit omission consent, and never exports an empty playlist', async () => {
    const s = setup()
    s.entries.push({ ...entry('missing'), file: undefined })
    expect(await inspectedExport(s)).toMatchObject({
      blocked: true,
      availableCount: 1,
    })
    expect(s.dependencies.dialog.showSaveDialog).not.toHaveBeenCalled()
    expect(await inspectedExport(s, { allowPartial: true })).toMatchObject({
      exportedCount: 1,
      omittedCount: 1,
    })
    s.entries = [{ ...entry('missing'), file: undefined }]
    expect(await inspectedExport(s, { allowPartial: true })).toMatchObject({
      blocked: true,
      availableCount: 0,
    })
  })
  it('rechecks changes before and after the native dialog, without writing or silently omitting', async () => {
    const s = setup()
    const plan = await s.handlers.inspect(s.event, { entries: s.entries })
    s.dependencies.fs.lstat.mockRejectedValue(new Error('gone'))
    const result = await s.handlers.export(s.event, {
      entries: s.entries,
      inspectionId: plan.inspectionId,
      allowPartial: true,
    })
    expect(result).toMatchObject({ blocked: true, availableCount: 0 })
    expect(result.inspectionId).not.toBe(plan.inspectionId)
    expect(s.dependencies.dialog.showSaveDialog).not.toHaveBeenCalled()
    const s2 = setup()
    s2.dependencies.dialog.showSaveDialog.mockImplementation(async () => {
      s2.dependencies.fs.lstat.mockRejectedValue(new Error('gone'))
      return { canceled: false, filePath: '/exports/list.m3u8' }
    })
    expect(await inspectedExport(s2)).toMatchObject({ blocked: true })
    expect(s2.dependencies.fs.writeFile).not.toHaveBeenCalled()
  })
  it('rejects stale or altered inspection tokens and duplicate keys', async () => {
    const s = setup()
    const plan = await s.handlers.inspect(s.event, { entries: s.entries })
    const other = { sender: { id: 2 } }
    expect(
      await s.handlers.export(other, {
        entries: s.entries,
        inspectionId: plan.inspectionId,
      }),
    ).toMatchObject({ blocked: true })
    s.entries[0].title = 'Changed'
    expect(
      await s.handlers.export(s.event, {
        entries: s.entries,
        inspectionId: plan.inspectionId,
      }),
    ).toMatchObject({ blocked: true })
    await expect(
      s.handlers.inspect(s.event, { entries: [entry(), entry()] }),
    ).rejects.toThrow('Invalid playlist entry')
    expect(s.dependencies.fs.writeFile).not.toHaveBeenCalled()
  })
  it('cancels without writing and rejects non-playlist output paths', async () => {
    const s = setup()
    s.dependencies.dialog.showSaveDialog.mockResolvedValue({ canceled: true })
    expect(await inspectedExport(s)).toEqual({ cancelled: true })
    expect(s.dependencies.fs.writeFile).not.toHaveBeenCalled()
    s.dependencies.dialog.showSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: entry().file.path,
    })
    await expect(inspectedExport(s)).rejects.toThrow(
      'Audio files are never overwritten',
    )
    expect(s.dependencies.fs.writeFile).not.toHaveBeenCalled()
  })
  it('does not launch a player or modify source audio when replacing a destination symlink', async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), 'discweave-playlist-test-'),
    )
    try {
      const audio = path.join(root, 'audio.flac')
      const output = path.join(root, 'list.m3u8')
      await fs.writeFile(audio, 'synthetic audio fixture')
      await fs.symlink(audio, output)
      const source = entry('one', audio)
      const s = setup({
        fs,
        resolveTrack: async () => ({ digitalFiles: [source.file] }),
        resolveTrustedFile: async () => ({ path: audio }),
        dialog: {
          showSaveDialog: async () => ({ canceled: false, filePath: output }),
        },
      })
      s.entries = [source]
      await inspectedExport(s)
      expect(await fs.readFile(audio, 'utf8')).toBe('synthetic audio fixture')
      expect((await fs.lstat(output)).isSymbolicLink()).toBe(false)
      expect(await fs.readFile(output, 'utf8')).toContain('#EXTM3U')
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })
  it('rejects child frames and unowned senders at both IPC endpoints', async () => {
    const callbacks = {}
    const handlers = { inspect: vi.fn(), export: vi.fn() }
    const sender = { mainFrame: { url: 'http://localhost:5199' } }
    registerPlaylistExportIpc({
      ipcMain: {
        handle: (name, callback) => {
          callbacks[name] = callback
        },
      },
      handlers,
      trustedOrigin: () => 'http://localhost:5199',
      isOwnedSender: (value) => value === sender,
    })
    for (const callback of Object.values(callbacks)) {
      await expect(
        callback({ sender, senderFrame: { url: 'http://localhost:5199' } }, {}),
      ).rejects.toThrow('trusted application window')
      await expect(
        callback({ sender: {}, senderFrame: sender.mainFrame }, {}),
      ).rejects.toThrow('trusted application window')
    }
    await callbacks['discweave:playlists:inspect'](
      { sender, senderFrame: sender.mainFrame },
      { entries: [] },
    )
    expect(handlers.inspect).toHaveBeenCalledTimes(1)
  })
  it('expires inspection consent without opening a save dialog', async () => {
    let clock = 0
    const s = setup({ now: () => clock })
    const plan = await s.handlers.inspect(s.event, { entries: s.entries })
    clock = 300001
    expect(
      await s.handlers.export(s.event, {
        entries: s.entries,
        inspectionId: plan.inspectionId,
        allowPartial: true,
      }),
    ).toMatchObject({ blocked: true })
    expect(s.dependencies.dialog.showSaveDialog).not.toHaveBeenCalled()
  })
  it('blocks simultaneous export dialogs and allows retry after cancellation', async () => {
    const s = setup()
    let finishDialog
    s.dependencies.dialog.showSaveDialog.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishDialog = resolve
        }),
    )
    const plan = await s.handlers.inspect(s.event, { entries: s.entries })
    const request = {
      name: 'Demo',
      entries: s.entries,
      inspectionId: plan.inspectionId,
      allowPartial: false,
    }
    const first = s.handlers.export(s.event, request)
    await vi.waitFor(() => expect(finishDialog).toBeTypeOf('function'))
    await expect(s.handlers.export(s.event, request)).rejects.toThrow(
      'already in progress',
    )
    finishDialog({ canceled: true })
    expect(await first).toEqual({ cancelled: true })
    s.dependencies.dialog.showSaveDialog.mockResolvedValue({ canceled: true })
    expect(await s.handlers.export(s.event, request)).toEqual({
      cancelled: true,
    })
  })
  it('does not replace a destination when writing the temporary file fails', async () => {
    const s = setup()
    s.dependencies.fs.writeFile.mockRejectedValue(new Error('Disk full'))
    await expect(inspectedExport(s)).rejects.toThrow('Disk full')
    expect(s.dependencies.fs.rename).not.toHaveBeenCalled()
    expect(s.dependencies.fs.unlink).toHaveBeenCalledTimes(1)
  })
  it('bounds concurrent file checks and preserves occurrence order despite reversed completion', async () => {
    const entries = Array.from({ length: 12 }, (_, index) => ({
      ...entry(`row-${index}`, `/music/track-${index}.flac`),
      file: {
        path: `/music/track-${index}.flac`,
        localAudioFileId: `audio-${index}`,
        digitalTrackFileLinkId: `link-${index}`,
      },
    }))
    entries.push({ ...entries[0], key: 'repeated-first' })
    let active = 0
    let peak = 0
    const completed = []
    const waiters = []
    const s = setup({
      resolveTrack: vi
        .fn()
        .mockResolvedValue({ digitalFiles: entries.map((item) => item.file) }),
      resolveTrustedFile: vi.fn(async (_event, id) => ({
        path: `/music/track-${id.slice(6)}.flac`,
      })),
      isTrustedFile: vi.fn(
        ({ path: filePath }) =>
          new Promise((resolve) => {
            active += 1
            peak = Math.max(peak, active)
            waiters.push(() => {
              active -= 1
              completed.push(filePath)
              resolve(true)
            })
          }),
      ),
    })
    const inspection = s.handlers.inspect(s.event, { entries })
    // Finish each batch in reverse to prove result order is not completion order.
    for (let batch = 0; batch < 3; batch += 1) {
      await vi.waitFor(() => expect(waiters).toHaveLength(4))
      waiters
        .splice(0)
        .reverse()
        .forEach((finish) => finish())
    }
    const result = await inspection
    expect(peak).toBe(4)
    expect(active).toBe(0)
    expect(completed[0]).toBe('/music/track-3.flac')
    expect(result.entries.map((item) => item.key)).toEqual(
      entries.map((item) => item.key),
    )
    expect(result.availableCount).toBe(13)
    expect(s.dependencies.isTrustedFile).toHaveBeenCalledTimes(12)
    expect(s.dependencies.resolveTrack).toHaveBeenCalledTimes(1)
    expect(s.dependencies.resolveTrustedFile).toHaveBeenCalledTimes(12)
  })
  it('shares an in-flight local-file lookup between distinct links to the same audio file', async () => {
    const first = entry('first')
    const second = {
      ...entry('second'),
      file: { ...first.file, digitalTrackFileLinkId: 'another-link' },
    }
    const s = setup({
      resolveTrack: vi
        .fn()
        .mockResolvedValue({ digitalFiles: [first.file, second.file] }),
    })
    const inspection = await s.handlers.inspect(s.event, {
      entries: [first, second],
    })
    expect(inspection.availableCount).toBe(2)
    expect(s.dependencies.resolveTrack).toHaveBeenCalledTimes(1)
    expect(s.dependencies.resolveTrustedFile).toHaveBeenCalledTimes(1)
  })
  it('sanitizes both slash directions in export names', async () => {
    const s = setup()
    const plan = await s.handlers.inspect(s.event, { entries: s.entries })
    await s.handlers.export(s.event, {
      name: 'Album/Side\\Track',
      entries: s.entries,
      inspectionId: plan.inspectionId,
      allowPartial: false,
    })
    expect(s.dependencies.dialog.showSaveDialog).toHaveBeenCalledWith(
      expect.objectContaining({ defaultPath: 'Album_Side_Track.m3u8' }),
    )
  })
  it('uses unknown duration rather than fabricating seconds', () => {
    expect(encodeM3u8([{ ...entry(), duration: 'Unknown' }])).toContain(
      '#EXTINF:-1,',
    )
  })
})
it('blocks expired consent after the save dialog without writing', async () => {
  let clock = 0
  const s = setup({ now: () => clock })
  const plan = await s.handlers.inspect(s.event, { entries: s.entries })
  s.dependencies.dialog.showSaveDialog.mockImplementation(async () => {
    clock = 300000
    return { canceled: false, filePath: '/exports/list.m3u8' }
  })
  const result = await s.handlers.export(s.event, {
    entries: s.entries,
    inspectionId: plan.inspectionId,
    allowPartial: true,
  })
  expect(result).toMatchObject({ blocked: true })
  expect(result.inspectionId).not.toBe(plan.inspectionId)
  expect(s.dependencies.fs.writeFile).not.toHaveBeenCalled()
})
it('bounds independent lookup operations even when transport ignores abort', async () => {
  const { withPlaylistLookupDeadline } = require('./playlist-export.cjs')
  vi.useFakeTimers()
  try {
    let signal
    const hung = withPlaylistLookupDeadline((value) => {
      signal = value
      return new Promise(() => {})
    }, 100)
    const rejection = expect(hung).rejects.toThrow('timed out')
    await Promise.resolve()
    await expect(
      withPlaylistLookupDeadline(async () => 'other result', 100),
    ).resolves.toBe('other result')
    await vi.advanceTimersByTimeAsync(100)
    await rejection
    expect(signal.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  } finally {
    vi.useRealTimers()
  }
})
it('includes delayed response body reads in the lookup deadline', async () => {
  const { withPlaylistLookupDeadline } = require('./playlist-export.cjs')
  vi.useFakeTimers()
  try {
    const pending = withPlaylistLookupDeadline(async () => {
      const response = { json: () => new Promise(() => {}) }
      return response.json()
    }, 100)
    const rejected = expect(pending).rejects.toThrow('timed out')
    await vi.advanceTimersByTimeAsync(100)
    await rejected
  } finally {
    vi.useRealTimers()
  }
})
it.each(['fetchPlaylistExportTrack', 'fetchTrustedLocalAudioFile'])(
  'passes private backend headers and an independent deadline to %s',
  async (name) => {
    const vm = require('node:vm')
    const source = await fs.readFile(path.join(__dirname, 'main.cjs'), 'utf8')
    const start = source.indexOf(`async function ${name}(`)
    const end = source.indexOf('\n}', start) + 2
    const { withPlaylistLookupDeadline } = require('./playlist-export.cjs')
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ path: '/music/test.flac' })),
    )
    const cookieStore = vi.fn()
    const lookup = vm.runInNewContext(`${source.slice(start, end)}; ${name}`, {
      withPlaylistLookupDeadline,
      URL,
      Headers,
      backendBaseUrl: 'http://localhost:1234',
      backendRuntime: {
        requestHeaders: () => ({ 'X-Backend-Token': 'synthetic-token' }),
      },
      currentExportCookieHeader: async () => 'session=synthetic',
      fetch: fetchMock,
      storeCookies: cookieStore,
      normalizedAbsolutePath: (value) => value,
    })
    await lookup({}, 'synthetic-id')
    const [url, options] = fetchMock.mock.calls[0]
    expect(url.origin).toBe('http://localhost:1234')
    expect(options.headers.get('X-Backend-Token')).toBe('synthetic-token')
    expect(options.headers.get('cookie')).toBe('session=synthetic')
    expect(options.redirect).toBe('manual')
    expect(options.signal).toBeInstanceOf(AbortSignal)
    expect(cookieStore).toHaveBeenCalledTimes(1)
  },
)
it('bounds the whole inspection and stops scheduling after four hung jobs', async () => {
  vi.useFakeTimers()
  try {
    const s = setup()
    const resolvers = []
    s.dependencies.resolveTrack.mockImplementation(
      () => new Promise((resolve) => resolvers.push(resolve)),
    )
    const entries = Array.from({ length: 12 }, (_, index) => ({
      ...entry(`row${index}`),
      trackId: `track${index}`,
    }))
    const pending = s.handlers.inspect(s.event, { entries })
    const rejected = expect(pending).rejects.toThrow(
      'Playlist inspection timed out',
    )
    await vi.advanceTimersByTimeAsync(60000)
    await rejected
    expect(s.dependencies.resolveTrack).toHaveBeenCalledTimes(4)
    for (const resolve of resolvers)
      resolve({ digitalFiles: [entries[0].file] })
    await vi.advanceTimersByTimeAsync(1)
    expect(s.dependencies.resolveTrack).toHaveBeenCalledTimes(4)
    expect(s.dependencies.resolveTrustedFile).not.toHaveBeenCalled()
    expect(s.dependencies.fs.writeFile).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  } finally {
    vi.useRealTimers()
  }
})
