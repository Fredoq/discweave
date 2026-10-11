import type { EntityRating } from '../catalog/catalogApi'

export function ratingFor(
  ratings: EntityRating[] | undefined,
  criterionId: string,
) {
  return ratings?.find((rating) => rating.criterionId === criterionId)
}

export function readRatingColumnIds(storageKey: string) {
  try {
    const storedValue = window.localStorage.getItem(storageKey)

    return storedValue ? (JSON.parse(storedValue) as string[]) : []
  } catch {
    return []
  }
}

export const ratingSteps = [1, 2, 3, 4, 5]

/** How much of the given step a possibly fractional value fills, from 0 to 1. */
export function ratingStepFill(value: number | undefined, step: number) {
  return Math.min(1, Math.max(0, (value ?? 0) - (step - 1)))
}

export function ratingLabel(value: number | undefined, standout = false) {
  if (value === undefined) {
    return 'Unrated'
  }

  return standout ? `${value} of 5, standout` : `${value} of 5`
}
