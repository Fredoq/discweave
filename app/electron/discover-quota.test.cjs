// @vitest-environment node
const { EventEmitter } = require('node:events')
const { createDiscoverBroker } = require('./discover-broker.cjs')
const { createDiscoverOpenAI } = require('./discover-openai.cjs')

const ratedProfile = {
  profileToken: 'local-token',
  examples: [{ artist: 'Artist', title: 'Album', kind: 'release', rating: 5 }],
}

function fixture() {
  const fetchImpl = vi.fn().mockImplementation(async (url) =>
    Response.json(
      url.endsWith('/responses')
        ? {
            status: 'completed',
            output: [
              {
                type: 'message',
                content: [{ type: 'output_text', text: '{"leads":[]}' }],
              },
            ],
          }
        : { id: 'gpt-6-luna' },
    ),
  )
  const backend = vi.fn().mockImplementation(async (_sender, endpoint) => {
    if (endpoint.includes('/settings/'))
      return { configured: true, enabled: true }
    if (endpoint.includes('/profile?')) return ratedProfile
    return { items: [] }
  })
  const vault = {
    credentials: vi.fn().mockResolvedValue({
      apiKey: 'test-private-key',
      model: 'gpt-6-luna',
      consented: true,
    }),
  }
  const sender = new EventEmitter()
  const provider = createDiscoverOpenAI({ fetchImpl })
  const broker = createDiscoverBroker({ vault, provider, backend })
  return { fetchImpl, backend, sender, broker }
}

async function expectSixRemainingConnections(broker, sender, fetchImpl) {
  for (let count = 0; count < 6; count++) await broker.test(sender)
  await expect(broker.test(sender)).rejects.toThrow('hourly session limit')
  expect(fetchImpl).toHaveBeenCalledTimes(6)
}

describe('Discover quota accounting at the OpenAI HTTP boundary', () => {
  it.each([
    [
      'unconfigured Discogs',
      'configured Discogs',
      async () => ({ configured: false, enabled: false }),
    ],
    [
      'failed Discogs preflight',
      'previous results',
      async () => {
        throw new Error('network failed')
      },
    ],
    [
      'failed profile',
      'previous results',
      async (_sender, endpoint) => {
        if (endpoint.includes('/settings/'))
          return { configured: true, enabled: true }
        throw new Error('profile failed')
      },
    ],
    [
      'empty profile',
      'Rate some releases',
      async (_sender, endpoint) =>
        endpoint.includes('/settings/')
          ? { configured: true, enabled: true }
          : { examples: [] },
    ],
  ])(
    'does not consume quota for %s',
    async (_name, message, implementation) => {
      const { backend, fetchImpl, broker, sender } = fixture()
      backend.mockImplementation(implementation)
      for (let count = 0; count < 7; count++) {
        await expect(
          broker.generate(sender, { mode: 'familiar' }),
        ).rejects.toThrow(message)
      }
      expect(fetchImpl).not.toHaveBeenCalled()
      await expectSixRemainingConnections(broker, sender, fetchImpl)
    },
  )

  it('does not consume quota when cancelled during local preflight', async () => {
    const { backend, fetchImpl, broker, sender } = fixture()
    backend.mockImplementation(async () => {
      broker.cancel()
      return { configured: true, enabled: true }
    })
    await expect(broker.generate(sender, { mode: 'familiar' })).rejects.toThrow(
      'cancelled',
    )
    expect(fetchImpl).not.toHaveBeenCalled()
    await expectSixRemainingConnections(broker, sender, fetchImpl)
  })

  it('does not consume quota when validation aborts before the provider fetch', async () => {
    const { backend, fetchImpl, broker, sender } = fixture()
    backend.mockImplementation(async (_sender, endpoint) => {
      if (endpoint.includes('/settings/'))
        return { configured: true, enabled: true }
      return {
        get examples() {
          broker.cancel()
          return ratedProfile.examples
        },
      }
    })
    await expect(broker.generate(sender, { mode: 'familiar' })).rejects.toThrow(
      'cancelled',
    )
    expect(fetchImpl).not.toHaveBeenCalled()
    await expectSixRemainingConnections(broker, sender, fetchImpl)
  })

  it('counts attempted HTTP failures without refunding the slot', async () => {
    const { fetchImpl, broker, sender, backend } = fixture()
    fetchImpl.mockRejectedValue(new Error('network failed'))
    for (let count = 0; count < 6; count++) {
      await expect(
        broker.generate(sender, { mode: 'familiar' }),
      ).rejects.toThrow('previous results')
    }
    const localCalls = backend.mock.calls.length
    await expect(broker.generate(sender, { mode: 'familiar' })).rejects.toThrow(
      'hourly session limit',
    )
    expect(fetchImpl).toHaveBeenCalledTimes(6)
    expect(backend).toHaveBeenCalledTimes(localCalls)
  })

  it('counts connection checks and generations against the same quota', async () => {
    const { fetchImpl, broker, sender } = fixture()
    for (let count = 0; count < 5; count++) await broker.test(sender)
    await broker.generate(sender, { mode: 'familiar' })
    await expect(broker.test(sender)).rejects.toThrow('hourly session limit')
    expect(fetchImpl.mock.calls.map(([, options]) => options.method)).toEqual([
      'GET',
      'GET',
      'GET',
      'GET',
      'GET',
      'POST',
    ])
  })

  it('does not refund an HTTP attempt cancelled after fetch starts', async () => {
    const { fetchImpl, broker, sender } = fixture()
    fetchImpl.mockImplementationOnce(async () => {
      broker.cancel()
      throw new Error('transport aborted')
    })
    await expect(broker.generate(sender, { mode: 'familiar' })).rejects.toThrow(
      'cancelled',
    )
    for (let count = 0; count < 5; count++) await broker.test(sender)
    await expect(broker.test(sender)).rejects.toThrow('hourly session limit')
    expect(fetchImpl).toHaveBeenCalledTimes(6)
  })
})
