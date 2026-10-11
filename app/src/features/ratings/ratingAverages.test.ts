import { describe, expect, it } from 'vitest'
import type { RatingAverage } from '../catalog/catalogApi'
import { sortByTrackStats } from './ratingAverages'

function stats(
  targetId: string,
  average: number,
  ratedTrackCount: number,
  trackCount: number,
): [string, RatingAverage] {
  return [
    targetId,
    {
      targetType: 'artist',
      targetId,
      criterionId: 'overall',
      average,
      ratedTrackCount,
      trackCount,
    },
  ]
}

describe('sortByTrackStats', () => {
  const records = [
    { id: 'low' },
    { id: 'none' },
    { id: 'unrated' },
    { id: 'high' },
  ]
  const byTarget = new Map([
    stats('low', 2.5, 2, 9),
    stats('unrated', 0, 0, 4),
    stats('high', 4.75, 1, 1),
  ])
  const ids = (sort: Parameters<typeof sortByTrackStats>[2]) =>
    sortByTrackStats(records, byTarget, sort).map((record) => record.id)

  it('ranks by average and keeps targets without rated tracks last', () => {
    expect(ids('averageHighest')).toEqual(['high', 'low', 'none', 'unrated'])
    expect(ids('averageLowest')).toEqual(['low', 'high', 'none', 'unrated'])
  })

  it('ranks by the number of tracks in scope', () => {
    expect(ids('tracksMost')).toEqual(['low', 'unrated', 'high', 'none'])
    expect(ids('tracksFewest')).toEqual(['none', 'high', 'unrated', 'low'])
  })
})
