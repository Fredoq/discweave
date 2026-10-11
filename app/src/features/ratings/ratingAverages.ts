import { createContext, useContext } from 'react'
import type {
  RatingAverage,
  RatingCriterion,
  RatingTargetType,
} from '../catalog/catalogApi'

/** The slice of catalog state that computed averages are read from. */
export type RatingAveragesValue = Readonly<{
  ratingAverages?: RatingAverage[]
  ratingCriteria?: RatingCriterion[]
}>

export const RatingAveragesContext = createContext<RatingAveragesValue>({})

export type NamedRatingAverage = RatingAverage & { criterionName: string }

export function useTrackAverages(
  targetType: RatingTargetType,
  targetId: string,
): NamedRatingAverage[] {
  const { ratingAverages = [], ratingCriteria = [] } = useContext(
    RatingAveragesContext,
  )

  return ratingCriteria
    .filter((criterion) => criterion.isActive)
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
    )
    .flatMap((criterion) => {
      const average = ratingAverages.find(
        (item) =>
          item.criterionId === criterion.id &&
          item.targetType === targetType &&
          item.targetId === targetId,
      )

      return average ? [{ ...average, criterionName: criterion.name }] : []
    })
}

export type TrackAverageSort = 'averageHighest' | 'averageLowest'

export function isTrackAverageSort(value: string): value is TrackAverageSort {
  return value === 'averageHighest' || value === 'averageLowest'
}

/**
 * The track average each target is ranked by: the first active criterion
 * (by sort order) that has an average for it.
 */
export function useTrackAverageByTarget(targetType: RatingTargetType) {
  const { ratingAverages = [], ratingCriteria = [] } = useContext(
    RatingAveragesContext,
  )
  const criterionRank = new Map(
    ratingCriteria
      .filter((criterion) => criterion.isActive)
      .sort(
        (left, right) =>
          left.sortOrder - right.sortOrder ||
          left.name.localeCompare(right.name),
      )
      .map((criterion, index) => [criterion.id, index]),
  )
  const ranked = new Map<string, { average: number; rank: number }>()

  for (const item of ratingAverages) {
    const rank = criterionRank.get(item.criterionId)
    if (item.targetType !== targetType || rank === undefined) {
      continue
    }

    const current = ranked.get(item.targetId)
    if (!current || rank < current.rank) {
      ranked.set(item.targetId, { average: item.average, rank })
    }
  }

  return new Map(
    [...ranked].map(([targetId, { average }]) => [targetId, average]),
  )
}

/** Sorts by track average; targets without an average always go last. */
export function sortByTrackAverage<T extends { id: string }>(
  records: T[],
  averages: Map<string, number>,
  sort: TrackAverageSort,
) {
  const direction = sort === 'averageHighest' ? -1 : 1

  return [...records].sort((left, right) => {
    const leftAverage = averages.get(left.id)
    const rightAverage = averages.get(right.id)
    if (leftAverage === undefined) return rightAverage === undefined ? 0 : 1
    if (rightAverage === undefined) return -1

    return (leftAverage - rightAverage) * direction
  })
}
