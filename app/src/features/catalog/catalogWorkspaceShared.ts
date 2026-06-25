import type { CatalogSearchResult, SearchEntityType } from './catalogApi'
import {
  uniqueValues,
  type CatalogEntry,
  type CatalogEntityType,
} from './catalogGraph'

export const savedViewDefinitions = [
  { label: 'All', urlValue: 'all', apiSavedView: 'all' },
  {
    label: 'Owned',
    urlValue: 'owned',
    apiSavedView: 'all',
    status: 'owned',
  },
  {
    label: 'Physical without digital',
    urlValue: 'physicalWithoutDigital',
    apiSavedView: 'physicalWithoutDigital',
  },
  {
    label: 'Lossy without lossless',
    urlValue: 'lossyWithoutLossless',
    apiSavedView: 'lossyWithoutLossless',
  },
  {
    label: 'Wanted not owned',
    urlValue: 'wantedNotOwned',
    apiSavedView: 'wantedNotOwned',
  },
  {
    label: 'Needs digitization',
    urlValue: 'needsDigitization',
    apiSavedView: 'needsDigitization',
  },
  { label: 'Credits', urlValue: 'credits', apiSavedView: 'credits' },
  { label: 'Remixes', urlValue: 'remixes', apiSavedView: 'remixes' },
  {
    label: 'Productions',
    urlValue: 'productions',
    apiSavedView: 'productions',
  },
  { label: 'Labels', urlValue: 'labels', apiSavedView: 'labels' },
] as const

export type SavedViewDefinition = (typeof savedViewDefinitions)[number]
export type SavedView = SavedViewDefinition['label']

export type CatalogFilters = {
  entityType: '' | CatalogEntityType
  media: string
  status: string
  role: string
  label: string
  tag: string
  format: string
}

export const savedViews: SavedView[] = savedViewDefinitions.map(
  (definition) => definition.label,
)

export const emptyFilters: CatalogFilters = {
  entityType: '',
  media: '',
  status: '',
  role: '',
  label: '',
  tag: '',
  format: '',
}

export type ServerCatalogFilters = {
  entityType: '' | SearchEntityType
  media: string
  status: string
  role: string
  labelId: string
  tag: string
}

export const emptyServerFilters: ServerCatalogFilters = {
  entityType: '',
  media: '',
  status: '',
  role: '',
  labelId: '',
  tag: '',
}

export const serverFilterOptions = {
  entityTypes: ['artist', 'release', 'track', 'ownedItem', 'label', 'playlist'],
  media: ['digital', 'vinyl', 'cd', 'cassette', 'other'],
  statuses: ['owned', 'wanted', 'sold', 'needsDigitization'],
  roles: [
    'mainArtist',
    'featuredArtist',
    'remixer',
    'producer',
    'composer',
    'performer',
    'engineer',
  ],
}

export function parseCatalogSearchParams(locationSearch: string) {
  const params = new URLSearchParams(locationSearch)
  const savedView = params.get('savedView') ?? ''

  return {
    query: params.get('query') ?? params.get('q') ?? '',
    activeView: viewFromSavedView(savedView),
    filters: {
      entityType: readEntityType(params.get('entityType')),
      media: params.get('media') ?? '',
      status: params.get('status') ?? '',
      role: params.get('role') ?? '',
      labelId: params.get('labelId') ?? '',
      tag: params.get('tag') ?? '',
    },
  }
}

export function buildCatalogUrl(
  query: string,
  view: SavedView,
  filters: ServerCatalogFilters,
) {
  const params = new URLSearchParams()
  const trimmedQuery = query.trim()

  if (trimmedQuery) {
    params.set('query', trimmedQuery)
  }
  if (view !== 'All') {
    params.set('savedView', savedViewFromView(view))
  }
  if (filters.entityType) {
    params.set('entityType', filters.entityType)
  }
  if (filters.media) {
    params.set('media', filters.media)
  }
  if (filters.status) {
    params.set('status', filters.status)
  }
  if (filters.role) {
    params.set('role', filters.role)
  }
  if (filters.labelId) {
    params.set('labelId', filters.labelId)
  }
  if (filters.tag) {
    params.set('tag', filters.tag)
  }

  const search = params.toString()
  return search ? `/catalog?${search}` : '/catalog'
}

export function serverSavedViewParams(view: SavedView) {
  const definition = savedViewDefinition(view)

  return {
    savedView: definition.apiSavedView,
    status: 'status' in definition ? definition.status : undefined,
  }
}

export function savedViewFromView(view: SavedView) {
  return savedViewDefinition(view).urlValue
}

export function viewFromSavedView(savedView: string): SavedView {
  const normalizedSavedView = savedView.trim().toLowerCase()

  return (
    savedViewDefinitions.find(
      (definition) => definition.urlValue.toLowerCase() === normalizedSavedView,
    )?.label ?? 'All'
  )
}

