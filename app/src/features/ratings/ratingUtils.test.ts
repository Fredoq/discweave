import { describe, expect, it } from 'vitest'
import { ratingLabel, ratingStepFill } from './ratingUtils'

describe('rating meter helpers', () => {
  it('fills bars proportionally for a fractional average', () => {
    expect([1, 2, 3, 4, 5].map((step) => ratingStepFill(3.87, step))).toEqual([
      1,
      1,
      1,
      expect.closeTo(0.87, 5),
      0,
    ])
    expect(ratingStepFill(undefined, 1)).toBe(0)
  })

  it('labels unrated, rated and standout values', () => {
    expect(ratingLabel(undefined)).toBe('Unrated')
    expect(ratingLabel(4)).toBe('4 of 5')
    expect(ratingLabel(5, true)).toBe('5 of 5, standout')
  })
})
