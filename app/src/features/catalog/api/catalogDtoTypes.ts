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
import type {
  CatalogDictionaries,
  DictionaryEntry,
  DiscogsIntegrationStatus,
  EntityRating,
  RatingCriterion,
  TagRoleMapping,
  TrackRelationParserRule,
} from './catalogSettingsTypes'

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
  identityHint?: string | null
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
  trackId?: string | null
  isReleaseOnly: boolean
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
  versionYear?: number | null
  isOriginal?: boolean
  genres: string[]
  tags: string[]
  externalSources?: ExternalSourceReference[] | null
  credits?: TrackCreditDto[]
  releaseAppearances?: TrackReleaseAppearanceDto[]
  digitalFiles?: TrackDigitalFileDto[]
}

export type TrackStackDto = {
  originalTrackId: string
  originalTitle: string
  originalVersionYear?: number | null
  memberCount: number
  hasCycleIssue: boolean
  members: TrackStackMemberDto[]
  issues: TrackStackIssueDto[]
}

export type TrackStackMemberDto = {
  trackId: string
  title: string
  versionYear?: number | null
  relationType: string
  depth: number
  isDirect: boolean
}

export type TrackStackIssueDto = {
  code: string
  trackIds: string[]
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
