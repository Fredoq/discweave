// @vitest-environment node
const { registerDiscoverIpc } = require('./discover-ipc.cjs')
describe('Discover IPC trust boundary', () => {
  function setup() {
    const handlers = {}
    const frame = { url: 'http://127.0.0.1:1234/' }
    const sender = { mainFrame: frame }
    const broker = Object.fromEntries(
      ['status', 'save', 'remove', 'test', 'generate', 'cancel'].map((name) => [
        name,
        vi.fn().mockResolvedValue({ ok: true }),
      ]),
    )
    registerDiscoverIpc({
      ipcMain: {
        handle: (name, fn) => {
          handlers[name] = fn
        },
      },
      broker,
      trustedOrigin: () => 'http://127.0.0.1:1234',
      isOwnedSender: (value) => value === sender,
    })
    return { handlers, broker, event: { sender, senderFrame: frame } }
  }
  it('routes only narrow methods from the owned main frame', async () => {
    const { handlers, broker, event } = setup()
    expect(Object.keys(handlers)).toHaveLength(6)
    await handlers['discweave:discover:generate'](event, { mode: 'familiar' })
    expect(broker.generate).toHaveBeenCalledWith(event.sender, {
      mode: 'familiar',
    })
    await handlers['discweave:discover:save'](event, { apiKey: 'test-key' })
    expect(broker.save).toHaveBeenCalledWith({ apiKey: 'test-key' })
  })
  it.each(['foreign-frame', 'subframe', 'unknown-window', 'missing-frame'])(
    'rejects %s before touching the broker',
    async (kind) => {
      const { handlers, broker, event } = setup()
      if (kind === 'foreign-frame')
        event.senderFrame.url = 'https://malicious.example/'
      if (kind === 'subframe')
        event.senderFrame = { url: 'http://127.0.0.1:1234/' }
      if (kind === 'unknown-window')
        event.sender = { mainFrame: event.senderFrame }
      if (kind === 'missing-frame') event.senderFrame = undefined
      await expect(
        handlers['discweave:discover:status'](event),
      ).rejects.toThrow('trusted application window')
      expect(broker.status).not.toHaveBeenCalled()
    },
  )
})
