import {
  buildCatalogDictionaries,
  setActiveDictionaries,
} from './catalogDefaults'
import {
  groupCreditsByTarget,
  groupRatingsByTarget,
} from './catalogValueMappers'
import {
  toArtistRecord,
  toArtistRelationRecord,
  toLabelRecord,
  toOwnedItemRecord,
  toReleaseRecord,
  toTrackRecord,
  toTrackRelationRecord,
} from './catalogEntityMappers'
import { toPlaylistRecord } from './playlistMappers'
import { getAllPages } from './httpClient'
import { getInitialCatalogStateForTests } from './testCatalogStore'
import type {
  ArtistDto,
  ArtistRelationDto,
  CatalogState,
  CreditDto,
  DictionaryEntryDto,
  LabelDto,
  OwnedItemDto,
  PlaylistDto,
  RatingCriterionDto,
  RatingValueDto,
  ReleaseDto,
  ReleaseTrackContext,
  TrackDto,
  TrackRelationDto,
} from './catalogTypes'

export async function loadCatalog(): Promise<CatalogState> {
  const testCatalogState = getInitialCatalogStateForTests()
  if (testCatalogState) {
    return testCatalogState
  }

  const [
    artistsResponse,
    labelsResponse,
    releasesResponse,
    tracksResponse,
    ownedItemsResponse,
    creditsResponse,
    artistRelationsResponse,
    trackRelationsResponse,
    playlistsResponse,
    dictionariesResponse,
    ratingCriteriaResponse,
    ratingValuesResponse,
  ] = await Promise.all([
    getAllPages<ArtistDto>('/api/artists'),
    getAllPages<LabelDto>('/api/labels'),
    getAllPages<ReleaseDto>('/api/releases'),
    getAllPages<TrackDto>('/api/tracks'),
    getAllPages<OwnedItemDto>('/api/owned-items'),
    getAllPages<CreditDto>('/api/credits'),
    getAllPages<ArtistRelationDto>('/api/artist-relations'),
    getAllPages<TrackRelationDto>('/api/track-relations'),
    getAllPages<PlaylistDto>('/api/playlists'),
    getAllPages<DictionaryEntryDto>('/api/settings/dictionaries'),
    getAllPages<RatingCriterionDto>('/api/rating-criteria'),
    getAllPages<RatingValueDto>('/api/ratings'),
  ])
  const dictionaries = buildCatalogDictionaries(dictionariesResponse.items)
  setActiveDictionaries(dictionaries)
  const ratingsByTarget = groupRatingsByTarget(ratingValuesResponse.items)

  const labelsById = new Map(
    labelsResponse.items.map((label) => [label.id, label]),
  )
  const labels = labelsResponse.items.map(toLabelRecord)
  const artistsById = new Map(
    artistsResponse.items.map((artist) => [artist.id, artist]),
  )
  const creditsByTarget = groupCreditsByTarget(creditsResponse.items)
  const releaseDtosById = new Map(
    releasesResponse.items.map((release) => [release.id, release]),
  )
  const releaseTrackByTrackId = new Map<string, ReleaseTrackContext[]>()
  for (const release of releasesResponse.items) {
    for (const track of release.tracklist ?? []) {
      releaseTrackByTrackId.set(track.trackId, [
        ...(releaseTrackByTrackId.get(track.trackId) ?? []),
        { release, track },
      ])
    }
  }
  const trackRelationsByTrackId = new Map<string, TrackRelationDto[]>()
  for (const relation of trackRelationsResponse.items) {
    addTrackRelation(trackRelationsByTrackId, relation.sourceTrackId, relation)
    if (relation.targetTrackId !== relation.sourceTrackId) {
      addTrackRelation(
        trackRelationsByTrackId,
        relation.targetTrackId,
        relation,
      )
    }
  }
  const trackDtosById = new Map(
    tracksResponse.items.map((track) => [track.id, track]),
  )

  const artists = artistsResponse.items.map((artist) =>
    toArtistRecord(
      artist,
      creditsResponse.items,
      artistRelationsResponse.items,
      artistsById,
      releaseDtosById,
      trackDtosById,
      dictionaries,
      ratingsByTarget,
    ),
  )
  const releases = releasesResponse.items.map((release) =>
    toReleaseRecord(
      release,
      labelsById,
      creditsByTarget,
      artistsById,
      ownedItemsResponse.items,
      dictionaries,
      ratingsByTarget,
    ),
  )
  const tracks = tracksResponse.items.map((track) =>
    toTrackRecord(
      track,
      creditsByTarget,
      releaseDtosById,
      releaseTrackByTrackId,
      trackRelationsByTrackId,
      trackDtosById,
      dictionaries,
      ratingsByTarget,
    ),
  )
  const ownedItems = ownedItemsResponse.items.map((item) =>
    toOwnedItemRecord(item, releaseDtosById, releases, dictionaries),
  )
  const relations = [
    ...artistRelationsResponse.items.map((relation) =>
      toArtistRelationRecord(relation, artistsById, dictionaries),
    ),
    ...trackRelationsResponse.items.map((relation) =>
      toTrackRelationRecord(relation, trackDtosById, dictionaries),
    ),
  ]

  return {
    artists,
    labels,
    releases,
    tracks,
    ownedItems,
    relations,
    playlists: playlistsResponse.items.map(toPlaylistRecord),
    dictionaries,
    ratingCriteria: ratingCriteriaResponse.items,
    ratings: ratingValuesResponse.items,
  }
}

function addTrackRelation(
  relationsByTrackId: Map<string, TrackRelationDto[]>,
  trackId: string,
  relation: TrackRelationDto,
) {
  relationsByTrackId.set(trackId, [
    ...(relationsByTrackId.get(trackId) ?? []),
    relation,
  ])
}
