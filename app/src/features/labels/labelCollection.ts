import { uniqueValues } from '../catalog/catalogGraph'
import type { OwnedItemRecord } from '../ownedItems/ownedItemsData'
import type { ReleaseRecord } from '../releases/releasesData'
import {
  normalizedLabelName,
  releaseCatalogNumberDisplay,
} from '../releases/releaseFormHelpers'
import type { LabelRecord } from './labelsData'

export type LabelCollectionFilter = 'all' | 'inCollection' | 'wanted'

export type LabelRelease = ReleaseRecord & {
  catalogNumbers: string[]
  statuses: string[]
  inCollection: boolean
  wanted: boolean
}

export type LabelSummary = LabelRecord & {
  releases: LabelRelease[]
  ownedItems: OwnedItemRecord[]
  media: string[]
  statuses: string[]
}

export function buildLabelSummaries(
  labels: LabelRecord[],
  releases: ReleaseRecord[],
  ownedItems: OwnedItemRecord[],
): LabelSummary[] {
  const itemsByRelease = new Map<string, OwnedItemRecord[]>()
  for (const item of ownedItems) {
    if (item.releaseId) {
      const items = itemsByRelease.get(item.releaseId) ?? []
      items.push(item)
      itemsByRelease.set(item.releaseId, items)
    }
  }

  return labels.map((label) => {
    const labelReleases = releases
      .filter((release) => releaseHasLabel(release, label))
      .map((release): LabelRelease => {
        const statuses = uniqueValues(
          (itemsByRelease.get(release.id) ?? []).map((item) => item.status),
        )
        const catalogNumbers = uniqueValues(
          (release.labels ?? [])
            .filter((entry) => labelMatches(entry, label))
            .map(releaseCatalogNumberDisplay),
        )

        return {
          ...release,
          catalogNumbers:
            catalogNumbers.length > 0 ? catalogNumbers : ['Not recorded'],
          statuses,
          inCollection:
            statuses.includes('Owned') ||
            statuses.includes('Needs digitization'),
          wanted: statuses.includes('Wanted'),
        }
      })
    const labelItems = labelReleases.flatMap(
      (release) => itemsByRelease.get(release.id) ?? [],
    )

    return {
      ...label,
      releases: labelReleases,
      ownedItems: labelItems,
      media: uniqueValues(labelItems.map((item) => item.medium)),
      statuses: uniqueValues(labelItems.map((item) => item.status)),
    }
  })
}

function labelMatches(
  entry: { labelId?: string; name: string },
  label: LabelRecord,
) {
  return (
    entry.labelId === label.id ||
    normalizedLabelName(entry.name) === normalizedLabelName(label.name)
  )
}

function releaseHasLabel(release: ReleaseRecord, label: LabelRecord) {
  return (
    normalizedLabelName(release.label) === normalizedLabelName(label.name) ||
    (release.labels ?? []).some((entry) => labelMatches(entry, label))
  )
}

export function labelReleaseSearchText(release: LabelRelease) {
  return [
    release.title,
    release.artist,
    release.year,
    ...release.catalogNumbers,
  ]
    .join(' ')
    .toLowerCase()
}

export function labelSearchText(label: LabelSummary) {
  return [
    label.name,
    ...label.releases.map(labelReleaseSearchText),
    ...label.ownedItems.map((item) => item.title),
    ...label.media,
    ...label.statuses,
  ]
    .join(' ')
    .toLowerCase()
}

export function filterLabelReleases(
  releases: LabelRelease[],
  filter: LabelCollectionFilter,
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase()
  return releases.filter(
    (release) =>
      (filter === 'all' || release[filter]) &&
      labelReleaseSearchText(release).includes(normalizedQuery),
  )
}
