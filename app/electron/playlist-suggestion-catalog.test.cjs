// @vitest-environment node
const {
  createPlaylistSuggestionCatalog,
} = require('./playlist-suggestion-catalog.cjs')
const track = (n) => ({
  id: `track-${n}`,
  title: `Track ${n}`,
  durationSeconds: 180,
  genres: ['Ambient'],
  tags: ['Night'],
  credits: [{ artistName: 'Artist', role: 'mainArtist' }],
  releaseAppearances: [],
  digitalFiles: [{ path: '/private/music.flac' }],
  notes: 'PRIVATE_NOTE',
})
const release = (id) => ({
  id,
  title: 'Album',
  year: 2025,
  genres: ['Electronic'],
  labels: [{ name: 'Label', catalogNumber: 'HIDDEN' }],
  artistCredits: [{ artistName: 'Album artist', primaryRole: 'mainArtist' }],
  coverImage: { url: '/private/cover' },
  tracklist: [],
})
function fixture({
  tracks = [track(1)],
  releases = [],
  ratings = [],
  criteria = [],
} = {}) {
  const backend = vi.fn(async (_sender, route) => {
    const url = new URL(route, 'http://localhost')
    if (url.pathname === '/api/rating-criteria')
      return {
        items: criteria,
        total: criteria.length,
        offset: 0,
        limit: criteria.length,
      }
    const records = {
      '/api/tracks': tracks,
      '/api/releases': releases,
      '/api/ratings': ratings,
    }[url.pathname]
    if (!records) throw new Error('Unexpected route')
    const offset = Number(url.searchParams.get('offset'))
    return {
      items: records.slice(offset, offset + 100),
      limit: 100,
      offset,
      total: records.length,
    }
  })
  return { backend, load: createPlaylistSuggestionCatalog({ backend }) }
}
it('loads every page including the relevant last track after page 100', async () => {
  const tracks = Array.from({ length: 201 }, (_, i) => track(i))
  tracks[200].title = 'Only matching track'
  const s = fixture({ tracks })
  const result = await s.load('sender')
  expect(result).toHaveLength(201)
  expect(result.at(-1).title).toBe('Only matching track')
  expect(s.backend.mock.calls.map((call) => call[1])).toContain(
    '/api/tracks?limit=100&offset=200',
  )
})
it('strictly allowlists multi-release metadata and Overall without private source fields', async () => {
  const item = {
    ...track(1),
    credits: [],
    releaseAppearances: [
      { releaseId: 'r1' },
      { releaseId: 'r2' },
      { releaseId: 'r1' },
    ],
  }
  const s = fixture({
    tracks: [item],
    releases: [release('r1'), { ...release('r2'), title: 'Other edition' }],
    criteria: [{ id: 'overall', code: 'overall' }],
    ratings: [
      {
        id: 'rating',
        targetId: item.id,
        targetType: 'track',
        criterionId: 'overall',
        value: 5,
        notes: 'SECRET',
      },
    ],
  })
  const [result] = await s.load('sender')
  expect(result).toEqual({
    id: item.id,
    title: item.title,
    artists: ['Album artist'],
    durationSeconds: 180,
    genres: ['Ambient'],
    tags: ['Night'],
    releases: [
      {
        title: 'Album',
        year: 2025,
        artists: ['Album artist'],
        labels: ['Label'],
        genres: ['Electronic'],
      },
      {
        title: 'Other edition',
        year: 2025,
        artists: ['Album artist'],
        labels: ['Label'],
        genres: ['Electronic'],
      },
    ],
    overallRating: 5,
  })
  expect(JSON.stringify(result)).not.toMatch(
    /private|PRIVATE_NOTE|SECRET|HIDDEN|digitalFiles|coverImage|tracklist/,
  )
})
it('represents missing ratings as null, not dislike', async () => {
  expect((await fixture().load('sender'))[0].overallRating).toBeNull()
})
it.each([
  ['wrong offset', (page) => ({ ...page, offset: 1 })],
  ['wrong limit', (page) => ({ ...page, limit: 50 })],
  ['unexpected empty page', (page) => ({ ...page, items: [] })],
  ['malformed items', (page) => ({ ...page, items: null })],
  ['fractional total', (page) => ({ ...page, total: 1.5 })],
])(
  'rejects %s rather than returning partial results',
  async (_name, change) => {
    const s = fixture()
    s.backend.mockResolvedValueOnce(
      change({ items: [track(1)], limit: 100, offset: 0, total: 1 }),
    )
    await expect(s.load('sender')).rejects.toMatchObject({
      code: 'catalog_incomplete',
    })
  },
)
it('rejects changed totals and duplicate IDs across pages', async () => {
  for (const duplicate of [false, true]) {
    const s = fixture({
      tracks: Array.from({ length: 101 }, (_, i) => track(i)),
    })
    const implementation = s.backend.getMockImplementation()
    s.backend.mockImplementation(async (...args) => {
      const page = await implementation(...args)
      if (page.offset === 100)
        return duplicate
          ? { ...page, items: [track(0)] }
          : { ...page, total: 102 }
      return page
    })
    await expect(s.load('sender')).rejects.toMatchObject({
      code: 'catalog_incomplete',
    })
  }
})
it('rejects oversized catalogs explicitly without truncation', async () => {
  const s = fixture()
  s.backend.mockResolvedValueOnce({
    items: [],
    limit: 100,
    offset: 0,
    total: 50001,
  })
  await expect(s.load('sender')).rejects.toMatchObject({
    code: 'catalog_too_large',
  })
  expect(s.backend).toHaveBeenCalledTimes(1)
})
it('does not return partial metadata when a referenced release is unavailable', async () => {
  const s = fixture({
    tracks: [{ ...track(1), releaseAppearances: [{ releaseId: 'missing' }] }],
  })
  await expect(s.load('sender')).rejects.toMatchObject({
    code: 'catalog_incomplete',
  })
})
it('passes cancellation to every request and stops after an aborted page', async () => {
  const controller = new AbortController()
  const s = fixture()
  s.backend.mockImplementationOnce(async (_sender, _route, { signal }) => {
    expect(signal).toBe(controller.signal)
    controller.abort()
    return { items: [track(1)], total: 1, offset: 0, limit: 100 }
  })
  await expect(
    s.load('sender', { signal: controller.signal }),
  ).rejects.toMatchObject({ name: 'AbortError' })
  expect(s.backend).toHaveBeenCalledTimes(1)
})
it('returns empty catalog without fabricating tracks', async () => {
  expect(await fixture({ tracks: [] }).load('sender')).toEqual([])
})
it('reads Overall ratings beyond the first page and keeps absent ratings null', async () => {
  const tracks = Array.from({ length: 102 }, (_, i) => track(i))
  const ratings = tracks.slice(0, 101).map((item, i) => ({
    id: `rating-${i}`,
    targetId: item.id,
    targetType: 'track',
    criterionId: 'overall',
    value: i === 100 ? 5 : 3,
  }))
  const s = fixture({
    tracks,
    ratings,
    criteria: [{ id: 'overall', code: 'overall' }],
  })
  const result = await s.load('sender')
  expect(result[100].overallRating).toBe(5)
  expect(result[101].overallRating).toBeNull()
  expect(s.backend.mock.calls.map((call) => call[1])).toContain(
    '/api/ratings?targetType=track&criterionId=overall&limit=100&offset=100',
  )
})
it('rejects a failed backend request without converting it to an empty catalog', async () => {
  const s = fixture()
  s.backend.mockRejectedValueOnce(new Error('Authentication changed'))
  await expect(s.load('sender')).rejects.toThrow('Authentication changed')
  expect(s.backend).toHaveBeenCalledTimes(1)
})

