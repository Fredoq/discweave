import { describe, expect, it } from 'vitest'
import { sortByTrackAverage } from './ratingAverages'

describe('sortByTrackAverage', () => {
  const records = [{ id: 'low' }, { id: 'none' }, { id: 'high' }]
  const averages = new Map([
    ['low', 2.5],
    ['high', 4.75],
  ])

  it('ranks by average and keeps targets without one last', () => {
    expect(
      sortByTrackAverage(records, averages, 'averageHighest').map(
        (record) => record.id,
      ),
    ).toEqual(['high', 'low', 'none'])
    expect(
      sortByTrackAverage(records, averages, 'averageLowest').map(
        (record) => record.id,
      ),
    ).toEqual(['low', 'high', 'none'])
  })
})
