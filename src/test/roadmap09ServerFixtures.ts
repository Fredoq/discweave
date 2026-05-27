import { jsonResponse } from './appTestHarness'

export function searchResponseWithTrack() {
  return jsonResponse({
    items: [
      {
        id: 'track-1',
        type: 'track',
        title: 'Blue Monday (Hardfloor Mix)',
        subtitle: 'Track',
        summary: 'Remix and version relation entry.',
        matchedFields: ['title', 'track relations'],
        snippets: ['Blue Monday (Hardfloor Mix) · remixOf'],
        facets: {
          roles: ['remixer', 'remixOf'],
          media: ['Digital'],
          statuses: ['Owned'],
          tags: ['remix'],
          labelId: null,
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

export function graphResponseForArtistNavigation() {
  return jsonResponse({
    entity: {
      id: 'artist-1',
      type: 'artist',
      title: 'Arthur Baker',
      subtitle: 'Person',
      summary: 'Producer and remixer credits.',
    },
    sections: {
      artists: [
        {
          id: 'artist-2',
          type: 'artist',
          title: 'New Order',
          subtitle: 'Band',
          relation: 'collaboration',
        },
      ],
      releases: [
        {
          id: 'release-1',
          type: 'release',
          title: 'Confusion',
          subtitle: 'New Order',
          relation: 'producer',
        },
      ],
      tracks: [
        {
          id: 'track-1',
          type: 'track',
          title: 'Confusion (Instrumental)',
          subtitle: 'New Order',
          relation: 'remixer',
        },
      ],
      ownedCopies: [],
      labels: [],
      playlists: [],
      credits: [
        {
          id: 'release-1',
          type: 'release',
          title: 'Confusion',
          subtitle: 'New Order',
          relation: 'producer',
        },
        {
          id: 'track-1',
          type: 'track',
          title: 'Confusion (Instrumental)',
          subtitle: 'New Order',
          relation: 'remixer',
        },
      ],
      relations: [
        {
          id: 'artist-relation-1',
          type: 'relation',
          title: 'Arthur Baker to New Order',
          subtitle: 'collaboration',
          relation: 'artist relation',
        },
      ],
      media: [],
    },
    collectorSignals: [],
  })
}

export function graphResponseForTrackNavigation() {
  return jsonResponse({
    entity: {
      id: 'track-1',
      type: 'track',
      title: 'Blue Monday (Hardfloor Mix)',
      subtitle: 'Blue Monday',
      summary: 'Remix and version relation entry.',
    },
    sections: {
      artists: [
        {
          id: 'artist-1',
          type: 'artist',
          title: 'Hardfloor',
          subtitle: 'Artist',
          relation: 'remixer',
        },
      ],
      releases: [
        {
          id: 'release-1',
          type: 'release',
          title: 'Blue Monday Remixes',
          subtitle: 'New Order',
          relation: 'appears on',
        },
      ],
      tracks: [
        {
          id: 'track-2',
          type: 'track',
          title: 'Blue Monday',
          subtitle: 'New Order',
          relation: 'remixOf',
        },
      ],
      ownedCopies: [],
      labels: [],
      playlists: [],
      credits: [],
      relations: [
        {
          id: 'track-relation-1',
          type: 'relation',
          title: 'Blue Monday (Hardfloor Mix) to Blue Monday',
          subtitle: 'remixOf',
          relation: 'track relation',
        },
      ],
      media: [],
    },
    collectorSignals: [],
  })
}

export function artistRelationDetailResponse() {
  return jsonResponse({
    id: 'artist-relation-1',
    sourceArtistId: 'artist-1',
    targetArtistId: 'artist-2',
    type: 'collaboration',
    startYear: 1983,
    endYear: null,
    sourceArtistName: 'Arthur Baker',
    targetArtistName: 'New Order',
  })
}

export function trackRelationDetailResponse() {
  return jsonResponse({
    id: 'track-relation-1',
    sourceTrackId: 'track-1',
    targetTrackId: 'track-2',
    type: 'remixOf',
    sourceTrackTitle: 'Blue Monday (Hardfloor Mix)',
    targetTrackTitle: 'Blue Monday',
  })
}
