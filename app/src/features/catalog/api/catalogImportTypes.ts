import type { ExternalSourceReference } from './externalMetadataClient'

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
  versionYear?: number | null
  artistNames: string[]
  artistCredits?: ReleaseImportArtistCredit[]
  inheritReleaseArtistCredits?: boolean
  artistSuggestions: EntitySuggestion[]
  trackSuggestions: EntitySuggestion[]
  trackMode?: ReleaseImportTrackMode
  isSkipped: boolean
  selectedTrackId?: string | null
  selectedArtistIds: string[]
  issues: ImportIssue[]
  moveHint?: ReleaseImportFileMoveHint | null
}

export type ReleaseImportTrackMode = 'create' | 'link' | 'releaseOnly'

export type ReleaseImportFileMoveHint = {
  previousPath?: string | null
  matchKind: string
  confidence: string
}

export type ReleaseImportArtistCredit = {
  artistId?: string | null
  name: string
  role: string
  externalSource?: ExternalSourceReference | null
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
  createCatalogTracks?: boolean
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
  releaseOnlyTracks: number
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
  action: 'create' | 'reuse' | 'update' | 'relink' | 'skip' | 'releaseOnly'
  count: number
  label: string
}

export type ReleaseImportConfirmationTrackPlan = {
  draftTrackId: string
  title: string
  position?: number | null
  isSkipped: boolean
  selectedTrackId?: string | null
  trackAction: 'create' | 'reuse' | 'skip' | 'releaseOnly'
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

export type CreateLooseFileDraftRequest = {
  candidateIds: string[]
  reviewedTitle?: string | null
  reviewedArtistNames?: string[] | null
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
  archivedAt?: string | null
}

export type ImportSessionFilter =
  | 'all'
  | 'ready'
  | 'confirmed'
  | 'skipped'
  | 'hasLooseFiles'
  | 'hasWarningsOrErrors'
  | 'missingHashes'
  | 'duplicateMatches'

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
