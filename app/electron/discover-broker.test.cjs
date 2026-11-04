// @vitest-environment node
const { EventEmitter } = require('node:events')
const { createDiscoverBroker } = require('./discover-broker.cjs')
function fixture() {
  const vault = {
    status: vi.fn().mockResolvedValue({ configured: true }),
    credentials: vi
      .fn()
      .mockResolvedValue({ apiKey: 'private-test-key', consented: true }),
    save: vi.fn(),
    remove: vi.fn(),
  }
  const provider = {
    test: vi
      .fn()
      .mockImplementation(async (_credentials, _signal, beforeRequest) => {
        beforeRequest()
        return { ok: true }
      }),
    generate: vi.fn().mockResolvedValue([{ artist: 'A', title: 'B' }]),
  }
  const backend = vi
    .fn()
    .mockResolvedValueOnce({ configured: true, enabled: true })
    .mockResolvedValueOnce({ profileToken: 'private-token', examples: [] })
    .mockResolvedValue({ items: [] })
  const sender = new EventEmitter()
  return {
    vault,
    provider,
    backend,
    sender,
    broker: createDiscoverBroker({ vault, provider, backend }),
  }
}
describe('Discover broker', () => {
  it('obtains the collection profile in main and resolves only untrusted leads', async () => {
    const { broker, backend, sender } = fixture()
    expect(await broker.generate(sender, { mode: 'familiar' })).toEqual({
      items: [],
    })
    expect(backend.mock.calls[1][1]).toMatch(
      /^\/api\/discover\/profile\?seed=.+&mode=familiar$/,
    )
    expect(backend.mock.calls[2][2].body).toEqual({
      profileToken: 'private-token',
      leads: [{ artist: 'A', title: 'B' }],
    })
    expect(JSON.stringify(backend.mock.calls)).not.toContain('private-test-key')
  })
  it('requires metadata consent before any catalog or provider request', async () => {
    const { broker, vault, provider, backend, sender } = fixture()
    vault.credentials.mockResolvedValue({ consented: false })
    await expect(broker.generate(sender, { mode: 'familiar' })).rejects.toThrow(
      'consent',
    )
    expect(backend).not.toHaveBeenCalled()
    expect(provider.generate).not.toHaveBeenCalled()
  })
  it('bounds calls to six per hour in the app session', async () => {
    const { broker, provider, sender } = fixture()
    for (let i = 0; i < 6; i++) await broker.test(sender)
    await expect(broker.test(sender)).rejects.toThrow('hourly session limit')
    expect(provider.test).toHaveBeenCalledTimes(6)
  })
  it('cancels before provider invocation even when profile transport ignores abort', async () => {
    const { broker, backend, provider, sender } = fixture()
    let resolve
    backend.mockReset().mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const pending = broker.generate(sender, { mode: 'familiar' })
    await vi.waitFor(() => expect(resolve).toBeTypeOf('function'))
    broker.cancel()
    resolve({ profileToken: 'token', examples: [] })
    await expect(pending).rejects.toThrow('cancelled')
    expect(provider.generate).not.toHaveBeenCalled()
  })
  it('does not start with credentials loaded before removal', async () => {
    const { broker, vault, provider, sender } = fixture()
    let resolve
    vault.credentials.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const pending = broker.test(sender)
    await broker.remove()
    resolve({ apiKey: 'old-private-key', consented: true })
    await expect(pending).rejects.toThrow('cancelled')
    expect(provider.test).not.toHaveBeenCalled()
  })
  it('rejects concurrent generation rather than double billing', async () => {
    const { broker, provider, sender } = fixture()
    let resolve
    provider.test.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const pending = broker.test(sender)
    await vi.waitFor(() => expect(resolve).toBeTypeOf('function'))
    await expect(broker.test(sender)).rejects.toThrow('already running')
    resolve({ ok: true })
    await pending
    expect(provider.test).toHaveBeenCalledTimes(1)
  })
  it('sanitizes unexpected transport errors', async () => {
    const { broker, backend, sender } = fixture()
    backend.mockReset().mockRejectedValue(new Error('private profile and key'))
    await expect(broker.generate(sender, { mode: 'familiar' })).rejects.toThrow(
      'previous results are unchanged',
    )
  })
  it('aborts when the application window is destroyed', async () => {
    const { broker, provider, sender } = fixture()
    provider.test.mockImplementation(
      (_credentials, signal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(new Error('aborted'))),
        ),
    )
    const pending = broker.test(sender)
    await vi.waitFor(() => expect(provider.test).toHaveBeenCalled())
    sender.emit('destroyed')
    await expect(pending).rejects.toThrow('cancelled')
  })
  it.each([
    { mode: 'invalid' },
    { mode: 'familiar', releaseId: '../other' },
    {
      mode: 'familiar',
      releaseId: '11111111-1111-1111-1111-111111111111',
      trackId: '22222222-2222-2222-2222-222222222222',
    },
  ])('rejects invalid generation input %j', (request) => {
    const { broker, backend, sender } = fixture()
    expect(() => broker.generate(sender, request)).toThrow('Discover')
    expect(backend).not.toHaveBeenCalled()
  })
  it('cancels when the owner window closes during credential loading', async () => {
    const { broker, vault, provider, sender } = fixture()
    let resolve
    vault.credentials.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const pending = broker.test(sender)
    sender.emit('destroyed')
    resolve({ apiKey: 'old-key', consented: true })
    await expect(pending).rejects.toThrow('cancelled')
    expect(provider.test).not.toHaveBeenCalled()
  })
  it('does not return stale results when a transport ignores cancellation', async () => {
    const { broker, provider, sender } = fixture()
    let resolve
    provider.test.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const pending = broker.test(sender)
    await vi.waitFor(() => expect(resolve).toBeTypeOf('function'))
    sender.emit(
      'did-start-navigation',
      {},
      'http://127.0.0.1:1234/',
      false,
      true,
    )
    resolve({ ok: true })
    await expect(pending).rejects.toThrow('cancelled')
  })
  it('does not make a paid request when catalog profile preflight fails', async () => {
    const { broker, backend, provider, sender } = fixture()
    backend
      .mockReset()
      .mockRejectedValue(new Error('Catalog verification is not configured'))
    await expect(broker.generate(sender, { mode: 'familiar' })).rejects.toThrow(
      'Catalog verification',
    )
    expect(provider.generate).not.toHaveBeenCalled()
    expect(backend).toHaveBeenCalledTimes(1)
  })
  it('preflights Discogs readiness before requesting a taste profile or paid leads', async () => {
    const { broker, backend, provider, sender } = fixture()
    backend.mockReset().mockResolvedValue({ configured: false, enabled: false })
    await expect(broker.generate(sender, { mode: 'familiar' })).rejects.toThrow(
      'configured Discogs',
    )
    expect(backend).toHaveBeenCalledWith(
      sender,
      '/api/settings/integrations/discogs',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(backend).toHaveBeenCalledTimes(1)
    expect(provider.generate).not.toHaveBeenCalled()
  })
})
