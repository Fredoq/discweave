import type { EntityRating } from '../catalog/catalogApi'

export function ratingValueFor(
  ratings: EntityRating[] | undefined,
  criterionId: string,
) {
  return ratings?.find((rating) => rating.criterionId === criterionId)?.value
}

export function readRatingColumnIds(storageKey: string) {
  try {
    const storedValue = window.localStorage.getItem(storageKey)

    return storedValue ? (JSON.parse(storedValue) as string[]) : []
  } catch {
    return []
  }
}
