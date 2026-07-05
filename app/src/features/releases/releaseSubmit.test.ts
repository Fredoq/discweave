import { describe, expect, it } from 'vitest'
import { buildReleaseSubmission } from './releaseSubmit'

describe('buildReleaseSubmission', () => {
  it('keeps collection items that only contain a note', () => {
    const { release } = buildReleaseSubmission({
      artists: [],
      collectionItems: [
        {
          id: 'note-only-copy',
          medium: '',
          note: 'Find the promo edition',
          status: '',
        },
      ],
      draftTracks: [],
      effectiveArtistCredits: [
        {
          id: 'artist-credit-1',
          artistId: '',
          artist: 'Submission Artist',
          role: 'Main artist',
          roles: ['Main artist'],
        },
      ],
      effectiveLabels: [],
      genres: [],
      isVariousArtists: false,
      notOnLabel: true,
      releaseDate: '',
      releaseNotes: '',
      tags: '',
      title: 'Note Only Release',
      tracks: [],
      type: 'Single',
      year: '1998',
    })

    expect(release.ownedCopies).toEqual([
      {
        id: 'note-only-copy',
        medium: 'Other',
        status: 'Owned',
        storage: '',
        condition: '',
        note: 'Find the promo edition',
      },
    ])
  })
})
