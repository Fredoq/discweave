// @vitest-environment node
const { EventEmitter } = require('node:events')
const { createDiscoverBroker } = require('./discover-broker.cjs')
const {
  createPlaylistSuggestionBroker,
} = require('./playlist-suggestion-broker.cjs')
const plan = {
  hard: {
    genresAny: [],
    tagsAny: [],
    artistsAny: [],
    labelsAny: [],
    yearFrom: null,
    yearTo: null,
  },
  exclude: { artists: [], genres: [], tags: [], labels: [] },
  softTerms: [],
  unsupported: [],
}
function fixture() {
  const vault = {
    credentials: vi
      .fn()
      .mockResolvedValue({ apiKey: 'secret', consented: false }),
    status: vi.fn().mockResolvedValue({ configured: true }),
  }
  const provider = {
    plan: vi.fn(async (_c, _p, _s, before) => {
      before()
      return plan
    }),
    select: vi.fn(),
  }
  const discoverBroker = createDiscoverBroker({
    vault,
    provider: { test: async (_c, _s, b) => b() },
    backend: vi.fn(),
  })
  const loadCatalog = vi.fn().mockResolvedValue([]),
    sender = new EventEmitter()
  return {
    vault,
    provider,
    discoverBroker,
    loadCatalog,
    sender,
    broker: createPlaylistSuggestionBroker({
      discoverBroker,
      provider,
      loadCatalog,
    }),
  }
}
const request = { prompt: 'Ambient', excludedTrackIds: [], consented: true }
it('requires fresh consent even with Discover consent', async () => {
  const f = fixture()
  f.vault.credentials.mockResolvedValue({ apiKey: 'secret', consented: true })
  await expect(
    f.broker.generate(f.sender, { ...request, consented: false }),
  ).rejects.toThrow('consent')
  expect(f.provider.plan).not.toHaveBeenCalled()
  expect(f.loadCatalog).not.toHaveBeenCalled()
})
it('shares six HTTP attempts without requiring Discover consent', async () => {
  const f = fixture()
  for (let i = 0; i < 5; i++) await f.broker.generate(f.sender, request)
  f.vault.credentials.mockResolvedValue({ apiKey: 'secret', consented: true })
  await f.discoverBroker.test(f.sender)
  await expect(f.broker.generate(f.sender, request)).rejects.toThrow()
  expect(f.provider.plan).toHaveBeenCalledTimes(5)
})
it('cancels own request and discards late result', async () => {
  const f = fixture()
  let resolve
  f.provider.plan.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done
      }),
  )
  const pending = f.broker.generate(f.sender, request)
  await vi.waitFor(() => expect(resolve).toBeTypeOf('function'))
  f.broker.cancel(new EventEmitter())
  f.broker.cancel(f.sender)
  resolve(plan)
  await expect(pending).rejects.toThrow('cancelled')
  expect(f.loadCatalog).not.toHaveBeenCalled()
})
it('shares active request exclusion', async () => {
  const f = fixture()
  let resolve
  f.provider.plan.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done
      }),
  )
  const pending = f.broker.generate(f.sender, request)
  await vi.waitFor(() => expect(resolve).toBeTypeOf('function'))
  await expect(f.discoverBroker.test(f.sender)).rejects.toThrow(
    'already running',
  )
  resolve(plan)
  await pending
})
it('redacts transport errors with plausible safe prefixes', async () => {
  const f = fixture()
  f.provider.plan.mockRejectedValue(
    new Error('OpenAI secret-debug-private-data'),
  )
  await expect(f.broker.generate(f.sender, request)).rejects.toThrow(
    'Playlist suggestions could not complete',
  )
})
it('maps only ephemeral references to local identities in provider order', async () => {
  const f = fixture()
  f.loadCatalog.mockResolvedValue([
    {
      id: 'one',
      title: 'One',
      artists: ['Artist'],
      genres: [],
      tags: [],
      releases: [],
    },
    {
      id: 'two',
      title: 'Two',
      artists: ['Artist'],
      genres: [],
      tags: [],
      releases: [],
    },
  ])
  f.provider.select.mockImplementation(async (_c, _p, rows, _s, before) => {
    before()
    return [...rows]
      .reverse()
      .map((row) => ({ ref: row.ref, reason: 'Metadata match' }))
  })
  const result = await f.broker.generate(f.sender, request)
  const rows = f.provider.select.mock.calls[0][2]
  expect(result.items.map((row) => row.trackId)).toEqual(
    [...rows].reverse().map((row) => row.id),
  )
  expect(result.items[0].title).toBe(rows.at(-1).title)
})
it('another sender cannot cancel an active playlist request', async () => {
  const f = fixture()
  f.vault.credentials.mockResolvedValue({ apiKey: 'secret', consented: true })
  let resolve
  const pending = f.discoverBroker.runPlaylist(f.sender, async (_c, signal) => {
    await new Promise((done) => {
      resolve = done
    })
    signal.throwIfAborted()
  })
  await vi.waitFor(() => expect(resolve).toBeTypeOf('function'))
  f.broker.cancel(new EventEmitter())
  resolve()
  await expect(pending).resolves.toBeUndefined()
})
it('integrates real loader, retrieval and provider with metadata-only requests', async () => {
  const {
    createPlaylistSuggestionCatalog,
  } = require('./playlist-suggestion-catalog.cjs')
  const {
    createPlaylistSuggestionOpenAI,
  } = require('./playlist-suggestion-openai.cjs')
  const f = fixture()
  const records = {
    '/api/tracks': [
      {
        id: 'track-one',
        title: 'Track',
        durationSeconds: 180,
        genres: ['Ambient'],
        tags: ['Night'],
        credits: [{ artistName: 'Artist', roles: ['mainArtist'] }],
        releaseAppearances: [{ releaseId: 'release-one' }],
        notes: 'SECRET_NOTE',
        digitalFiles: [{ path: '/secret/music' }],
      },
    ],
    '/api/releases': [
      {
        id: 'release-one',
        title: 'Album',
        year: 2025,
        genres: ['Electronic'],
        labels: [{ name: 'Label' }],
        artistCredits: [{ artistName: 'Artist', roles: ['mainArtist'] }],
      },
    ],
    '/api/rating-criteria': [{ id: 'overall', code: 'overall' }],
    '/api/ratings': [
      {
        id: 'rating',
        targetType: 'track',
        targetId: 'track-one',
        criterionId: 'overall',
        value: 5,
      },
    ],
  }
  const backend = async (_s, route) => {
    const key = new URL(route, 'http://localhost').pathname
    const items = records[key]
    return {
      items,
      total: items.length,
      offset: 0,
      limit: key === '/api/rating-criteria' ? items.length : 100,
    }
  }
  const fetchImpl = vi.fn(async (_url, options) => {
    const input = JSON.parse(JSON.parse(options.body).input)
    const value = input.candidates
      ? {
          selections: [
            { ref: input.candidates[0].ref, reason: 'Metadata match' },
          ],
        }
      : plan
    return new Response(
      JSON.stringify({
        status: 'completed',
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: JSON.stringify(value) }],
          },
        ],
      }),
    )
  })
  const broker = createPlaylistSuggestionBroker({
    discoverBroker: f.discoverBroker,
    provider: createPlaylistSuggestionOpenAI({ fetchImpl }),
    loadCatalog: createPlaylistSuggestionCatalog({ backend }),
  })
  const response = await broker.generate(f.sender, request)
  expect(response.items[0]).toMatchObject({
    trackId: 'track-one',
    title: 'Track',
    artist: 'Artist',
    releaseTitle: 'Album',
  })
  const payload = JSON.parse(JSON.parse(fetchImpl.mock.calls[1][1].body).input)
  expect(payload.candidates[0]).toMatchObject({
    artist: 'Artist',
    durationSeconds: 180,
    overallRating: 5,
    releases: [{ title: 'Album', year: 2025, labels: ['Label'] }],
  })
  for (const secret of [
    'SECRET_NOTE',
    '/secret/music',
    'track-one',
    'release-one',
  ])
    expect(JSON.stringify(payload)).not.toContain(secret)
})
it.each(['catalog_too_large', 'catalog_incomplete'])(
  'surfaces static catalog failure %s without provider text',
  async (code) => {
    const f = fixture()
    f.loadCatalog.mockRejectedValue(
      Object.assign(new Error('SECRET'), { code }),
    )
    await expect(f.broker.generate(f.sender, request)).rejects.toThrow(
      code === 'catalog_too_large' ? '50,000' : 'incomplete metadata',
    )
  },
)
it('returns unsupported intent before catalog access', async () => {
  const f = fixture()
  f.provider.plan.mockResolvedValue({
    ...plan,
    unsupported: ['Audio tempo inference'],
  })
  f.loadCatalog.mockRejectedValue(new Error('not needed'))
  const result = await f.broker.generate(f.sender, request)
  expect(result.warnings).toEqual([
    'Unsupported request: Audio tempo inference',
  ])
  expect(f.loadCatalog).not.toHaveBeenCalled()
  expect(f.provider.select).not.toHaveBeenCalled()
})
