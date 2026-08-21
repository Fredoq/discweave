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
})
