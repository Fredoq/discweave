import {
  defaultCatalogDictionaries,
  defaultRatingCriteria,
  defaultTagRoleMappings,
  setActiveDictionaries,
  setActiveTagRoleMappings,
} from './catalogDefaults'
import type {
  CatalogState,
  EntityRating,
  RatingTargetType,
} from './catalogTypes'

export const emptyCatalogState: CatalogState = {
  artists: [],
  labels: [],
  releases: [],
  tracks: [],
  ownedItems: [],
  relations: [],
  playlists: [],
  dictionaries: defaultCatalogDictionaries,
  ratingCriteria: defaultRatingCriteria,
  ratings: [],
}

let testCatalogState: CatalogState | null = null

export function seedCatalogForTests(state: CatalogState) {
  if (import.meta.env.MODE !== 'test') {
    throw new Error('Test catalog seeding is only available in tests')
  }

  testCatalogState = withDefaultDictionaries(state)
  setActiveDictionaries(
    testCatalogState.dictionaries ?? defaultCatalogDictionaries,
  )
  setActiveTagRoleMappings(
    testCatalogState.tagRoleMappings ?? defaultTagRoleMappings,
  )
}

export function clearCatalogForTests() {
  if (import.meta.env.MODE === 'test') {
    testCatalogState = null
    setActiveDictionaries(defaultCatalogDictionaries)
    setActiveTagRoleMappings(defaultTagRoleMappings)
  }
}

export function getInitialCatalogStateForTests() {
  return import.meta.env.MODE === 'test' ? testCatalogState : null
}

export function canUseTestCatalogMutation() {
  return (
    import.meta.env.MODE === 'test' &&
    testCatalogState !== null &&
    !('__cratebaseUseRealCatalogApi' in globalThis)
  )
}

export function updateTestCatalogState(
  mutator: (state: CatalogState) => CatalogState,
) {
  if (!canUseTestCatalogMutation() || !testCatalogState) {
    return false
  }

  testCatalogState = withDefaultDictionaries(mutator(testCatalogState))
  setActiveDictionaries(
    testCatalogState.dictionaries ?? defaultCatalogDictionaries,
  )
  setActiveTagRoleMappings(
    testCatalogState.tagRoleMappings ?? defaultTagRoleMappings,
  )

  return true
}

function withDefaultDictionaries(state: CatalogState): CatalogState {
  const ratings = state.ratings ?? []

  return {
    ...state,
    dictionaries: state.dictionaries ?? defaultCatalogDictionaries,
    ratingCriteria: state.ratingCriteria ?? defaultRatingCriteria,
    tagRoleMappings: state.tagRoleMappings ?? defaultTagRoleMappings,
    ratings,
    labels: state.labels ?? [],
    artists: state.artists.map((artist) => ({
      ...artist,
      ratings: targetRatings(ratings, 'artist', artist.id),
    })),
    releases: state.releases.map((release) => ({
      ...release,
      ratings: targetRatings(ratings, 'release', release.id),
    })),
    tracks: state.tracks.map((track) => ({
      ...track,
      ratings: targetRatings(ratings, 'track', track.id),
    })),
  }
}

function targetRatings(
  ratings: EntityRating[],
  targetType: RatingTargetType,
  targetId: string,
) {
  return ratings.filter(
    (rating) =>
      rating.targetType === targetType && rating.targetId === targetId,
  )
}
