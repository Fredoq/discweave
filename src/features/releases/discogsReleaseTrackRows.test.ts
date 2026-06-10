import { describe, expect, it } from 'vitest'
import { discogsDraftTrackRows } from './discogsReleaseTrackRows'

describe('discogs release track rows', () => {
  it('uses backend-provided Discogs draft track rows without heading filtering', () => {
    expect(
      discogsDraftTrackRows([
        {
          title: 'Little Fluffy Clouds',
          position: 1,
          disc: 'Orbit Compact Disc',
          side: 'A',
          durationSeconds: 269,
          artistCredits: [],
        },
        {
          title: 'Earth (Gaia)',
          position: 2,
          disc: 'Orbit Compact Disc',
          side: 'A',
          artistCredits: [],
        },
        {
          title: 'Perpetual Dawn',
          position: 3,
          disc: 'Ultraworld Index',
          side: 'B',
          durationSeconds: 580,
          artistCredits: [],
        },
      ]),
    ).toMatchObject([
      {
        title: 'Little Fluffy Clouds',
        position: 1,
        disc: 'Orbit Compact Disc',
        side: 'A',
      },
      {
        title: 'Earth (Gaia)',
        position: 2,
        disc: 'Orbit Compact Disc',
        side: 'A',
      },
      {
        title: 'Perpetual Dawn',
        position: 3,
        disc: 'Ultraworld Index',
        side: 'B',
      },
    ])
  })
})
