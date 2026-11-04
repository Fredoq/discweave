// @vitest-environment node
const {
  createDiscoverOpenAI,
  minimizedExamples,
} = require('./discover-openai.cjs')
const credentials = { apiKey: 'test-private-key', model: 'gpt-6-luna' }
const profile = {
  profileToken: 'private-capability',
  examples: [
    {
      artist: 'Artist',
      title: 'Release',
      rating: 5,
      standout: true,
      path: '/private/music',
      notes: 'secret',
    },
  ],
  collectionId: 'private-collection',
}
const result = (leads = [{ artist: 'Other', title: 'Album' }]) => ({
  status: 'completed',
  output: [
    {
      type: 'message',
      content: [{ type: 'output_text', text: JSON.stringify({ leads }) }],
    },
  ],
})

describe('Discover OpenAI transport', () => {
  it('sends only minimized metadata with structured output, bounded tokens and no response storage', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json(result()))
    const provider = createDiscoverOpenAI({ fetchImpl })
    const signal = new AbortController().signal
    expect(
      await provider.generate(credentials, profile, 'familiar', signal),
    ).toEqual([{ artist: 'Other', title: 'Album' }])
    const [url, options] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/responses')
    expect(options.redirect).toBe('error')
    expect(options.signal).toBe(signal)
    expect(options.headers.Authorization).toBe('Bearer test-private-key')
    const body = JSON.parse(options.body)
    expect(body.store).toBe(false)
    expect(body.max_output_tokens).toBe(2000)
    expect(body.text.format.strict).toBe(true)
    for (const secret of [
      'private-capability',
      'private-collection',
      '/private/music',
      'secret',
      'test-private-key',
    ])
      expect(options.body).not.toContain(secret)
    expect(JSON.parse(body.input).examples).toEqual([
      {
        artist: 'Artist',
        title: 'Release',
        kind: 'release',
        rating: 5,
        standout: true,
      },
    ])
  })
  it('tests authentication and model access without a paid generation call', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(Response.json({ id: credentials.model }))
    const response = await createDiscoverOpenAI({ fetchImpl }).test(
      credentials,
      new AbortController().signal,
    )
    expect(response.ok).toBe(true)
    expect(fetchImpl.mock.calls[0][0]).toBe(
      'https://api.openai.com/v1/models/gpt-6-luna',
    )
    expect(fetchImpl.mock.calls[0][1].method).toBe('GET')
  })
  it.each([401, 429, 500])(
    'sanitizes provider failure %s without exposing its body',
    async (status) => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(new Response('private upstream body', { status }))
      await expect(
        createDiscoverOpenAI({ fetchImpl }).test(credentials),
      ).rejects.toThrow(/^OpenAI /)
    },
  )
  it('rejects incomplete generations instead of accepting partial leads', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(Response.json({ ...result(), status: 'incomplete' }))
    await expect(
      createDiscoverOpenAI({ fetchImpl }).generate(
        credentials,
        profile,
        'familiar',
      ),
    ).rejects.toThrow('did not complete')
  })
  it('rejects oversized responses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('x'.repeat(65537)))
    await expect(
      createDiscoverOpenAI({ fetchImpl }).test(credentials),
    ).rejects.toThrow('size limit')
  })
  it('rejects empty profiles before network access', async () => {
    const fetchImpl = vi.fn()
    await expect(
      createDiscoverOpenAI({ fetchImpl }).generate(
        credentials,
        { examples: [] },
        'familiar',
      ),
    ).rejects.toThrow('Rate some')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it('bounds example count and strings while excluding unrated data', () => {
    const examples = Array.from({ length: 60 }, () => ({
      artist: 'a'.repeat(200),
      title: 't'.repeat(200),
      rating: 2,
      standout: true,
    }))
    const minimized = minimizedExamples({ examples })
    expect(minimized).toHaveLength(40)
    expect(minimized[0]).toEqual({
      artist: 'a'.repeat(120),
      title: 't'.repeat(120),
      kind: 'release',
      rating: 2,
      standout: false,
    })
    expect(
      minimizedExamples({
        examples: [{ title: 'Unrated', artist: 'A', rating: null }],
      }),
    ).toEqual([])
  })
  it('rejects malformed structured output', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        Response.json(result(Array(21).fill({ artist: 'A', title: 'T' }))),
      )
    await expect(
      createDiscoverOpenAI({ fetchImpl }).generate(
        credentials,
        profile,
        'familiar',
      ),
    ).rejects.toThrow('invalid recommendation')
  })
  it('supports unscored contextual discovery without inventing ratings or exposing extra context', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json(result()))
    await createDiscoverOpenAI({ fetchImpl }).generate(
      credentials,
      {
        examples: [],
        context: {
          artist: 'Context artist',
          title: 'Context title',
          kind: 'track',
          rating: 5,
          path: '/secret',
        },
      },
      'familiar',
    )
    const input = JSON.parse(JSON.parse(fetchImpl.mock.calls[0][1].body).input)
    expect(input.context).toEqual({
      artist: 'Context artist',
      title: 'Context title',
      kind: 'track',
    })
    expect(input.examples).toEqual([])
    expect(fetchImpl.mock.calls[0][1].body).not.toContain('/secret')
  })
  it('does not retry provider failures and multiply paid requests', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(new Error('network unavailable'))
    await expect(
      createDiscoverOpenAI({ fetchImpl }).generate(
        credentials,
        profile,
        'familiar',
      ),
    ).rejects.toThrow()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
  it('rejects refusals and malformed JSON rather than fabricating releases', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(Response.json({ status: 'completed', output: [] }))
    await expect(
      createDiscoverOpenAI({ fetchImpl }).generate(
        credentials,
        profile,
        'familiar',
      ),
    ).rejects.toThrow('invalid recommendation')
  })
  it('keeps track examples distinct from release examples', () => {
    expect(
      minimizedExamples({
        examples: [
          { artist: 'A', title: 'Track title', kind: 'track', rating: 4 },
          { artist: 'A', title: 'Album title', kind: 'release', rating: 2 },
        ],
      }).map((item) => item.kind),
    ).toEqual(['track', 'release'])
  })
  it('rejects oversized or malformed leads instead of truncating their identity', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          result([
            null,
            { artist: 'A', title: 'x'.repeat(121) },
            { artist: 'A', title: 'Valid' },
          ]),
        ),
      )
    expect(
      await createDiscoverOpenAI({ fetchImpl }).generate(
        credentials,
        profile,
        'familiar',
      ),
    ).toEqual([{ artist: 'A', title: 'Valid' }])
  })
  it('sends only bounded artist and title avoid hints without feedback or identity fields', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json(result()))
    const avoid = Array.from({ length: 30 }, () => ({
      artist: 'a'.repeat(200),
      title: 't'.repeat(200),
      externalId: 'private-external-id',
      collectionId: 'private-collection-id',
      feedback: 'notInterested',
      profileToken: 'private-history-token',
      notes: 'private notes',
      path: '/private/history',
    }))
    await createDiscoverOpenAI({ fetchImpl }).generate(
      credentials,
      { ...profile, avoid },
      'familiar',
    )
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body)
    const input = JSON.parse(body.input)
    expect(input.avoid).toHaveLength(20)
    expect(input.avoid[0]).toEqual({
      artist: 'a'.repeat(120),
      title: 't'.repeat(120),
    })
    expect(body.instructions).toContain('Do not suggest releases in avoid')
    for (const secret of [
      'private-external-id',
      'private-collection-id',
      'notInterested',
      'private-history-token',
      'private notes',
      '/private/history',
    ]) {
      expect(body.input).not.toContain(secret)
    }
  })
  it.each([
    undefined,
    null,
    'invalid',
    [null, { artist: '', title: 'T' }, { artist: 'A', title: 4 }],
  ])(
    'ignores malformed avoid hints without failing recommendations',
    async (avoid) => {
      const fetchImpl = vi.fn().mockResolvedValue(Response.json(result()))
      await createDiscoverOpenAI({ fetchImpl }).generate(
        credentials,
        { ...profile, avoid },
        'familiar',
      )
      expect(
        JSON.parse(JSON.parse(fetchImpl.mock.calls[0][1].body).input).avoid,
      ).toEqual([])
    },
  )
})
