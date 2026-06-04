import { describe, expect, it } from 'vitest'
import { discogsDraftTrackRows } from './discogsReleaseTrackRows'

describe('discogs release track rows', () => {
  it('drops Discogs heading rows and renumbers remaining tracks for DiscWeave', () => {
    expect(
      discogsDraftTrackRows([
        {
          title: 'Orbit Compact Disc',
          position: 1,
          durationSeconds: null,
          artistCredits: [],
        },
        {
          title: 'Little Fluffy Clouds',
          position: 2,
          durationSeconds: 269,
          artistCredits: [],
        },
        {
          title: 'Earth (Gaia)',
          position: 3,
          durationSeconds: 580,
          artistCredits: [],
        },
      ]),
    ).toMatchObject([
      { title: 'Little Fluffy Clouds', position: 1 },
      { title: 'Earth (Gaia)', position: 2 },
    ])
  })
})