it('never treats producer or composer credits as the recording artist', async () => {
  const releaseRecord = {
    ...release('r1'),
    artistCredits: [
      { artistName: 'Album producer', primaryRole: 'producer' },
      { artistName: 'Recording artist', roles: ['mainArtist', 'performer'] },
    ],
  }
  const producerOnly = {
    ...track(1),
    credits: [
      { artistName: 'Producer', role: 'producer' },
      { artistName: 'Composer', role: 'composer' },
    ],
    releaseAppearances: [{ releaseId: 'r1' }],
  }
  const main = {
    ...track(2),
    credits: [
      { artistName: 'Producer', role: 'producer' },
      { artistName: 'Main artist', roles: ['producer', 'mainArtist'] },
      { artistName: 'Session musician', role: 'performer' },
    ],
  }
  const unknown = {
    ...track(3),
    credits: [{ artistName: 'Composer', role: 'composer' }],
  }
  const performer = {
    ...track(4),
    credits: [{ artistName: 'Performer', role: 'performer' }],
  }
  const result = await fixture({
    tracks: [producerOnly, main, unknown, performer],
    releases: [releaseRecord],
  }).load('sender')
  expect(result.map((item) => item.artists)).toEqual([
    ['Recording artist'],
    ['Main artist'],
    [],
    ['Performer'],
  ])
  expect(result[0].releases[0].artists).toEqual(['Recording artist'])
})
it('rejects fractional duration because the backend duration contract is integer seconds', async () => {
  const s = fixture({ tracks: [{ ...track(1), durationSeconds: 180.5 }] })
  await expect(s.load('sender')).rejects.toMatchObject({
    code: 'catalog_incomplete',
  })
})