export function savedViewDefinition(view: SavedView) {
  return (
    savedViewDefinitions.find((definition) => definition.label === view) ??
    savedViewDefinitions[0]
  )
}

export function readEntityType(
  value: string | null,
): ServerCatalogFilters['entityType'] {
  return serverFilterOptions.entityTypes.includes(value ?? '')
    ? (value as SearchEntityType)
    : ''
}

export function resultKey(result: CatalogSearchResult | undefined) {
  return result ? `${result.type}:${result.id}` : ''
}

export function displayEntityType(type: SearchEntityType) {
  switch (type) {
    case 'artist':
      return 'Artist'
    case 'release':
      return 'Release'
    case 'track':
      return 'Track'
    case 'ownedItem':
      return 'Owned item'
    case 'label':
      return 'Label'
    case 'playlist':
      return 'Playlist'
  }
}

export function buildFilterOptions(entries: CatalogEntry[]) {
  return {
    entityTypes: uniqueValues(entries.map((entry) => entry.type)),
    media: uniqueValues(entries.flatMap((entry) => entry.media)),
    statuses: uniqueValues(entries.flatMap((entry) => entry.statuses)),
    roles: uniqueValues(entries.flatMap((entry) => entry.credits)),
    labels: uniqueValues(entries.map((entry) => entry.label)),
    tags: uniqueValues(entries.flatMap((entry) => entry.tags)),
    formats: uniqueValues(entries.map((entry) => entry.fileFormat)).filter(
      (format) => format !== 'Not recorded',
    ),
  }
}

export function matchesSavedView(entry: CatalogEntry, view: SavedView) {
  switch (view) {
    case 'All':
      return true
    case 'Owned':
      return entry.statuses.includes('Owned')
    case 'Physical without digital':
      return (
        entry.media.some(isPhysicalMedium) &&
        !entry.media.some(isDigitalMedium) &&
        !isDigitalMedium(entry.fileFormat)
      )
    case 'Lossy without lossless':
      return (
        isLossyFileFormat(entry.fileFormat) &&
        !isLosslessFileFormat(entry.fileFormat)
      )
    case 'Wanted not owned':
      return (
        entry.statuses.includes('Wanted') && !entry.statuses.includes('Owned')
      )
    case 'Needs digitization':
      return entry.statuses.includes('Needs digitization')
    case 'Credits':
      return entry.credits.length > 0 || entry.type === 'Relation'
    case 'Remixes':
      return entry.credits.some((credit) => /remix/i.test(credit))
    case 'Productions':
      return entry.credits.some((credit) => /producer|production/i.test(credit))
    case 'Labels':
      return (
        (entry.type === 'Release' || entry.type === 'Track') &&
        entry.label !== 'Not recorded'
      )
  }
}

function isDigitalMedium(medium: string) {
  const tokens = mediumLabelTokens(medium)

  return tokens.some((token) => DIGITAL_MEDIUM_TOKENS.has(token))
}

function isPhysicalMedium(medium: string) {
  const normalizedMedium = normalizeMediumLabel(medium)
  const tokens = mediumLabelTokens(medium)

  return (
    tokens.some((token) => PHYSICAL_MEDIUM_TOKENS.has(token)) ||
    normalizedMedium.includes('compact disc') ||
    /(^|[^a-z0-9])(?:\d+\s*x\s*)?cds?($|[^a-z0-9])/.test(normalizedMedium)
  )
}

function mediumLabelTokens(label: string) {
  return normalizeMediumLabel(label)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

function normalizeMediumLabel(label: string) {
  return label.trim().toLowerCase()
}

const DIGITAL_MEDIUM_TOKENS = new Set([
  'aac',
  'aiff',
  'alac',
  'digital',
  'download',
  'downloads',
  'file',
  'files',
  'flac',
  'folder',
  'm4a',
  'mp3',
  'ogg',
  'wav',
])

const PHYSICAL_MEDIUM_TOKENS = new Set([
  'cassette',
  'cd',
  'lp',
  'other',
  'record',
  'records',
  'tape',
  'tapes',
  'vinyl',
])

function isLossyFileFormat(format: string) {
  return ['mp3', 'ogg', 'm4a'].includes(format.trim().toLowerCase())
}

function isLosslessFileFormat(format: string) {
  return ['flac', 'wav', 'aiff', 'alac'].includes(format.trim().toLowerCase())
}

export function matchesFilters(entry: CatalogEntry, filters: CatalogFilters) {
  return (
    (!filters.entityType || entry.type === filters.entityType) &&
    (!filters.media || entry.media.includes(filters.media)) &&
    (!filters.status || entry.statuses.includes(filters.status)) &&
    (!filters.role || entry.credits.includes(filters.role)) &&
    (!filters.label || entry.label === filters.label) &&
    (!filters.tag || entry.tags.includes(filters.tag)) &&
    (!filters.format || entry.fileFormat === filters.format)
  )
}
