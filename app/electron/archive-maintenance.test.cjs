// @vitest-environment node
const {
  createArchiveMaintenance,
  registerArchiveIpc,
} = require('./archive-maintenance.cjs')

function deferred() {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('Archive maintenance gate', () => {
  it('blocks new work and waits for earlier work before upgrading', async () => {
    const gate = createArchiveMaintenance()
    const work = deferred()
    const running = gate.run(() => work.promise)
    const upgrade = vi.fn().mockResolvedValue({ status: 'upgraded' })
    const resume = vi.fn()
    const request = { pause: vi.fn(), upgrade, resume }
    const first = gate.exclusive(request)
    const repeated = gate.exclusive(request)
    expect(first).toBe(repeated)
    await expect(gate.run(() => null)).rejects.toMatchObject({
      code: 'archive.upgrading',
    })
    await Promise.resolve()
    expect(upgrade).not.toHaveBeenCalled()
    work.resolve()
    await running
    await expect(first).resolves.toEqual({ status: 'upgraded' })
    expect(upgrade).toHaveBeenCalledTimes(1)
    expect(resume).toHaveBeenCalledTimes(1)
    await expect(gate.run(() => 'working')).resolves.toBe('working')
  })

  it('closes watchers reopened by an active operation before starting the backup', async () => {
    const gate = createArchiveMaintenance()
    const scan = deferred()
    let watching = true
    const pending = gate.run(async () => {
      await scan.promise
      watching = true
    })
    const pause = vi.fn(() => {
      watching = false
    })
    const upgrade = vi.fn(() => {
      expect(watching).toBe(false)
      return { status: 'upgraded' }
    })
    const result = gate.exclusive({
      pause,
      upgrade,
      resume: () => {
        watching = true
      },
    })
    await Promise.resolve()
    expect(watching).toBe(false)
    scan.resolve()
    await pending
    await result
    expect(pause).toHaveBeenCalledTimes(2)
    expect(upgrade).toHaveBeenCalledTimes(1)
    expect(watching).toBe(true)
  })

  it('does not upgrade when existing work cannot be drained and resumes safe operation', async () => {
    const gate = createArchiveMaintenance({ timeoutMs: 5 })
    const work = deferred()
    const running = gate.run(() => work.promise)
    const upgrade = vi.fn()
    const resume = vi.fn()
    await expect(
      gate.exclusive({ pause: vi.fn(), upgrade, resume }),
    ).rejects.toThrow('not finished')
    expect(upgrade).not.toHaveBeenCalled()
    expect(resume).toHaveBeenCalledTimes(1)
    expect(gate.isBusy()).toBe(false)
    work.resolve()
    await running
  })

  it('preserves the verified backup if folder watching cannot resume', async () => {
    const gate = createArchiveMaintenance()
    await expect(
      gate.exclusive({
        pause: vi.fn(),
        upgrade: () =>
          Promise.resolve({
            status: 'upgraded',
            backupDirectory: '/backup',
            code: null,
          }),
        resume: () => Promise.reject(new Error('watcher failed')),
      }),
    ).resolves.toEqual({
      status: 'upgraded',
      backupDirectory: '/backup',
      code: 'archive.watches_paused',
    })
    expect(gate.isBusy()).toBe(false)
  })

  it('resumes and clears the gate after upgrade failure', async () => {
    const gate = createArchiveMaintenance()
    const resume = vi.fn()
    await expect(
      gate.exclusive({
        pause: vi.fn(),
        upgrade: () => Promise.reject(new Error('backup failed')),
        resume,
      }),
    ).rejects.toThrow('backup failed')
    expect(resume).toHaveBeenCalledTimes(1)
    expect(gate.isBusy()).toBe(false)
  })
})

describe('Archive IPC trust boundary', () => {
  function setup() {
    const handlers = {}
    const frame = { url: 'http://127.0.0.1:1234/' }
    const sender = { mainFrame: frame }
    const archive = {
      getStatus: vi.fn().mockResolvedValue({ status: 'current' }),
      backupAndUpgrade: vi.fn().mockResolvedValue({ status: 'upgraded' }),
    }
    registerArchiveIpc({
      ipcMain: {
        handle: (name, fn) => {
          handlers[name] = fn
        },
      },
      archive,
      trustedOrigin: () => 'http://127.0.0.1:1234',
      isOwnedSender: (value) => value === sender,
    })
    return { handlers, archive, event: { sender, senderFrame: frame } }
  }
  it('exposes only status and explicit upgrade without caller parameters', async () => {
    const { handlers, archive, event } = setup()
    expect(Object.keys(handlers)).toEqual([
      'discweave:archive:status',
      'discweave:archive:upgrade',
    ])
    await handlers['discweave:archive:status'](event)
    await handlers['discweave:archive:upgrade'](event)
    expect(archive.backupAndUpgrade).toHaveBeenCalledExactlyOnceWith()
  })
  it.each([
    'foreign-frame',
    'subframe',
    'unknown-window',
    'missing-frame',
    'path-argument',
  ])('rejects %s without touching the archive', async (kind) => {
    const { handlers, archive, event } = setup()
    if (kind === 'foreign-frame')
      event.senderFrame.url = 'https://foreign.example/'
    if (kind === 'subframe')
      event.senderFrame = { url: 'http://127.0.0.1:1234/' }
    if (kind === 'unknown-window')
      event.sender = { mainFrame: event.senderFrame }
    if (kind === 'missing-frame') event.senderFrame = null
    const args = kind === 'path-argument' ? ['/other/archive'] : []
    await expect(
      handlers['discweave:archive:upgrade'](event, ...args),
    ).rejects.toThrow('trusted application window')
    expect(archive.backupAndUpgrade).not.toHaveBeenCalled()
  })
})
