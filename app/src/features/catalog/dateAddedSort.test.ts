import { expect, it, vi } from 'vitest'
import {
  dateAdded,
  sortByDateAdded,
  readSavedDateAddedSort,
  saveDateAddedSort,
} from './dateAddedSort'

it('uses explicit dates and UUIDv7 time while leaving unknown dates last without mutating input', () => {
  const records = [
    { id: 'legacy' },
    { id: '01990000-0000-7000-8000-000000000001' },
    { id: 'uuid4', createdAt: '2020-01-01T00:00:00Z' },
    { id: '01990000-0000-4000-8000-000000000001', createdAt: 'invalid' },
    { id: 'same-time', recordId: '01990000-0000-7fff-bfff-ffffffffffff' },
  ]
  expect(dateAdded(records[1])).toBe(0x019900000000)
  expect(dateAdded(records[3])).toBeNull()
  expect(sortByDateAdded(records, 'addedNewest', dateAdded)).toEqual([
    records[1],
    records[4],
    records[2],
    records[0],
    records[3],
  ])
  expect(sortByDateAdded(records, 'addedOldest', dateAdded)).toEqual([
    records[2],
    records[1],
    records[4],
    records[0],
    records[3],
  ])
  expect(sortByDateAdded(records, 'default', dateAdded)).toBe(records)
  expect(records[0].id).toBe('legacy')
})

it('ignores invalid saved sort values and tolerates unavailable storage', () => {
  window.localStorage.setItem('discweave.sort.test', 'invalid')
  expect(readSavedDateAddedSort('test')).toBe('default')
  const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Storage unavailable')
  })
  const write = vi
    .spyOn(Storage.prototype, 'setItem')
    .mockImplementation(() => {
      throw new Error('Storage unavailable')
    })
  try {
    expect(readSavedDateAddedSort('test')).toBe('default')
    expect(() => saveDateAddedSort('test', 'addedNewest')).not.toThrow()
  } finally {
    read.mockRestore()
    write.mockRestore()
    window.localStorage.removeItem('discweave.sort.test')
  }
})
