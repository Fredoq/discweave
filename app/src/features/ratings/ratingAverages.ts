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
          item.ratedTrackCount > 0 &&
          item.targetType === targetType &&
          item.targetId === targetId,
      )

      return average ? [{ ...average, criterionName: criterion.name }] : []
    })
}

export type TrackStatSort =
  | 'averageHighest'
  | 'averageLowest'
  | 'tracksMost'
  | 'tracksFewest'

export function isTrackStatSort(value: string): value is TrackStatSort {
  return [
    'averageHighest',
    'averageLowest',
    'tracksMost',
    'tracksFewest',
  ].includes(value)
}

/**
 * The track statistics each target is ranked by: those of the first active
 * criterion (by sort order) that has tracks in scope for it.
 */
export function useTrackStatsByTarget(targetType: RatingTargetType) {
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
  const ranked = new Map<string, { stats: RatingAverage; rank: number }>()

  for (const item of ratingAverages) {
    const rank = criterionRank.get(item.criterionId)
    if (item.targetType !== targetType || rank === undefined) {
      continue
    }

    const current = ranked.get(item.targetId)
    if (!current || rank < current.rank) {
      ranked.set(item.targetId, { stats: item, rank })
    }
  }

  return new Map([...ranked].map(([targetId, { stats }]) => [targetId, stats]))
}

/** Sorts by track average or track count; targets without an average go last. */
export function sortByTrackStats<T extends { id: string }>(
  records: T[],
  stats: Map<string, RatingAverage>,
  sort: TrackStatSort,
) {
  const descending = sort === 'averageHighest' || sort === 'tracksMost'
  const byAverage = sort === 'averageHighest' || sort === 'averageLowest'
  const valueOf = (record: T) => {
    const item = stats.get(record.id)
    if (byAverage) {
      return item && item.ratedTrackCount > 0 ? item.average : undefined
    }

    return item?.trackCount ?? 0
  }

  return [...records].sort((left, right) => {
    const leftValue = valueOf(left)
    const rightValue = valueOf(right)
    if (leftValue === undefined) return rightValue === undefined ? 0 : 1
    if (rightValue === undefined) return -1

    return (leftValue - rightValue) * (descending ? -1 : 1)
  })
}
