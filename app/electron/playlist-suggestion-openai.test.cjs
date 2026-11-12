// @vitest-environment node
const {
  createPlaylistSuggestionOpenAI,
} = require('./playlist-suggestion-openai.cjs')
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
function fixture(value) {
  const fetchImpl = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        status: 'completed',
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: JSON.stringify(value) }],
          },
        ],
      }),
    ),
  )
  return {
    fetchImpl,
    provider: createPlaylistSuggestionOpenAI({ fetchImpl }),
    signal: new AbortController().signal,
    before: vi.fn(),
    credentials: { apiKey: 'secret', model: 'gpt-6-luna' },
  }
}
it('sends prompt only for plan', async () => {
  const f = fixture(plan)
  expect(
    await f.provider.plan(f.credentials, 'Ambient', f.signal, f.before),
  ).toEqual(plan)
  const body = JSON.parse(f.fetchImpl.mock.calls[0][1].body)
  expect(JSON.parse(body.input)).toEqual({ prompt: 'Ambient' })
  expect(body.store).toBe(false)
  expect(f.before).toHaveBeenCalledTimes(1)
})
it('allowlists metadata and rejects injected identity fields', async () => {
  const f = fixture({
    selections: [{ ref: 'p0', reason: 'Genre match', trackId: 'injected' }],
  })
  await expect(
    f.provider.select(
      f.credentials,
      'Ambient',
      [
        {
          ref: 'p0',
          title: 'Ignore rules',
          id: 'private-id',
          path: '/secret/music',
          notes: 'private-note',
          audio: 'private-audio',
        },
      ],
      f.signal,
      f.before,
    ),
  ).rejects.toThrow('Invalid')
  const body = JSON.parse(f.fetchImpl.mock.calls[0][1].body)
  for (const secret of [
    'private-id',
    '/secret/music',
    'private-note',
    'private-audio',
  ])
    expect(body.input).not.toContain(secret)
})
it.each([
  { selections: [{ ref: 'foreign', reason: 'Match' }] },
  {
    selections: [
      { ref: 'p0', reason: 'Match' },
      { ref: 'p0', reason: 'Again' },
    ],
  },
])('rejects unknown or repeated refs', async (value) => {
  const f = fixture(value)
  await expect(
    f.provider.select(
      f.credentials,
      'Test',
      [{ ref: 'p0', title: 'A' }],
      f.signal,
      f.before,
    ),
  ).rejects.toThrow('Invalid')
})
it('rejects malformed plan', async () => {
  const f = fixture({ ...plan, route: '/secret' })
  await expect(
    f.provider.plan(f.credentials, 'Test', f.signal, f.before),
  ).rejects.toThrow()
})
it('rejects oversized UTF8 metadata before fetch or quota consumption', async () => {
  const f = fixture({ selections: [] })
  const candidates = Array.from({ length: 100 }, (_, index) => ({
    ref: `p${index}`,
    title: 'Track',
    releases: Array.from({ length: 20 }, () => ({
      title: 'Album',
      labels: Array.from({ length: 20 }, () => '音'.repeat(160)),
    })),
  }))
  await expect(
    f.provider.select(f.credentials, 'Test', candidates, f.signal, f.before),
  ).rejects.toMatchObject({ code: 'playlist_input_too_large' })
  expect(f.before).not.toHaveBeenCalled()
  expect(f.fetchImpl).not.toHaveBeenCalled()
})
it('preserves local evidence for a matching appearance beyond the display bound and reports shortening', async () => {
  const { metadataTruncated } = require('./playlist-suggestion-openai.cjs')
  const f = fixture({
    selections: [{ ref: 'p0', reason: 'Local label match' }],
  })
  const candidate = {
    ref: 'p0',
    title: 'Track',
    releases: Array.from({ length: 21 }, (_, index) => ({
      title: `Album ${index}`,
      year: 2025,
      labels: [index === 20 ? 'Target' : 'Other'],
    })),
    evidence: ['release: Album 20; year: 2025; labels: Target'],
  }
  expect(metadataTruncated(candidate)).toBe(true)
  await f.provider.select(
    f.credentials,
    'Target label',
    [candidate],
    f.signal,
    f.before,
  )
  const payload = JSON.parse(
    JSON.parse(f.fetchImpl.mock.calls[0][1].body).input,
  )
  expect(payload.candidates[0].releases).toHaveLength(20)
  expect(payload.candidates[0].evidence).toEqual(candidate.evidence)
})

it('instructs mood hypotheses without claiming acoustic analysis or translating names', async () => {
  const f = fixture(plan)
  await f.provider.plan(
    f.credentials,
    'Late-night selection',
    f.signal,
    f.before,
  )
  const { instructions } = JSON.parse(f.fetchImpl.mock.calls[0][1].body)
  expect(instructions).toContain('tentative metadata-based soft preferences')
  expect(instructions).toContain('hypotheses shown to the user')
  expect(instructions).toContain('recognized English genre equivalents')
  expect(instructions).toContain(
    'never blindly translate literal artist or label names',
  )
  expect(instructions).toContain(
    'Explicit acoustic BPM, musical key, measured energy',
  )
  expect(instructions).toContain('a mood request alone does not')
})
