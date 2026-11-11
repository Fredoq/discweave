import {
  ownedItemRecords,
  type OwnedItemRecord,
} from '../features/ownedItems/ownedItemsData'
import type { ReleaseRecord } from '../features/releases/releasesData'

export const labelCollectionLabels = [
  { id: 'archive-editions', name: 'Archive Editions' },
  { id: 'second-label', name: 'Second Label' },
  { id: 'empty-label', name: 'Empty Label' },
]

function release(
  id: string,
  title: string,
  catalogNumber?: string,
): ReleaseRecord {
  return {
    id,
    title,
    artist: `${title} Artist`,
    year: '1991',
    type: 'Album',
    label: 'Archive Editions',
    labels: [
      {
        labelId: 'archive-editions',
        name: 'Archive Editions',
        catalogNumber,
        hasNoCatalogNumber: false,
      },
    ],
    genres: [],
    tags: [],
    releaseNotes: '',
    ownedCopies: [],
  }
}

export const labelCollectionReleases: ReleaseRecord[] = [
  {
    ...release('owned', 'Archive One', 'ARC 002'),
    labels: [
      {
        labelId: 'archive-editions',
        name: 'Archive Editions',
        catalogNumber: 'ARC 002',
        hasNoCatalogNumber: false,
      },
      {
        labelId: 'archive-editions',
        name: 'Archive Editions',
        catalogNumber: 'ARC 003',
        hasNoCatalogNumber: false,
      },
      {
        labelId: 'second-label',
        name: 'Second Label',
        catalogNumber: 'OTHER 100',
        hasNoCatalogNumber: false,
      },
    ],
  },
  release('wanted', 'Future Find', 'ARC 004'),
  {
    ...release('both', 'Another Edition'),
    labels: [
      {
        labelId: 'archive-editions',
        name: 'Archive Editions',
        hasNoCatalogNumber: true,
      },
    ],
  },
  release('digitize', 'Tape Transfer', 'ARC 005'),
  release('sold', 'Past Copy', 'ARC 006'),
  { ...release('reference', 'Catalog Reference'), artist: '', year: '' },
  {
    ...release('unknown', 'Unclassified Copy'),
    label: '  ARCHIVE EDITIONS  ',
    labels: undefined,
  },
]

function item(
  releaseId: string,
  status: OwnedItemRecord['status'],
  suffix = '',
): OwnedItemRecord {
  const record = labelCollectionReleases.find(
    (entry) => entry.id === releaseId,
  )!
  return {
    ...ownedItemRecords[0],
    id: `${releaseId}-${status}-${suffix}`,
    releaseId,
    targetId: releaseId,
    title: `${record.title} ${status} copy ${suffix}`.trim(),
    releaseTitle: record.title,
    artist: record.artist,
    status,
  }
}

export const labelCollectionItems = [
  item('owned', 'Owned', '1'),
  item('owned', 'Owned', '2'),
  item('wanted', 'Wanted'),
  item('both', 'Owned'),
  item('both', 'Wanted'),
  item('digitize', 'Needs digitization'),
  item('sold', 'Sold'),
  item('unknown', 'Not recorded'),
]

export const labelCollectionFixture = {
  artists: [],
  labels: labelCollectionLabels,
  releases: labelCollectionReleases,
  tracks: [],
  ownedItems: labelCollectionItems,
  relations: [],
  playlists: [],
}
