// @vitest-environment node
const {
  registerPlaylistSuggestionIpc,
} = require('./playlist-suggestion-ipc.cjs')
describe('Playlist suggestion IPC trust boundary', () => {
  function setup() {
    const handlers = {}
    const frame = { url: 'http://127.0.0.1:1234/' }
    const sender = { mainFrame: frame }
    const broker = Object.fromEntries(
      ['status', 'generate', 'cancel'].map((name) => [
        name,
        vi.fn().mockResolvedValue({ ok: true }),
      ]),
    )
    registerPlaylistSuggestionIpc({
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
    expect(Object.keys(handlers)).toHaveLength(3)
    await handlers['discweave:playlist-suggestions:generate'](event, {
      prompt: 'Evening tracks',
      consented: true,
    })
    expect(broker.generate).toHaveBeenCalledWith(event.sender, {
      prompt: 'Evening tracks',
      consented: true,
    })
    await handlers['discweave:playlist-suggestions:cancel'](event)
    expect(broker.cancel).toHaveBeenCalledWith(event.sender)
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
        handlers['discweave:playlist-suggestions:status'](event),
      ).rejects.toThrow('trusted application window')
      expect(broker.status).not.toHaveBeenCalled()
    },
  )
})
