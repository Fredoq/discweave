import { jsonResponse } from './appTestHarness'

export function searchResponseWithRelease() {
  return jsonResponse({
    items: [
      {
        id: 'release-stripped',
        type: 'release',
        title: 'Stripped',
        subtitle: 'Mute',
        summary: 'Imported single release.',
        matchedFields: ['title', 'credit.role'],
        snippets: ['Depeche Mode · Stripped'],
        facets: {
          roles: ['mainArtist'],
          media: [],
          statuses: [],
          tags: [],
          labelId: 'label-mute',
          collectorSignals: [],
        },
        rank: 1,
      },
    ],
    limit: 100,
    offset: 0,
    total: 1,
  })
}

export function graphResponseForReleaseWithDuplicateArtists() {
  return jsonResponse({
    entity: {
      id: 'release-stripped',
      type: 'release',
      title: 'Stripped',
      subtitle: 'Mute',
      summary: 'Imported single release.',
    },
    sections: {
      artists: [
        {
          id: 'artist-depeche-mode',
          type: 'artist',
          title: 'Depeche Mode',
          subtitle: 'Group',
          relation: 'mainArtist',
        },
      ],
      credits: [
        {
          id: 'artist-depeche-mode',
          type: 'artist',
          title: 'Depeche Mode',
          subtitle: 'mainArtist',
          relation: 'credit',
        },
      ],
      releases: [],
      tracks: [
        {
          id: 'track-stripped',
          type: 'track',
          title: 'Stripped',
          subtitle: '1',
          relation: 'tracklist',
        },
      ],
      ownedCopies: [],
      labels: [
        {
          id: 'label-mute',
          type: 'label',
          title: 'Mute',
          subtitle: 'BONG 010',
          relation: 'label',
        },
      ],
      playlists: [],
      relations: [],
      media: [],
    },
    collectorSignals: [],
  })
}

export function releaseDetailWithoutCover() {
  return jsonResponse({
    id: 'release-stripped',
    title: 'Stripped',
    type: 'standalone',
    year: 1986,
    releaseDate: '1986-02-10',
    genres: [],
    tags: [],
    coverImage: null,
    isVariousArtists: false,
    notOnLabel: false,
    artistCredits: [
      {
        artistId: 'artist-depeche-mode',
        artistName: 'Depeche Mode',
        role: 'mainArtist',
      },
    ],
    labels: [
      {
        labelId: 'label-mute',
        name: 'Mute',
        catalogNumber: 'BONG 010',
        hasNoCatalogNumber: false,
      },
    ],
    tracklist: [],
  })
}
