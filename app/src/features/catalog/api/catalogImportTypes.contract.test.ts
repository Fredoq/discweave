import { describe, expect, it } from 'vitest'
import type {
  ReleaseImportDraft,
  ReleaseImportDraftTrack,
  ReleaseImportSession,
} from './catalogImportTypes'

const externalMetadataTrack = {
  id: 'external-track',
  sourceKind: 'externalMetadata',
  filePath: null,
  relativePath: null,
  format: null,
  sizeBytes: null,
  lastModifiedAt: null,
  localFile: null,
  title: 'Metadata Track',
  artistNames: [],
  artistSuggestions: [],
  trackSuggestions: [],
  isSkipped: false,
  selectedArtistIds: [],
  issues: [],
} satisfies ReleaseImportDraftTrack

const externalMetadataDraft = {
  id: 'external-draft',
  sourceKind: 'externalMetadata',
  sourcePath: null,
  relativePath: null,
  status: 'needsReview',
  title: 'Metadata Release',
  type: 'album',
  isVariousArtists: false,
  notOnLabel: false,
  artistNames: [],
  selectedArtistIds: [],
  artistSuggestions: [],
  genres: [],
  tags: [],
  issues: [],
  tracks: [externalMetadataTrack],
} satisfies ReleaseImportDraft

const externalMetadataSession = {
  id: 'external-session',
  sourceKind: 'externalMetadata',
  sourceRoot: null,
  scanMode: null,
  status: 'readyForReview',
  draftCount: 1,
  trackCount: 1,
  ignoredFileCount: 0,
  looseFileCandidateCount: 0,
  createdAt: '2026-07-24T12:00:00Z',
  updatedAt: '2026-07-24T12:00:00Z',
  diagnostics: [],
  diagnosticSummaries: [],
  drafts: [externalMetadataDraft],
} satisfies ReleaseImportSession

describe('release import source contracts', () => {
  it('represent external metadata source and file members as null', () => {
    expect(externalMetadataSession.sourceRoot).toBeNull()
    expect(externalMetadataDraft.sourcePath).toBeNull()
    expect(externalMetadataTrack.localFile).toBeNull()
    expect(externalMetadataTrack.filePath).toBeNull()
  })
})
