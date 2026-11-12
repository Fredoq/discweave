// @vitest-environment node
const {
  retrievePlaylistCandidates,
  validatePlan,
} = require('./playlist-suggestion-model.cjs')
const plan = () => ({
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
})
const track = (id, overrides = {}) => ({
  id,
  title: 'Ordinary',
  artists: [`Artist ${id}`],
  releases: [
    { title: 'Album', year: 2000, labels: ['Label'], artists: [], genres: [] },
  ],
  genres: ['Ambient'],
  tags: ['Warm'],
  ...overrides,
})
describe('playlist full catalog retrieval', () => {
  it('finds relevant metadata after the first 100 records', () => {
    const catalog = Array.from({ length: 400 }, (_, i) => track(String(i)))
    catalog[350].title = 'Moonlit refuge'
    const p = plan()
    p.softTerms = ['moonlit']
    const result = retrievePlaylistCandidates(catalog, p)
    expect(result.examined).toBe(400)
    expect(result.matched).toBe(1)
    expect(result.candidates[0].id).toBe('350')
  })
  it('supports OR inside hard fields and AND across fields, excluding current tracks', () => {
    const p = plan()
    p.hard.genresAny = ['Ambient', 'Techno']
    p.hard.labelsAny = ['Label']
    p.exclude.artists = ['Banned']
    const result = retrievePlaylistCandidates(
      [
        track('A'),
        track('B', { artists: ['Banned'] }),
        track('C', { releases: [{ labels: ['Other'] }] }),
        track('D', { genres: ['Techno'] }),
      ],
      p,
      { excludedTrackIds: ['A'] },
    )
    expect(result.candidates.map((x) => x.id)).toEqual(['D'])
  })
  it('does not make unknown years or absent tags pass explicit constraints or exclusions', () => {
    const p = plan()
    p.hard.yearFrom = 1990
    expect(
      retrievePlaylistCandidates(
        [
          track('A', { releases: [{ year: '1990s' }] }),
          track('B', { releases: [{ year: null }] }),
        ],
        p,
      ).matched,
    ).toBe(0)
    p.hard.yearFrom = null
    p.exclude.tags = ['Metal']
    expect(
      retrievePlaylistCandidates(
        [track('A', { tags: [] }), track('B', { tags: ['Metal'] })],
        p,
      ).matched,
    ).toBe(0)
    p.exclude.tags = []
    p.hard.tagsAny = ['Warm']
    expect(
      retrievePlaylistCandidates([track('A', { tags: [] })], p).matched,
    ).toBe(0)
  })
  it('is stable under input permutations and diversifies tied artists within the cap', () => {
    const catalog = Array.from({ length: 160 }, (_, i) =>
      track(String(i).padStart(3, '0'), { artists: [i < 140 ? 'A' : 'B'] }),
    )
    const forward = retrievePlaylistCandidates(catalog, plan())
    const reverse = retrievePlaylistCandidates([...catalog].reverse(), plan())
    expect(forward).toEqual(reverse)
    expect(forward.shortlisted).toBe(100)
    expect(forward.matched).toBe(160)
    expect(forward.candidates.slice(0, 2).map((x) => x.artists[0])).toEqual([
      'A',
      'B',
    ])
  })
  it('returns zero rather than arbitrary mood guesses, but discloses hard-only fallback', () => {
    const p = plan()
    p.softTerms = ['melancholic']
    expect(retrievePlaylistCandidates([track('A')], p).shortlisted).toBe(0)
    p.hard.genresAny = ['Ambient']
    const result = retrievePlaylistCandidates([track('A')], p)
    expect(result.shortlisted).toBe(1)
    expect(result.warnings[0]).toContain('No metadata evidence')
    expect(result.candidates[0].score).toBe(0)
  })
  it('blocks unsupported audio requests and invalid plans', () => {
    const p = plan()
    p.unsupported = ['BPM above 120']
    expect(retrievePlaylistCandidates([track('A')], p)).toMatchObject({
      supported: false,
      shortlisted: 0,
    })
    expect(() => validatePlan({ ...plan(), limit: 100 })).toThrow()
    expect(() => validatePlan({ ...plan(), softTerms: [''] })).toThrow()
    expect(() =>
      retrievePlaylistCandidates([track('A'), track('A')], plan()),
    ).toThrow('unique')
  })
  it('emits only allowlisted metadata and evidence, without mutating inputs', () => {
    const catalog = [
      track('A', { path: '/private/music', title: 'Moonlit', overall: 4 }),
    ]
    const snapshot = structuredClone(catalog)
    const p = plan()
    p.softTerms = ['Moonlit']
    const result = retrievePlaylistCandidates(catalog, p)
    expect(result.candidates[0].path).toBeUndefined()
    expect(result.candidates[0].evidence).toContain('term “moonlit” in title')
    expect(catalog).toEqual(snapshot)
  })
})

it('requires label and year to match the same release appearance', () => {
  const p = plan()
  p.hard.labelsAny = ['A']
  p.hard.yearFrom = 2000
  p.hard.yearTo = 2000
  const catalog = [
    track('mixed', {
      releases: [
        { title: 'First', labels: ['A'], year: 1990 },
        { title: 'Second', labels: ['B'], year: 2000 },
      ],
    }),
    track('valid', {
      releases: [{ title: 'Third', labels: ['A'], year: 2000 }],
    }),
  ]
  expect(
    retrievePlaylistCandidates(catalog, p).candidates.map((x) => x.id),
  ).toEqual(['valid'])
})

it('returns no matches for unsatisfied exact metadata and does not apply substring hard matches', () => {
  const p = plan()
  p.hard.genresAny = ['Ambient']
  expect(
    retrievePlaylistCandidates(
      [track('A', { genres: ['Dark Ambient'] }), track('B', { genres: [] })],
      p,
    ).matched,
  ).toBe(0)
  expect(
    retrievePlaylistCandidates([track('A', { genres: ['  AMBIENT  '] })], p)
      .matched,
  ).toBe(1)
})
it('keeps positively evidenced matches ahead of diverse hard-only matches', () => {
  const p = plan()
  p.hard.genresAny = ['Ambient']
  p.softTerms = ['refuge']
  const catalog = Array.from({ length: 200 }, (_, i) => track(String(i)))
  catalog[199].title = 'Quiet refuge'
  const result = retrievePlaylistCandidates(catalog, p)
  expect(result.matched).toBe(200)
  expect(result.candidates[0].id).toBe('199')
  expect(result.shortlisted).toBe(100)
})

it('discloses the bounded shortlist and keeps matched year/label evidence ahead of long release names', () => {
  const p = plan()
  p.hard.labelsAny = ['Label']
  p.hard.yearFrom = 2000
  const records = Array.from({ length: 101 }, (_, i) =>
    track(String(i), {
      releases: [{ title: 'Long'.repeat(100), year: 2000, labels: ['Label'] }],
    }),
  )
  const result = retrievePlaylistCandidates(records, p)
  expect(result.warnings).toContain(
    'Automatically shortlisted 100 of 101 matching tracks using metadata ranking and artist diversity. The remaining matches were not sent to AI.',
  )
  expect(result.candidates[0].evidence.slice(0, 2)).toEqual([
    'year: 2000',
    'label: Label',
  ])
})
it('bounds term strings in the schema and runtime validator', () => {
  const { PLAN_SCHEMA } = require('./playlist-suggestion-model.cjs')
  expect(PLAN_SCHEMA.properties.softTerms.items.maxLength).toBe(200)
  expect(() =>
    validatePlan({ ...plan(), softTerms: ['x'.repeat(201)] }),
  ).toThrow()
})
