import { describe, expect, it } from 'vitest'
import {
  catalogPrefixOptions,
  catalogSearchKey,
  hasCatalogNumber,
  filterDiscogsCatalog,
  suggestedCatalogPrefix,
} from './labelDiscogsModel'
import type { LabelDiscogsRelease } from './labelDiscogsApi'

const item = (
  externalId: string,
  catalogNumber: string,
): LabelDiscogsRelease => ({
  externalId,
  catalogNumber,
  artist: 'Shed',
  title: 'The Killer',
  year: 2012,
  format: 'LP',
  matchKind: 'unmatched',
  matches: [],
})

describe('Label Discogs catalog numbers', () => {
  it('normalizes spacing and case for search without changing source numbers', () => {
    const original = item('1', 'ABC 001')
    expect(catalogSearchKey('abc-001')).toBe('ABC001')
    expect(filterDiscogsCatalog([original], [], 'abc001')).toEqual([original])
    expect(original.catalogNumber).toBe('ABC 001')
  })
  it('keeps numeric brand prefixes and does not expand abbreviations', () => {
    expect(suggestedCatalogPrefix('50WEAPONSLP08')).toBe('50WEAPONSLP')
    expect(suggestedCatalogPrefix('50WLP08')).toBe('50WLP')
    expect(suggestedCatalogPrefix('FIFTY WEAPONS #001')).toBe('FIFTYWEAPONS')
    expect(catalogSearchKey('50WEAPONSLP08')).not.toBe(
      catalogSearchKey('50WLP08'),
    )
  })
  it('naturally sorts numbers and preserves separate editions and missing-number entries', () => {
    const rows = [
      item('10', 'ABC10'),
      item('2', 'ABC2'),
      item('1', 'ABC 2'),
      item('4', 'none'),
      item('5', ''),
    ]
    expect(
      filterDiscogsCatalog(rows, [], '').map((row) => row.externalId),
    ).toEqual(['1', '2', '10', '5', '4'])
    expect(
      filterDiscogsCatalog(rows, ['ABC'], '').map((row) => row.externalId),
    ).toEqual(['1', '2', '10'])
    expect(filterDiscogsCatalog(rows, [], '')).toHaveLength(5)
  })
  it('treats punctuation-only values as unnumbered without discarding their source values', () => {
    const punctuation = item('1', '---')
    const numbered = item('2', 'ABC1')
    for (const value of ['---', ' / ', '…', 'NONE', '']) {
      expect(hasCatalogNumber(value)).toBe(false)
      expect(suggestedCatalogPrefix(value)).toBe('')
    }
    expect(filterDiscogsCatalog([punctuation, numbered], [], '')).toEqual([
      numbered,
      punctuation,
    ])
    expect(filterDiscogsCatalog([punctuation, numbered], ['ABC'], '')).toEqual([
      numbered,
    ])
    expect(punctuation.catalogNumber).toBe('---')
    expect(hasCatalogNumber('50WEAPONS 001')).toBe(true)
  })
  it('supports multiple prefixes while retaining selected prefixes absent from loaded pages', () => {
    const rows = [
      item('1', '50WEAPONSLP08'),
      item('2', '50WLP08'),
      item('3', 'GROOVE 141'),
    ]
    expect(
      filterDiscogsCatalog(rows, ['50WEAPONS', '50WLP'], '').map(
        (row) => row.externalId,
      ),
    ).toEqual(['1', '2'])
    expect(catalogPrefixOptions(rows, ['OTHER', '50WEAPONS'])).toContainEqual([
      'OTHER',
      0,
    ])
    expect(catalogPrefixOptions(rows, ['OTHER', '50WEAPONS'])).toContainEqual([
      '50WEAPONS',
      1,
    ])
  })
  it('searches artist title year and format among loaded rows', () => {
    const rows = [item('1', 'ABC001')]
    for (const term of ['shed', 'killer', '2012', 'lp'])
      expect(filterDiscogsCatalog(rows, [], term)).toHaveLength(1)
    expect(filterDiscogsCatalog(rows, [], 'missing')).toHaveLength(0)
  })
})
