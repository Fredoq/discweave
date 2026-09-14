import { describe, expect, it } from 'vitest'
import type { ExternalMetadataReleaseDraftTrackDto } from '../catalog/catalogApi'
import {
  buildDiscogsTrackMapping,
  discogsTrackMappingKey,
  isCompleteDiscogsTrackMapping,
} from './discogsTrackMapping'

describe('buildDiscogsTrackMapping', () => {
  it('maps a reordered Discogs tracklist to imported files', () => {
    const currentTracks = [
      {
        id: 'track-1',
        title: 'Another Chance (Original Edit)',
        fileName: '01 Another Chance (Original Edit).m4a',
        position: 1,
      },
      {
        id: 'track-2',
        title: 'Another Chance (Afterlife Mix)',
        fileName: '02 Another Chance (Afterlife Mix).m4a',
        position: 2,
      },
      {
        id: 'track-3',
        title: "Another Chance (S-Man's Dark Nite Mix)",
        fileName: "03 Another Chance (S-Man's Dark Nite Mix).m4a",
        position: 3,
      },
    ]
    const discogsTracks: ExternalMetadataReleaseDraftTrackDto[] = [
      {
        title: 'Another Chance (Original Mix)',
        position: 1,
        artistCredits: [],
      },
      {
        title: "Another Chance (S-Man's Dark Nite Mix)",
        position: 2,
        artistCredits: [],
      },
      {
        title: 'Another Chance (Afterlife Mix)',
        position: 3,
        artistCredits: [],
      },
    ]

    expect(buildDiscogsTrackMapping(currentTracks, discogsTracks)).toEqual([
      {
        currentTrackId: 'track-1',
        currentTrackIndex: 0,
        discogsTrackIndex: 0,
        matchKind: 'review',
        reason: 'Version labels differ',
      },
      {
        currentTrackId: 'track-3',
        currentTrackIndex: 2,
        discogsTrackIndex: 1,
        matchKind: 'exact',
        reason: 'Titles match',
      },
      {
        currentTrackId: 'track-2',
        currentTrackIndex: 1,
        discogsTrackIndex: 2,
        matchKind: 'exact',
        reason: 'Titles match',
      },
    ])
  })

  it('keeps exact Discogs rows visible when imported files contain extras', () => {
    expect(
      buildDiscogsTrackMapping(
        [
          {
            id: 'track-a',
            title: 'A',
            fileName: '01 A.m4a',
            position: 1,
          },
          {
            id: 'track-b',
            title: 'B',
            fileName: '02 B.m4a',
            position: 2,
          },
        ],
        [{ title: 'A', position: 1, artistCredits: [] }],
      ),
    ).toEqual([
      {
        currentTrackId: 'track-a',
        currentTrackIndex: 0,
        discogsTrackIndex: 0,
        matchKind: 'exact',
        reason: 'Titles match',
      },
    ])
  })

  it('returns no rows when Discogs supplies an empty tracklist', () => {
    expect(
      buildDiscogsTrackMapping(
        [
          {
            id: 'track-a',
            title: 'A',
            fileName: '01 A.m4a',
            position: 1,
          },
        ],
        [],
      ),
    ).toEqual([])
  })

  it('requires review when a sole pair has punctuation-only titles', () => {
    expect(
      buildDiscogsTrackMapping(
        [
          {
            id: 'track-empty',
            title: '!!!',
            fileName: '01 empty.m4a',
            position: 1,
          },
        ],
        [{ title: '—', position: 1, artistCredits: [] }],
      ),
    ).toEqual([
      {
        currentTrackId: 'track-empty',
        currentTrackIndex: 0,
        discogsTrackIndex: 0,
        matchKind: 'review',
        reason: 'Version labels differ',
      },
    ])
  })

  it('leaves larger punctuation-only title sets unmatched', () => {
    expect(
      buildDiscogsTrackMapping(
        [
          {
            id: 'track-empty-1',
            title: '!!!',
            fileName: '01 empty-1.m4a',
            position: 1,
          },
          {
            id: 'track-empty-2',
            title: '???',
            fileName: '02 empty-2.m4a',
            position: 2,
          },
        ],
        [
          { title: '—', position: 1, artistCredits: [] },
          { title: '…', position: 2, artistCredits: [] },
        ],
      ),
    ).toEqual([
      {
        currentTrackId: null,
        currentTrackIndex: null,
        discogsTrackIndex: 0,
        matchKind: 'unmatched',
        reason: 'No safe automatic match',
      },
      {
        currentTrackId: null,
        currentTrackIndex: null,
        discogsTrackIndex: 1,
        matchKind: 'unmatched',
        reason: 'No safe automatic match',
      },
    ])
  })
})

describe('isCompleteDiscogsTrackMapping', () => {
  const currentTracks = [
    { id: 'track-1', title: 'One', fileName: 'one.m4a', position: 1 },
    { id: 'track-2', title: 'Two', fileName: 'two.m4a', position: 2 },
  ]
  const discogsTracks = [
    { title: 'One', position: 1, artistCredits: [] },
    { title: 'Two', position: 2, artistCredits: [] },
  ]
  const complete = buildDiscogsTrackMapping(currentTracks, discogsTracks)

  it.each([
    ['unknown kept ID', ['missing-track']],
    ['duplicate kept ID', ['track-1', 'track-1']],
  ])('rejects %s', (_label, keptTrackIds) => {
    expect(
      isCompleteDiscogsTrackMapping(
        currentTracks,
        discogsTracks,
        complete,
        keptTrackIds,
      ),
    ).toBe(false)
  })

  it('rejects a mapped and kept local track', () => {
    expect(
      isCompleteDiscogsTrackMapping(currentTracks, discogsTracks, complete, [
        'track-1',
      ]),
    ).toBe(false)
  })

  it('accepts a skipped provider row and an explicitly kept local track', () => {
    expect(
      isCompleteDiscogsTrackMapping(
        currentTracks,
        discogsTracks,
        [
          complete[0],
          {
            discogsTrackIndex: 1,
            currentTrackId: null,
            currentTrackIndex: null,
            matchKind: 'skipped',
            reason: 'Skipped by user',
          },
        ],
        ['track-2'],
      ),
    ).toBe(true)
  })

  it('requires review rows to carry an explicit confirmation key', () => {
    const reviewMapping = [
      { ...complete[0], matchKind: 'review' as const },
      complete[1],
    ]

    expect(
      isCompleteDiscogsTrackMapping(
        currentTracks,
        discogsTracks,
        reviewMapping,
      ),
    ).toBe(false)
    expect(
      isCompleteDiscogsTrackMapping(
        currentTracks,
        discogsTracks,
        reviewMapping,
        [],
        [discogsTrackMappingKey(reviewMapping[0])],
      ),
    ).toBe(true)
  })

  it('rejects invalid provider indexes, skipped IDs, and unresolved rows', () => {
    expect(
      isCompleteDiscogsTrackMapping(currentTracks, discogsTracks, [
        { ...complete[0], discogsTrackIndex: 2 },
        complete[1],
      ]),
    ).toBe(false)
    expect(
      isCompleteDiscogsTrackMapping(currentTracks, discogsTracks, [
        complete[0],
        {
          ...complete[1],
          currentTrackId: 'track-2',
          currentTrackIndex: 1,
          matchKind: 'skipped',
        },
      ]),
    ).toBe(false)
    expect(
      isCompleteDiscogsTrackMapping(currentTracks, discogsTracks, [
        {
          ...complete[0],
          matchKind: 'unmatched',
          currentTrackId: null,
          currentTrackIndex: null,
        },
        complete[1],
      ]),
    ).toBe(false)
  })
})
