import type { AppRoutePath } from './app/routes'

export type ManualEntryCase = {
  action: string
  detailName: string
  form: string
  heading: string
  path: AppRoutePath
  requiredLabel: string
  rowName: RegExp
  searchLabel: string
  secondaryRequiredLabel?: string
  secondaryValue?: string
  value: string
}

export const manualEntryCases: ManualEntryCase[] = [
  {
    path: '/artists',
    heading: 'Artists',
    action: 'Add artist',
    form: 'Add artist',
    requiredLabel: 'Name',
    value: 'Coil Archive Test Artist',
    searchLabel: 'Search artists',
    rowName: /coil archive test artist/i,
    detailName: 'Coil Archive Test Artist',
  },
  {
    path: '/releases',
    heading: 'Releases',
    action: 'Add release',
    form: 'Add release',
    requiredLabel: 'Title',
    value: 'Silent Dub Test Pressing',
    searchLabel: 'Search releases',
    rowName: /silent dub test pressing/i,
    detailName: 'Silent Dub Test Pressing',
  },
  {
    path: '/tracks',
    heading: 'Tracks',
    action: 'Add track',
    form: 'Add track',
    requiredLabel: 'Title',
    value: 'Unlabeled Field Recording',
    searchLabel: 'Search tracks',
    rowName: /unlabeled field recording/i,
    detailName: 'Unlabeled Field Recording',
  },
  {
    path: '/labels',
    heading: 'Labels',
    action: 'Add label',
    form: 'Add label',
    requiredLabel: 'Name',
    value: 'Basement White Label',
    searchLabel: 'Search labels',
    rowName: /basement white label/i,
    detailName: 'Basement White Label',
  },
  {
    path: '/owned-items',
    heading: 'Owned Items',
    action: 'Add owned item',
    form: 'Add owned item',
    requiredLabel: 'Item name',
    value: 'Basement Tape Reference Copy',
    searchLabel: 'Search owned items',
    rowName: /basement tape reference copy/i,
    detailName: 'Basement Tape Reference Copy',
  },
  {
    path: '/relations',
    heading: 'Relations',
    action: 'Add relation',
    form: 'Add relation',
    requiredLabel: 'Source',
    secondaryRequiredLabel: 'Target',
    value: 'Archive Source Person',
    secondaryValue: 'Archive Target Project',
    searchLabel: 'Search relations',
    rowName: /archive source person archive target project/i,
    detailName: 'Archive Source Person to Archive Target Project',
  },
  {
    path: '/playlists',
    heading: 'Playlists',
    action: 'Add playlist',
    form: 'Add playlist',
    requiredLabel: 'Name',
    value: 'Listening Desk Checks',
    searchLabel: 'Search playlists',
    rowName: /listening desk checks/i,
    detailName: 'Listening Desk Checks',
  },
]
