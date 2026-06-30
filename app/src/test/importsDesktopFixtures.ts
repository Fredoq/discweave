import * as h from './appTestHarness'

export const desktopAudioContentHash =
  '70bc8f4b72a86921468bf8e8441dce51d8c6cb7d792fa7bbcb0d4d9eba328b75'

export function importSessionDetailResponse(
  status: 'needsReview' | 'confirmed',
  draftGenres: string[] = [],
  trackPatch: Record<string, unknown> = {},
) {
  return h.jsonResponse({
    id: 'import-session-1',
    sourceRoot: '/Users/example/Music',
    status: status === 'confirmed' ? 'confirmed' : 'readyForReview',
    draftCount: 1,
    trackCount: 1,
    ignoredFileCount: 0,
    createdAt: '2026-05-16T12:00:00Z',
    updatedAt: '2026-05-16T12:00:00Z',
    drafts: [
      {
        id: 'draft-1',
        sourcePath: '/Users/example/Music/Release',
        relativePath: 'Release',
        status,
        title: 'Imported Release',
        type: 'album',
        catalogNumber: null,
        labelName: null,
        releaseDate: null,
        year: 1992,
        isVariousArtists: false,
        notOnLabel: true,
        artistNames: ['Aphex Twin'],
        artistCredits: [],
        selectedArtistIds: [],
        artistSuggestions: [],
        labels: [],
        genres: draftGenres,
        tags: ['local-import'],
        externalSources: [],
        coverPath: 'Release/cover.jpg',
        issues: [],
        tracks: [
          {
            id: 'draft-track-1',
            filePath: '/Users/example/Music/Release/01 Track.flac',
            relativePath: 'Release/01 Track.flac',
            format: 'flac',
            sizeBytes: 12,
            lastModifiedAt: '2026-05-16T12:00:00Z',
            durationSeconds: null,
            position: 1,
            disc: 'CD 1',
            side: 'A',
            title: 'Track',
            versionYear: 1992,
            artistNames: ['Aphex Twin'],
            artistCredits: [],
            artistSuggestions: [],
            trackSuggestions: [],
            isSkipped: false,
            selectedTrackId: null,
            selectedArtistIds: [],
            issues: [],
            ...trackPatch,
          },
        ],
      },
    ],
  })
}

export function importSessionListItem(patch: Record<string, unknown> = {}) {
  return {
    id: 'import-session-1',
    sourceRoot: '/Users/example/Music',
    status: 'readyForReview',
    draftCount: 1,
    trackCount: 1,
    ignoredFileCount: 0,
    looseFileCandidateCount: 0,
    createdAt: '2026-05-16T12:00:00Z',
    updatedAt: '2026-05-16T12:00:00Z',
    diagnostics: [],
    diagnosticSummaries: [],
    archivedAt: null,
    drafts: [],
    ...patch,
  }
}

export function importSessionListResponse(
  items: Array<Record<string, unknown>> = [importSessionListItem()],
) {
  return h.jsonResponse({
    items,
    limit: 100,
    offset: 0,
    total: items.length,
  })
}
