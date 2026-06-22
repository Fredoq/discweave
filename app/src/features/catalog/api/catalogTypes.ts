import type { ArtistRecord } from '../../artists/artistsData'
import type { LabelRecord } from '../../labels/labelsData'
import type { OwnedItemRecord } from '../../ownedItems/ownedItemsData'
import type {
  PlaylistRecord,
  SmartPlaylistServerRules,
} from '../../playlists/playlistsData'
import type { ReleaseRecord } from '../../releases/releasesData'
import type { RelationRecord } from '../../relations/relationsData'
import type { TrackRecord } from '../../tracks/tracksData'
import type { ExternalSourceReference } from './externalMetadataClient'
import type { TrackDigitalFileDto } from './releaseOwnedFileContracts'

export type {
  CassetteOwnedItemDetailsDto,
  CdOwnedItemDetailsDto,
  DigitalFileCoverageDto,
  DigitalOwnedItemDetailsDto,
  LocalAudioFileDto,
  LocalAudioFileUpdateRequest,
  MediumDto,
  OtherOwnedItemDetailsDto,
  OwnedItemDetailsDto,
  OwnedItemDto,
  OwnedItemReleaseDto,
  OwnedItemTargetDto,
  OwnedItemTargetType,
  TrackDigitalFileDto,
  VinylOwnedItemDetailsDto,
} from './releaseOwnedFileContracts'

export const pageSize = 100

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

export type TagRoleMappingTagField = string

export type TagRoleMapping = {
  id: string
  creditRoleCode: string
  tagField: TagRoleMappingTagField
  sortOrder: number
  isActive: boolean
  isBuiltin: boolean
}

