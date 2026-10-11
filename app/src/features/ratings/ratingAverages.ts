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
