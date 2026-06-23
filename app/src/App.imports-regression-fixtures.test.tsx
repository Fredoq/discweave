import { describe, expect, it, vi } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

const regressionSessionListItem = {
  id: 'import-session-regression-fixture',
  sourceRoot: '/Users/example/Music/Messy Import Fixture',
  status: 'readyForReview',
  scanMode: 'full',
  draftCount: 1,
  trackCount: 2,
  ignoredFileCount: 3,
  looseFileCandidateCount: 2,
  createdAt: '2026-06-01T12:00:00Z',
  updatedAt: '2026-06-01T12:00:00Z',
  diagnostics: [],
  diagnosticSummaries: [
    { code: 'unsupported_extension', severity: 'info', count: 1 },
    { code: 'hidden_path', severity: 'info', count: 1 },
    { code: 'symlink_ignored', severity: 'info', count: 1 },
  ],
  looseFileCandidates: null,
  drafts: [],
}

const regressionSessionDetail = {
  ...regressionSessionListItem,
  diagnostics: [
    {
      id: 'diagnostic-unsupported',
      code: 'unsupported_extension',
      severity: 'info',
      message: 'Import scanner skipped an unsupported file extension.',
      filePath: '/Users/example/Music/Messy Import Fixture/notes.txt',
      relativePath: 'notes.txt',
      extension: '.txt',
      sizeBytes: 12,
      source: 'scanner',
      createdAt: '2026-06-01T12:00:00Z',
    },
  ],
  looseFileCandidates: [
    {
      id: 'loose-root-fixture',
      filePath: '/Users/example/Music/Messy Import Fixture/Root Loose.flac',
      relativePath: 'Root Loose.flac',
      format: 'flac',
      sizeBytes: 7340032,
      lastModifiedAt: '2026-06-01T12:00:00Z',
      contentHash: 'fixture-root-hash',
      durationSeconds: 222,
      codec: 'FLAC',
      quality: 'lossless',
      bitrateKbps: 842,
      sampleRateHz: 44100,
      channels: 2,
      titleHint: 'Root Loose',
      artistHints: ['Loose Artist'],
      albumTitleHint: 'Loose Album',
      albumArtistHints: ['Loose Album Artist'],
      trackNumber: 1,
      reason: 'root_audio_unclear_release_context',
      decision: 'pending',
      sourceDraftId: null,
      sourceDraftTrackId: null,
      createdAt: '2026-06-01T12:00:00Z',
      updatedAt: '2026-06-01T12:00:00Z',
    },
    {
      id: 'loose-mixed-fixture',
      filePath:
        '/Users/example/Music/Messy Import Fixture/Mixed Tags/02 Album B.flac',
      relativePath: 'Mixed Tags/02 Album B.flac',
      format: 'flac',
      sizeBytes: 7340033,
      lastModifiedAt: '2026-06-01T12:00:00Z',
      contentHash: 'fixture-mixed-hash',
      durationSeconds: 185,
      codec: 'FLAC',
      quality: 'lossless',
      bitrateKbps: 840,
      sampleRateHz: 44100,
      channels: 2,
      titleHint: 'Album B',
      artistHints: ['Mixed Artist'],
      albumTitleHint: 'Album B',
      albumArtistHints: ['Mixed Artist'],
      trackNumber: 2,
      reason: 'mixed_album_tags',
      decision: 'pending',
      sourceDraftId: null,
      sourceDraftTrackId: null,
      createdAt: '2026-06-01T12:00:00Z',
      updatedAt: '2026-06-01T12:00:00Z',
    },
  ],
  drafts: [
    {
      id: 'draft-compilation-fixture',
      sourcePath:
        '/Users/example/Music/Messy Import Fixture/[DW 02, 2026] Various - Compilation',
      relativePath: '[DW 02, 2026] Various - Compilation',
      status: 'needsReview',
      title: 'Regression Compilation',
      type: 'album',
      catalogNumber: 'DW 02',
      labelName: null,
      releaseDate: '2026',
      year: 2026,
      isVariousArtists: true,
      notOnLabel: false,
      artistNames: ['Various Artists'],
      artistCredits: [],
      selectedArtistIds: [],
      artistSuggestions: [],
      labels: [],
      genres: ['Electronic'],
      tags: ['local-import', 'regression-fixture'],
      externalSources: [],
      coverPath: null,
      issues: [],
      tracks: [
        {
          id: 'draft-track-alpha',
          filePath:
            '/Users/example/Music/Messy Import Fixture/[DW 02, 2026] Various - Compilation/CD 1/01 Alpha.flac',
          relativePath:
            '[DW 02, 2026] Various - Compilation/CD 1/01 Alpha.flac',
          format: 'flac',
          sizeBytes: 9,
          lastModifiedAt: '2026-06-01T12:00:00Z',
          durationSeconds: 180,
          position: 1,
          disc: 'CD 1',
          side: null,
          title: 'Alpha',
          artistNames: ['Alpha Artist'],
          artistCredits: [],
          inheritReleaseArtistCredits: false,
          artistSuggestions: [],
          trackSuggestions: [],
          isSkipped: false,
          selectedTrackId: null,
          selectedArtistIds: [],
          issues: [],
        },
        {
          id: 'draft-track-beta',
          filePath:
            '/Users/example/Music/Messy Import Fixture/[DW 02, 2026] Various - Compilation/CD 2/01 Beta.flac',
          relativePath: '[DW 02, 2026] Various - Compilation/CD 2/01 Beta.flac',
          format: 'flac',
          sizeBytes: 9,
          lastModifiedAt: '2026-06-01T12:00:00Z',
          durationSeconds: 181,
          position: 1,
          disc: 'CD 2',
          side: null,
          title: 'Beta',
          artistNames: ['Beta Artist'],
          artistCredits: [],
          inheritReleaseArtistCredits: false,
          artistSuggestions: [],
          trackSuggestions: [],
          isSkipped: false,
          selectedTrackId: null,
          selectedArtistIds: [],
          issues: [],
        },
      ],
    },
  ],
  relationSuggestions: [],
}

function importSessionsResponse() {
  return h.jsonResponse({
    items: [regressionSessionListItem],
    limit: 100,
    offset: 0,
    total: 1,
  })
}

function importSessionDetailResponse() {
  return h.jsonResponse(regressionSessionDetail)
}

describe('App import regression fixtures', () => {
  it('renders messy import drafts diagnostics and loose-file action affordances', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    h.mockFetch(importSessionsResponse(), importSessionDetailResponse())
    const user = h.userEvent.setup()

    h.render(<h.App />)

    await user.click(
      await h.screen.findByRole('button', {
        name: regressionSessionListItem.sourceRoot,
      }),
    )

    expect(
      await h.screen.findByRole('heading', {
        name: 'Regression Compilation',
      }),
    ).toBeVisible()
    expect(h.screen.getAllByText('CD 1')[0]).toBeInTheDocument()
    expect(h.screen.getAllByText('CD 2')[0]).toBeInTheDocument()
    expect(
      h.screen.getAllByText('unsupported_extension')[0],
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('heading', { name: 'Loose files' }),
    ).toBeInTheDocument()
    expect(h.screen.getByText('Root Loose.flac')).toBeInTheDocument()
    expect(h.screen.getByText('Mixed Tags/02 Album B.flac')).toBeInTheDocument()
    expect(
      h.screen.getByRole('button', { name: /create release draft/i }),
    ).toBeDisabled()
    expect(
      h.screen.getByRole('button', { name: /attach to existing release/i }),
    ).toBeDisabled()
  })
})
