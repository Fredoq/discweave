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

export type ImportPatternTestResult = {
  matched: boolean
  fields: Record<string, string | null>
  issues: string[]
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

export type ReleaseImportDraftTrack = {
  id: string
  filePath: string
  relativePath: string
  format: string
  sizeBytes: number
  lastModifiedAt: string
  durationSeconds?: number | null
  position?: number | null
  title: string
  artistNames: string[]
  artistCredits?: ReleaseImportArtistCredit[]
  artistSuggestions: EntitySuggestion[]
  trackSuggestions: EntitySuggestion[]
  isSkipped: boolean
  selectedTrackId?: string | null
  selectedArtistIds: string[]
  issues: ImportIssue[]
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
  coverPath?: string | null
  issues: ImportIssue[]
  tracks: ReleaseImportDraftTrack[]
}

export type ReleaseImportSession = {
  id: string
  sourceRoot: string
  status: string
  draftCount: number
  trackCount: number
  ignoredFileCount: number
  createdAt: string
  updatedAt: string
  drafts?: ReleaseImportDraft[] | null
}

export type DesktopFolderScanRequest = {
  sourceRoot: string
  files: DesktopFolderScanFileRequest[]
  ignoredFileCount: number
}

export type DesktopFolderScanFileRequest = {
  filePath: string
  relativePath: string
  format?: string | null
  sizeBytes: number
  lastModifiedAt: string
  contentHash?: string | null
  audioMetadata?: DesktopAudioMetadataRequest | null
  coverArtifact?: DesktopCoverArtifactRequest | null
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
  role: string
}

export type ReleaseLabelDto = {
  labelId?: string | null
  name: string
  catalogNumber?: string | null
  hasNoCatalogNumber: boolean
}

export type ReleaseTracklistItemDto = {
  trackId: string
  title: string
  position: number
  durationSeconds?: number | null
  artistCredits: ReleaseArtistCreditDto[]
  versionNote?: string | null
}

export type TrackDto = {
  id: string
  title: string
  durationSeconds?: number | null
  genres: string[]
  tags: string[]
  credits?: TrackCreditDto[]
  releaseAppearances?: TrackReleaseAppearanceDto[]
}

export type TrackCreditDto = {
  artistId: string
  artistName: string
  role: string
}

export type TrackReleaseAppearanceDto = {
  releaseId: string
  releaseTitle: string
  releaseArtist: string
  year?: number | null
  label?: string | null
  position: number
  durationSeconds?: number | null
  versionNote?: string | null
}

export type ReleaseTrackContext = {
  release: ReleaseDto
  track: ReleaseTracklistItemDto
}

export type MediumDto = {
  type: string
  description?: string | null
  path?: string | null
  format?: string | null
  discCount?: number | null
}

export type CatalogTargetType = 'release' | 'track'

export type OwnedItemDto = {
  id: string
  targetType: CatalogTargetType
  targetId: string
  status: string
  medium: MediumDto
  condition?: string | null
  storageLocation?: string | null
}

export type CreditDto = {
  id: string
  contributorArtistId: string
  contributorName: string
  targetType: CatalogTargetType
  targetId: string
  role: string
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

export type CatalogLinkKind = SearchEntityType | 'relation'

export type CatalogLinkLookupItem = {
  kind: CatalogLinkKind
  id: string
  title: string
  subtitle?: string | null
}

export type CatalogLinkLookupParams = {
  query?: string
  kinds?: CatalogLinkKind[]
  limit?: number
}

export type ErrorResponseDto = {
  code?: string | null
  message?: string | null
}

export type SearchEntityType =
  | 'artist'
  | 'release'
  | 'track'
  | 'ownedItem'
  | 'label'
  | 'playlist'

export type CatalogGraphEntityType = SearchEntityType | 'relation'

export type CatalogSearchFacets = {
  roles: string[]
  media: string[]
  statuses: string[]
  tags: string[]
  labelId?: string | null
  collectorSignals: string[]
}

export type CatalogSearchResult = {
  id: string
  type: SearchEntityType
  title: string
  subtitle?: string | null
  summary?: string | null
  matchedFields: string[]
  snippets: string[]
  facets: CatalogSearchFacets
  rank: number
}

export type CatalogGraphLink = {
  id: string
  type: CatalogGraphEntityType
  title: string
  subtitle?: string | null
  relation?: string | null
}

export type CatalogGraphEntity = {
  id: string
  type: SearchEntityType
  title: string
  subtitle?: string | null
  summary?: string | null
}

export type CatalogGraphContext = {
  entity: CatalogGraphEntity
  sections: {
    artists: CatalogGraphLink[]
    releases: CatalogGraphLink[]
    tracks: CatalogGraphLink[]
    ownedCopies: CatalogGraphLink[]
    labels: CatalogGraphLink[]
    playlists: CatalogGraphLink[]
    credits: CatalogGraphLink[]
    relations: CatalogGraphLink[]
    media: CatalogGraphLink[]
  }
  collectorSignals: string[]
}

export type CatalogSearchParams = {
  query?: string
  entityType?: SearchEntityType | ''
  role?: string
  media?: string
  status?: string
  labelId?: string
  tag?: string
  savedView?: string
  limit?: number
  offset?: number
}
