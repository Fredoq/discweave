export type MediaType = 'Digital' | 'Vinyl' | 'CD' | 'Cassette' | 'Other'

export type OwnershipStatus = 'Owned' | 'Wanted' | 'Sold' | 'Needs digitization'

export type ExportFormat = 'JSON' | 'CSV'

export type MetadataPolicy =
  | 'Prefer embedded file tags'
  | 'Prefer existing catalog metadata'
  | 'Review conflicts manually'

export type SettingsState = {
  collectionName: string
  ownerLabel: string
  defaultMediaType: MediaType
  defaultOwnershipStatus: OwnershipStatus
  exportFormats: ExportFormat[]
  metadataPolicy: MetadataPolicy
  privateCollection: boolean
}

export type SettingCategory =
  | 'Collection identity'
  | 'Metadata defaults'
  | 'Import and export preferences'
  | 'Privacy and access'
  | 'Dangerous actions'

export type SettingRecord = {
  id: string
  name: string
  category: SettingCategory
  currentValue: string
  policyText: string
  searchTerms: string[]
}

export const mediaTypeOptions: MediaType[] = [
  'Digital',
  'Vinyl',
  'CD',
  'Cassette',
  'Other',
]

export const ownershipStatusOptions: OwnershipStatus[] = [
  'Owned',
  'Wanted',
  'Sold',
  'Needs digitization',
]

export const exportFormatOptions: ExportFormat[] = ['JSON', 'CSV']

export const metadataPolicyOptions: MetadataPolicy[] = [
  'Prefer embedded file tags',
  'Prefer existing catalog metadata',
  'Review conflicts manually',
]

export const initialSettingsState: SettingsState = {
  collectionName: 'Default collection',
  ownerLabel: 'Local owner account',
  defaultMediaType: 'Digital',
  defaultOwnershipStatus: 'Owned',
  exportFormats: ['JSON', 'CSV'],
  metadataPolicy: 'Prefer embedded file tags',
  privateCollection: true,
}

export function buildSettingRecords(state: SettingsState): SettingRecord[] {
  return [
    {
      id: 'collection-name',
      name: 'Collection name',
      category: 'Collection identity',
      currentValue: state.collectionName,
      policyText:
        'The default music collection is resolved from the signed-in local account.',
      searchTerms: ['default collection name', 'identity', 'archive'],
    },
    {
      id: 'local-account',
      name: 'Owner account',
      category: 'Collection identity',
      currentValue: state.ownerLabel,
      policyText:
        'Local cookie authentication is assumed until the API workflow is connected.',
      searchTerms: ['local account', 'owner', 'auth', 'authentication'],
    },
    {
      id: 'default-media-type',
      name: 'Default media type',
      category: 'Metadata defaults',
      currentValue: state.defaultMediaType,
      policyText:
        'New manual entries start with this medium and can be changed per owned item.',
      searchTerms: [
        'media type',
        'medium',
        'digital',
        'vinyl',
        'cd',
        'cassette',
      ],
    },
    {
      id: 'default-ownership-status',
      name: 'Default ownership status',
      category: 'Metadata defaults',
      currentValue: state.defaultOwnershipStatus,
      policyText:
        'New owned items use this ownership status until the collector chooses another state.',
      searchTerms: [
        'ownership status',
        'owned',
        'wanted',
        'sold',
        'needs digitization',
      ],
    },
    {
      id: 'metadata-policy',
      name: 'Metadata policy',
      category: 'Metadata defaults',
      currentValue: state.metadataPolicy,
      policyText: 'Prefer embedded file tags during local folder scans.',
      searchTerms: [
        'file metadata policy',
        'id3',
        'flac',
        'vorbis',
        'tags',
        'local files',
      ],
    },
    {
      id: 'preferred-export-formats',
      name: 'Preferred export formats',
      category: 'Import and export preferences',
      currentValue: state.exportFormats.join(', '),
      policyText:
        'Export preferences are saved as configuration only; no export workflow runs here.',
      searchTerms: ['json', 'csv', 'portable export', 'backup'],
    },
    {
      id: 'import-deduplication',
      name: 'Import deduplication',
      category: 'Import and export preferences',
      currentValue: 'Match path and audio tags',
      policyText:
        'Folder imports should be idempotent when the backend import workflow is added.',
      searchTerms: ['import', 'folder scan', 'dedupe', 'idempotent'],
    },
    {
      id: 'privacy-mode',
      name: 'Privacy mode',
      category: 'Privacy and access',
      currentValue: state.privateCollection
        ? 'Private collection'
        : 'Local mock public flag',
      policyText:
        'Collection data stays private to the active local account; normal routes do not expose collection ids.',
      searchTerms: [
        'privacy',
        'private',
        'access',
        'collection isolation',
        'local account',
      ],
    },
    {
      id: 'dangerous-actions-gate',
      name: 'Dangerous actions gate',
      category: 'Dangerous actions',
      currentValue: 'Disabled without confirmation',
      policyText:
        'Dangerous actions are represented only as gated mock controls and never delete data.',
      searchTerms: ['dangerous', 'delete', 'reset', 'confirmation', 'disabled'],
    },
  ]
}
