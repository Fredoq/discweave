import { describe, expect, it } from 'vitest'
import { inheritsReleaseMainArtists } from './releaseArtistInheritance'
import type { ReleaseRecord } from './releasesData'

const release = {
  isVariousArtists: false,
  artistCredits: [
    { artistId: 'white-lies', artist: 'White Lies', role: 'Main artist' },
  ],
} as unknown as ReleaseRecord

const main = (artistId: string, artist: string) => ({
  artistId,
  artist,
  role: 'Main artist',
})

describe('inheritsReleaseMainArtists', () => {
  it('inherits when track main artists match the release main artists', () => {
    expect(
      inheritsReleaseMainArtists(release, [
        main('white-lies', 'White Lies'),
        { artist: 'Producer', role: 'Producer' },
      ]),
    ).toBe(true)
  })

  it('does not inherit when the track has different or extra main artists', () => {
    expect(inheritsReleaseMainArtists(release, [main('other', 'Other')])).toBe(
      false,
    )
    expect(
      inheritsReleaseMainArtists(release, [
        main('white-lies', 'White Lies'),
        main('guest', 'Guest'),
      ]),
    ).toBe(false)
  })

  it('never inherits on Various Artists releases', () => {
    expect(
      inheritsReleaseMainArtists({ ...release, isVariousArtists: true }, [
        main('white-lies', 'White Lies'),
      ]),
    ).toBe(false)
  })
})
