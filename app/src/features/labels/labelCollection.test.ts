import { describe, expect, it } from 'vitest'
import {
  labelCollectionItems,
  labelCollectionLabels,
  labelCollectionReleases,
} from '../../test/labelCollectionFixtures'
import {
  buildLabelSummaries,
  filterLabelReleases,
  labelSearchText,
} from './labelCollection'

function summaries() {
  return buildLabelSummaries(
    labelCollectionLabels,
    labelCollectionReleases,
    labelCollectionItems,
  )
}

describe('label collection overview', () => {
  it('counts releases rather than copies and allows owned and wanted to overlap', () => {
    const [label] = summaries()
    expect(label.releases).toHaveLength(7)
    expect(label.ownedItems).toHaveLength(8)
    expect(
      filterLabelReleases(label.releases, 'inCollection', '').map(
        (release) => release.id,
      ),
    ).toEqual(['owned', 'both', 'digitize'])
    expect(
      filterLabelReleases(label.releases, 'wanted', '').map(
        (release) => release.id,
      ),
    ).toEqual(['wanted', 'both'])
    expect(
      label.releases.find((release) => release.id === 'owned')?.statuses,
    ).toEqual(['Owned'])
  })

  it('keeps sold, unclassified and metadata-only releases out of owned and wanted filters', () => {
    const [label] = summaries()
    for (const id of ['sold', 'reference', 'unknown']) {
      expect(label.releases.find((release) => release.id === id)).toMatchObject(
        { inCollection: false, wanted: false },
      )
    }
    expect(
      label.releases.find((release) => release.id === 'sold')?.statuses,
    ).toEqual(['Sold'])
    expect(
      label.releases.find((release) => release.id === 'reference')?.statuses,
    ).toEqual([])
  })

  it('scopes every catalog number to the selected label without duplicating a release', () => {
    const [archive, second] = summaries()
    expect(archive.releases[0].catalogNumbers).toEqual(['ARC 002', 'ARC 003'])
    expect(second.releases).toHaveLength(1)
    expect(second.releases[0].catalogNumbers).toEqual(['OTHER 100'])
    expect(labelSearchText(archive)).not.toContain('other 100')
    expect(filterLabelReleases(archive.releases, 'all', 'other 100')).toEqual(
      [],
    )
  })

  it('supports legacy names and distinguishes absent from explicitly missing catalog numbers', () => {
    const [label] = summaries()
    expect(
      label.releases.find((release) => release.id === 'unknown')
        ?.catalogNumbers,
    ).toEqual(['Not recorded'])
    expect(
      label.releases.find((release) => release.id === 'reference')
        ?.catalogNumbers,
    ).toEqual(['Not recorded'])
    expect(
      label.releases.find((release) => release.id === 'both')?.catalogNumbers,
    ).toEqual(['No catalog number'])
  })

  it('combines trimmed case-insensitive search and collection status', () => {
    const [label] = summaries()
    for (const query of ['  aRC 004  ', 'Future Find Artist', 'Future Find']) {
      expect(
        filterLabelReleases(label.releases, 'wanted', query).map(
          (release) => release.id,
        ),
      ).toEqual(['wanted'])
    }
    expect(
      filterLabelReleases(label.releases, 'inCollection', 'ARC 004'),
    ).toEqual([])
    expect(filterLabelReleases(label.releases, 'all', '1991')).toHaveLength(6)
  })

  it('uses linked collection items rather than inferring ownership from release metadata', () => {
    const [label] = buildLabelSummaries(
      labelCollectionLabels,
      labelCollectionReleases,
      [],
    )
    expect(filterLabelReleases(label.releases, 'inCollection', '')).toEqual([])
    expect(filterLabelReleases(label.releases, 'wanted', '')).toEqual([])
  })
})
