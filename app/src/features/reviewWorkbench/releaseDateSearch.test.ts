import { describe, expect, it } from 'vitest'
import type { ExternalMetadataReleaseCandidateDto } from '../catalog/api/externalMetadataClient'
import { rankDateCandidates, type DateSearchContext } from './releaseDateSearch'

const context: DateSearchContext = {
  title: 'Blue Monday',
  artists: ['New Order'],
  catalogNumbers: ['FAC 073'],
  labels: ['Factory'],
  year: 1983,
}

function candidate(
  id: string,
  values: Partial<ExternalMetadataReleaseCandidateDto> = {},
): ExternalMetadataReleaseCandidateDto {
  return {
    source: {
      providerName: 'discogs',
      resourceType: 'release',
      externalId: id,
      sourceUrl: `https://www.discogs.com/release/${id}`,
      attribution: 'Discogs',
    },
    title: 'Blue Monday',
    artists: [],
    labels: [],
    formats: [],
    barcodes: [],
    ...values,
  }
}

describe('release date candidate ranking', () => {
  it('prioritizes catalog number separator matches without removing leading zeroes', () => {
    const candidates = [
      candidate('1', { catalogNumber: 'FAC 73' }),
      candidate('2', { catalogNumber: ' fac-073 ' }),
      candidate('3', { catalogNumber: 'FAC073R' }),
    ]
    const results = rankDateCandidates(candidates, context)
    expect(
      results.map(({ candidate: item }) => item.source.externalId),
    ).toEqual(['2', '1', '3'])
    expect(results[0].matches).toContain('Catalog number')
    expect(results[1].matches).not.toContain('Catalog number')
    expect(results[2].matches).not.toContain('Catalog number')
  })

  it('uses artist and label evidence before a title-only result', () => {
    const results = rankDateCandidates(
      [
        candidate('1'),
        candidate('2', { labels: ['Factory'] }),
        candidate('3', { artists: ['New Order (2)'], labels: ['Factory'] }),
      ],
      context,
    )
    expect(
      results.map(({ candidate: item }) => item.source.externalId),
    ).toEqual(['3', '2', '1'])
    expect(results[0].matches).toEqual(['Artist', 'Label', 'Title'])
    expect(results[0].score).toBe(65)
  })

  it('preserves candidates with absent or different metadata and stable ties', () => {
    const candidates = [
      candidate('1', { title: 'Unknown', year: null }),
      candidate('2', { title: 'Different', year: 2020, artists: ['Another'] }),
      candidate('3', { year: 1983 }),
    ]
    const results = rankDateCandidates(candidates, context)
    expect(
      results.map(({ candidate: item }) => item.source.externalId),
    ).toEqual(['3', '1', '2'])
    expect(results.slice(1).map((item) => item.score)).toEqual([0, 0])
    expect(candidates[0].source.externalId).toBe('1')
  })

  it('deduplicates only exact provider resource identities and keeps distinct editions', () => {
    const first = candidate('1', { catalogNumber: 'FAC073' })
    const second = candidate('2', { catalogNumber: 'FAC073' })
    const anotherProvider = {
      ...first,
      source: { ...first.source, providerName: 'other' },
    }
    const anotherResource = {
      ...first,
      source: { ...first.source, resourceType: 'master' },
    }
    const results = rankDateCandidates(
      [first, first, second, anotherProvider, anotherResource],
      context,
    )
    expect(results).toHaveLength(4)
    expect(results[0].candidate).toBe(first)
    expect(results[1].candidate).toBe(second)
    expect(results[2].candidate).toBe(anotherProvider)
    expect(results[3].candidate).toBe(anotherResource)
  })

  it('matches artist-prefixed Discogs titles without stripping actual title fragments', () => {
    const results = rankDateCandidates(
      [
        candidate('1', {
          title: 'New Order - Blue Monday',
          artists: ['New Order'],
        }),
        candidate('2', {
          title: 'Part One - Blue Monday',
          artists: ['New Order'],
        }),
      ],
      context,
    )
    expect(results[0].matches).toContain('Title')
    expect(results[1].matches).not.toContain('Title')
  })

  it('normalizes case diacritics and whitespace while ignoring empty evidence', () => {
    const results = rankDateCandidates(
      [
        candidate('1', {
          artists: ['  café (3)'],
          labels: ['  LÁBEL  '],
          title: '',
        }),
      ],
      {
        title: '',
        artists: ['Café'],
        labels: ['label'],
        catalogNumbers: [''],
        year: null,
      },
    )
    expect(results[0].matches).toEqual(['Artist', 'Label'])
    expect(results[0].score).toBe(45)
  })

  it('matches any available catalog number and does not infer exact identity from year', () => {
    const results = rankDateCandidates(
      [candidate('1', { catalogNumber: 'ABC-02', year: 1983 })],
      { ...context, catalogNumbers: ['FAC073', 'ABC 02'] },
    )
    expect(results[0].matches).toEqual(['Catalog number', 'Title', 'Year'])
    expect(results[0].score).toBe(125)
  })
})
