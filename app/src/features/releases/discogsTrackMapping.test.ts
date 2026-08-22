import { describe, expect, it } from 'vitest'
import type { ExternalMetadataReleaseDraftTrackDto } from '../catalog/catalogApi'
import { buildDiscogsTrackMapping } from './discogsTrackMapping'

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
