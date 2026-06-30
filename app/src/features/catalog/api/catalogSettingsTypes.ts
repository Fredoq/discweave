export type DictionaryKind =
  | 'releaseType'
  | 'creditRole'
  | 'genre'
  | 'mediaType'
  | 'artistRelationType'
  | 'trackRelationType'

export type DictionaryEntry = {
  id: string
  kind: DictionaryKind
  code: string
  name: string
  sortOrder: number
  isActive: boolean
  isBuiltin: boolean
  isProtected: boolean
  mediaProfile?: string | null
}

export type CatalogDictionaries = Record<DictionaryKind, DictionaryEntry[]>

export type RatingTargetType = 'artist' | 'release' | 'track' | 'label'

export type RatingCriterion = {
  id: string
  code: string
  name: string
  targetTypes: RatingTargetType[]
  sortOrder: number
  isActive: boolean
  isBuiltin: boolean
  isProtected: boolean
}

export type EntityRating = {
  id: string
  criterionId: string
  targetType: RatingTargetType
  targetId: string
  value: number
}

export type ImportPatternKind = 'releaseFolder' | 'trackFile'

export type ImportPattern = {
  id: string
  kind: ImportPatternKind
  template: string
  sortOrder: number
  isActive: boolean
  isBuiltin: boolean
}

export type ImportPatternRequest = {
  kind: ImportPatternKind
  template: string
  sortOrder?: number
  isActive?: boolean
}

export type NamingProfile = {
  id: string
  name: string
  releaseFolderTemplate: string
  trackFileTemplate: string
  trackFileWithArtistTemplate: string
  sortOrder: number
  isDefault: boolean
  isActive: boolean
  isBuiltin: boolean
}

export type NamingProfileRequest = {
  name: string
  releaseFolderTemplate: string
  trackFileTemplate: string
  trackFileWithArtistTemplate: string
  sortOrder?: number
  isDefault?: boolean
  isActive?: boolean
}

export type TagRoleMapping = {
  id: string
  creditRoleCode: string
  tagField: string
  sortOrder: number
  isActive: boolean
  isBuiltin: boolean
}

export type TagRoleMappingRequest = {
  creditRoleCode: string
  tagField: string
  sortOrder?: number
  isActive?: boolean
}

export type TrackRelationParserRuleMatchMode = 'exactLastParentheticalToken'

export type TrackRelationParserRuleDirection = 'variantToBase' | 'baseToVariant'

export type TrackRelationParserRule = {
  id: string
  relationTypeCode: string
  alias: string
  matchMode: TrackRelationParserRuleMatchMode
  confidence: number
  direction: TrackRelationParserRuleDirection
  sortOrder: number
  isActive: boolean
  isBuiltin: boolean
}

export type TrackRelationParserRuleRequest = {
  relationTypeCode: string
  alias: string
  matchMode: TrackRelationParserRuleMatchMode
  confidence: number
  direction: TrackRelationParserRuleDirection
  sortOrder?: number
  isActive?: boolean
}

export type TrackStackSettings = {
  defaultRelationTypeCodes: string[]
}

export type TrackStackSettingsRequest = {
  defaultRelationTypeCodes: string[]
}

export type ReleaseNamingOverride = {
  releaseId: string
  namingProfileId?: string | null
  releaseFolderTemplate?: string | null
  trackFileTemplate?: string | null
  trackFileWithArtistTemplate?: string | null
  source?: string | null
}

export type ReleaseNamingOverrideRequest = {
  namingProfileId?: string | null
  releaseFolderTemplate?: string | null
  trackFileTemplate?: string | null
  trackFileWithArtistTemplate?: string | null
  source?: string | null
}

export type ImportPatternTestResult = {
  matched: boolean
  fields: Record<string, string | null>
  issues: string[]
}

export type DiscogsIntegrationStatus = {
  providerName: 'discogs'
  enabled: boolean
  configured: boolean
}

export type ExportRestoreResponse = {
  restored: boolean
  formatVersion: number
  artists: number
  labels: number
  releases: number
  tracks: number
  ownedItems: number
  playlists: number
  credits: number
  artistRelations: number
  trackRelations: number
  dictionaries: number
  importPatterns: number
  namingProfiles: number
  releaseNamingOverrides: number
  ratingCriteria: number
  ratings: number
}
