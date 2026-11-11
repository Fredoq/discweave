// @vitest-environment node
const { EventEmitter } = require('node:events')
const { runArchiveCommand } = require('./archive-command.cjs')

function child() {
  const process = new EventEmitter()
  process.stdout = new EventEmitter()
  process.stderr = new EventEmitter()
  process.kill = vi.fn()
  return process
}
const executable = { command: '/application/api/DiscWeave.Api', args: [] }
const current = {
  status: 'current',
  upgradeId: 'label-import-links-v1',
  canUpgrade: false,
  code: null,
}

describe('Archive sidecar command', () => {
  it('uses only fixed commands and main-process archive locations', async () => {
    const process = child()
    const spawnProcess = vi.fn(() => process)
    const result = runArchiveCommand(
      executable,
      'status',
      '/archive',
      '/settings',
      { spawnProcess },
    )
    process.stdout.emit('data', JSON.stringify(current))
    process.emit('close', 0)
    await expect(result).resolves.toEqual(current)
    expect(spawnProcess).toHaveBeenCalledWith(
      '/application/api/DiscWeave.Api',
      ['--archive-status'],
      expect.objectContaining({
        env: expect.objectContaining({
          DISCWEAVE_DATA_DIR: '/archive',
          DISCWEAVE_DESKTOP_SETTINGS_DIR: '/settings',
        }),
      }),
    )
  })

  it('returns a blocked upgrade with its retained backup without exposing stderr', async () => {
    const process = child()
    const result = runArchiveCommand(
      executable,
      'upgrade',
      '/archive',
      '/settings',
      { spawnProcess: () => process },
    )
    const blocked = {
      status: 'blocked',
      code: 'archive.validation_failed',
      backupDirectory: '/backups/verified',
    }
    process.stderr.emit('data', 'private diagnostics')
    process.stdout.emit('data', JSON.stringify(blocked))
    process.emit('close', 1)
    await expect(result).resolves.toEqual(blocked)
  })

  it('does not settle a timeout until the killed command has exited', async () => {
    const process = child()
    const result = runArchiveCommand(
      executable,
      'upgrade',
      '/archive',
      '/settings',
      { spawnProcess: () => process, timeoutMs: 5 },
    )
    let settled = false
    const observed = result.catch((error) => {
      settled = true
      return error
    })
    await new Promise((resolve) => setTimeout(resolve, 15))
    expect(process.kill).toHaveBeenCalledWith('SIGKILL')
    expect(settled).toBe(false)
    process.emit('close', null)
    expect(await observed).toBeInstanceOf(Error)
  })

  it.each(['invalid-json', 'wrong-status', 'wrong-exit', 'relative-backup'])(
    'rejects %s instead of claiming success',
    async (kind) => {
      const process = child()
      const result = runArchiveCommand(
        executable,
        'upgrade',
        '/archive',
        '/settings',
        { spawnProcess: () => process },
      )
      const value = {
        status: kind === 'wrong-status' ? 'yes' : 'upgraded',
        code: null,
        backupDirectory: kind === 'relative-backup' ? 'backup' : '/backup',
      }
      process.stdout.emit(
        'data',
        kind === 'invalid-json' ? 'bad' : JSON.stringify(value),
      )
      process.emit('close', kind === 'wrong-exit' ? 1 : 0)
      await expect(result).rejects.toThrow('did not finish safely')
    },
  )
})