export type TagRoleMappingRequest = {
  creditRoleCode: string
  tagField: TagRoleMappingTagField
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

export type EntitySuggestion = {
  id: string
  name: string
  match: string
}

export type ImportIssue = {
  code: string
  message: string
  severity: string
}

export type ImportRelationSuggestionDecision =
  | 'pending'
  | 'accepted'
  | 'rejected'

export type ImportRelationSuggestionEndpoint = {
  kind: 'draftTrack' | 'existingTrack'
  id: string
  title?: string | null
}

export type ImportRelationSuggestionPayload = {
  source: ImportRelationSuggestionEndpoint
  target?: ImportRelationSuggestionEndpoint | null
  relationTypeCode?: string | null
}

export type ImportRelationSuggestion = {
  id: string
  draftId: string
  token: string
  confidence: number
  decision: ImportRelationSuggestionDecision
  suggested: ImportRelationSuggestionPayload
  reviewed: ImportRelationSuggestionPayload
  targetOptions: ImportRelationSuggestionEndpoint[]
  isModified: boolean
}

export type ReleaseImportDraftTrack = {
  id: string
  filePath: string
  relativePath: string
  format: string
  sizeBytes: number
  lastModifiedAt: string
  durationSeconds?: number | null
  position?: number | null
  disc?: string | null
  side?: string | null
  title: string
  artistNames: string[]
  artistCredits?: ReleaseImportArtistCredit[]
  inheritReleaseArtistCredits?: boolean
  artistSuggestions: EntitySuggestion[]
  trackSuggestions: EntitySuggestion[]
  isSkipped: boolean
  selectedTrackId?: string | null
  selectedArtistIds: string[]
  issues: ImportIssue[]
  moveHint?: ReleaseImportFileMoveHint | null
}

export type ReleaseImportFileMoveHint = {
  previousPath?: string | null
  matchKind: string
  confidence: string
}

export type ReleaseImportArtistCredit = {
  artistId?: string | null
  name: string
  role: string
}

export type ReleaseImportLabel = {
  labelId?: string | null
  name: string
  catalogNumber?: string | null
  hasNoCatalogNumber: boolean
}

export type ReleaseImportDraft = {
  id: string
  sourcePath: string
  relativePath: string
  status: 'needsReview' | 'ready' | 'confirmed' | 'skipped'
  title: string
  type: string
  catalogNumber?: string | null
  labelName?: string | null
  releaseDate?: string | null
  year?: number | null
  isVariousArtists: boolean
  notOnLabel: boolean
  artistNames: string[]
  artistCredits?: ReleaseImportArtistCredit[]
  selectedArtistIds: string[]
  artistSuggestions: EntitySuggestion[]
  labels?: ReleaseImportLabel[]
  genres: string[]
  tags: string[]
  externalSources?: ExternalSourceReference[]
  coverPath?: string | null
  issues: ImportIssue[]
  tracks: ReleaseImportDraftTrack[]
}

export type ReleaseImportConfirmationPreflight = {
  sessionId: string
  draftId: string
  draftStatus: ReleaseImportDraft['status']
  canConfirm: boolean
  outcome: 'newRelease' | 'exactDuplicate' | 'partialDuplicate' | 'blocked'
  summary: ReleaseImportConfirmationSummary
  actions: ReleaseImportConfirmationAction[]
  tracks: ReleaseImportConfirmationTrackPlan[]
  issues: ImportIssue[]
  blockingErrors: ImportIssue[]
}

export type ReleaseImportConfirmationSummary = {
  includedTrackCount: number
  skippedTrackCount: number
  duplicateTrackCount: number
  newReleases: number
  reusedReleases: number
  updatedReleases: number
  newTracks: number
  reusedTracks: number
  newDigitalOwnedItems: number
  reusedDigitalOwnedItems: number
  newLocalAudioFiles: number
  updatedLocalAudioFiles: number
  newDigitalTrackFileLinks: number
  relinkedDigitalTrackFileLinks: number
  unchangedDigitalTrackFileLinks: number
}

export type ReleaseImportConfirmationAction = {
  kind:
    | 'release'
    | 'track'
    | 'digitalOwnedItem'
    | 'localAudioFile'
    | 'digitalTrackFileLink'
  action: 'create' | 'reuse' | 'update' | 'relink' | 'skip'
  count: number
  label: string
}

export type ReleaseImportConfirmationTrackPlan = {
  draftTrackId: string
  title: string
  position?: number | null
  isSkipped: boolean
  selectedTrackId?: string | null
  trackAction: 'create' | 'reuse' | 'skip'
  localFileAction: 'create' | 'update' | 'skip'
  fileLinkAction: 'create' | 'relink' | 'unchanged' | 'skip'
}

export type ReleaseImportScanDiagnostic = {
  id: string
  code: string
  severity: 'info' | 'warning' | 'error'
  message: string
  filePath: string
  relativePath: string
  extension?: string | null
  sizeBytes?: number | null
  source: string
  createdAt: string
}

export type ReleaseImportScanDiagnosticSummary = {
  code: string
  severity: 'info' | 'warning' | 'error'
  count: number
}

export type ReleaseImportLooseFileCandidate = {
  id: string
  filePath: string
  relativePath: string
  format: string
  sizeBytes: number
  lastModifiedAt: string
  contentHash?: string | null
  durationSeconds?: number | null
  codec?: string | null
  quality?: 'lossless' | 'lossy' | null
  bitrateKbps?: number | null
  sampleRateHz?: number | null
  channels?: number | null
  titleHint?: string | null
  artistHints: string[]
  albumTitleHint?: string | null
  albumArtistHints: string[]
  trackNumber?: number | null
  reason: string
  decision: string
  sourceDraftId?: string | null
  sourceDraftTrackId?: string | null
  createdAt: string
  updatedAt: string
  moveHint?: ReleaseImportFileMoveHint | null
}

export type ReleaseImportSession = {
  id: string
  sourceRoot: string
  status: string
  scanMode?: DesktopImportScanMode | null
  draftCount: number
  trackCount: number
  ignoredFileCount: number
  looseFileCandidateCount: number
  createdAt: string
  updatedAt: string
  diagnostics: ReleaseImportScanDiagnostic[]
  diagnosticSummaries: ReleaseImportScanDiagnosticSummary[]
  looseFileCandidates?: ReleaseImportLooseFileCandidate[] | null
  drafts?: ReleaseImportDraft[] | null
  relationSuggestions?: ImportRelationSuggestion[] | null
}

export type DesktopFolderScanRequest = {
  sourceRoot: string
  scanMode: DesktopImportScanMode
  files: DesktopFolderScanFileRequest[]
  ignoredFileCount: number
  diagnostics: DesktopFolderScanDiagnostic[]
}

export type DesktopImportScanMode = 'full' | 'namesOnly'

export type DesktopFolderScanFileRequest =
  | DesktopAudioScanFileRequest
  | DesktopCoverScanFileRequest

type DesktopScanFileBaseRequest = {
  filePath: string
  relativePath: string
  sizeBytes: number
  lastModifiedAt: string
}

export type DesktopFolderScanDiagnostic = {
  code: string
  severity: 'info' | 'warning' | 'error'
  message: string
  filePath: string
  relativePath: string
  extension: string
  sizeBytes: number | null
  source: string
}

export type DesktopAudioScanFileRequest = DesktopScanFileBaseRequest & {
  format: string
  contentHash: string | null
  audioMetadata: DesktopAudioMetadataRequest | null
  coverArtifact: null
}

export type DesktopCoverScanFileRequest = DesktopScanFileBaseRequest & {
  format: null
  contentHash?: null
  audioMetadata: null
  coverArtifact: DesktopCoverArtifactRequest | null
}

export type DesktopAudioMetadataRequest = {
  title?: string | null
  artists?: string[] | null
  albumTitle?: string | null
  albumArtists?: string[] | null
  catalogNumber?: string | null
  releaseDate?: string | null
  year?: number | null
  durationSeconds?: number | null
  trackNumber?: number | null
  codec?: string | null
  container?: string | null
  lossless?: boolean | null
  bitrateKbps?: number | null
  sampleRateHz?: number | null
  channels?: number | null
}

export type DesktopCoverArtifactRequest = {
  fileName: string
  extension: string
  contentType: string
  sizeBytes: number
  contentBase64: string
}

export type CatalogDictionaries = Record<DictionaryKind, DictionaryEntry[]>

export type CatalogState = {
  artists: ArtistRecord[]
  labels?: LabelRecord[]
  releases: ReleaseRecord[]
  tracks: TrackRecord[]
  ownedItems: OwnedItemRecord[]
  relations: RelationRecord[]
  playlists: PlaylistRecord[]
  dictionaries?: CatalogDictionaries
  ratingCriteria?: RatingCriterion[]
  tagRoleMappings?: TagRoleMapping[]
  trackRelationParserRules?: TrackRelationParserRule[]
  discogsIntegration?: DiscogsIntegrationStatus
  ratings?: EntityRating[]
}

export type ListResponse<T> = {
  items: T[]
  limit: number
  offset: number
  total: number
}

export type ArtistDto = {
  id: string
  type: string
  name: string
  externalSources?: ExternalSourceReference[] | null
}

export type LabelDto = {
  id: string
  name: string
}

export type ReleaseDto = {
  id: string
  title: string
  type: string
  labelId?: string | null
  year?: number | null
  releaseDate?: string | null
  genres: string[]
  tags: string[]
  coverImage?: ReleaseCoverImageDto | null
  isVariousArtists?: boolean
  notOnLabel?: boolean
  artistCredits?: ReleaseArtistCreditDto[]
  labels?: ReleaseLabelDto[]
  tracklist?: ReleaseTracklistItemDto[]
  externalSources?: ExternalSourceReference[] | null
}

export type ReleaseCoverImageDto = {
  url: string
  contentType: string
  originalFileName: string
  sizeBytes: number
  sourceType: string
}

export type ReleaseArtistCreditDto = {
  artistId: string
  artistName: string
  primaryRole?: string
  role?: string
  roles?: string[]
}

export type ReleaseLabelDto = {
  labelId?: string | null
  name: string
  catalogNumber?: string | null
  hasNoCatalogNumber: boolean
}

export type ReleaseTrackLinkedLocalFileDto = {
  localAudioFileId: string
  path: string
  contentHash?: string | null
  format?: string | null
}

export type ReleaseTracklistItemDto = {
  releaseTrackId?: string | null
  trackId: string
  title: string
  position: number
  disc?: string | null
  side?: string | null
  durationSeconds?: number | null
  artistCredits: ReleaseArtistCreditDto[]
  linkedLocalFiles?: ReleaseTrackLinkedLocalFileDto[]
}

export type TrackDto = {
  id: string
  title: string
  durationSeconds?: number | null
  genres: string[]
  tags: string[]
  externalSources?: ExternalSourceReference[] | null
  credits?: TrackCreditDto[]
  releaseAppearances?: TrackReleaseAppearanceDto[]
  digitalFiles?: TrackDigitalFileDto[]
}

export type TrackCreditDto = {
  artistId: string
  artistName: string
  role: string
  roles?: string[]
}

export type TrackReleaseAppearanceDto = {
  releaseId: string
  releaseTitle: string
  releaseArtist: string
  year?: number | null
  label?: string | null
  position: number
  disc?: string | null
  side?: string | null
  durationSeconds?: number | null
}

export type ReleaseTrackContext = {
  release: ReleaseDto
  track: ReleaseTracklistItemDto
}

export type CatalogTargetType = 'release' | 'track'

export type CreditDto = {
  id: string
  contributorArtistId: string
  contributorName: string
  targetType: CatalogTargetType
  targetId: string
  role: string
  roles?: string[]
  targetTitle?: string | null
}

export type ArtistRelationDto = {
  id: string
  sourceArtistId: string
  targetArtistId: string
  type: string
  startYear?: number | null
  endYear?: number | null
  sourceArtistName?: string | null
  targetArtistName?: string | null
}

export type TrackRelationDto = {
  id: string
  sourceTrackId: string
  targetTrackId: string
  type: string
  sourceTrackTitle?: string | null
  targetTrackTitle?: string | null
}

export type DictionaryEntryDto = DictionaryEntry
export type RatingCriterionDto = RatingCriterion
export type RatingValueDto = EntityRating
export type PlaylistEntryKindDto = 'release' | 'track'
export type SmartPlaylistRulesDto = SmartPlaylistServerRules

export type PlaylistItemDto = {
  kind: PlaylistEntryKindDto
  id: string
  title: string
  subtitle?: string | null
}

export type PlaylistDto = {
  id: string
  name: string
  description?: string | null
  type: 'manual' | 'smart'
  rules: SmartPlaylistRulesDto
  entries: PlaylistItemDto[]
  results: PlaylistItemDto[]
}

export type ErrorResponseDto = {
  code?: string | null
  message?: string | null
}

export type {
  CatalogGraphContext,
  CatalogGraphEntity,
  CatalogGraphEntityType,
  CatalogGraphLink,
  CatalogLinkKind,
  CatalogLinkLookupItem,
  CatalogLinkLookupParams,
  CatalogSearchFacets,
  CatalogSearchParams,
  CatalogSearchResult,
  SearchEntityType,
} from './catalogSearchTypes'
