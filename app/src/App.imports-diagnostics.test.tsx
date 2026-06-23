import { describe, expect, it, vi } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

const diagnosticSessionListItem = {
  id: 'import-session-1',
  sourceRoot: '/Users/example/Music/Incoming/Forest Drive West - Dualism',
  status: 'readyForReview',
  scanMode: 'namesOnly',
  draftCount: 1,
  trackCount: 12,
  ignoredFileCount: 3,
  createdAt: '2026-05-16T12:00:00Z',
  updatedAt: '2026-05-16T12:00:00Z',
  diagnostics: [],
  diagnosticSummaries: [
    { code: 'missing_cover', severity: 'warning', count: 1 },
    { code: 'unsupported_extension', severity: 'info', count: 2 },
  ],
  drafts: [],
}

const diagnosticSessionDetail = {
  ...diagnosticSessionListItem,
  diagnostics: [
    {
      id: 'diagnostic-1',
      code: 'missing_cover',
      severity: 'warning',
      message: 'No image file found in release folder.',
      filePath:
        '/Users/example/Music/Incoming/Forest Drive West - Dualism/cover.tiff',
      relativePath: 'Forest Drive West - Dualism/cover.tiff',
      extension: '.tiff',
      sizeBytes: 2048,
      source: 'cover',
      createdAt: '2026-05-16T12:00:00Z',
    },
    {
      id: 'diagnostic-2',
      code: 'unsupported_extension',
      severity: 'info',
      message: 'File extension is not part of the desktop import contract.',
      filePath:
        '/Users/example/Music/Incoming/Forest Drive West - Dualism/notes.txt',
      relativePath: 'Forest Drive West - Dualism/notes.txt',
      extension: '.txt',
      sizeBytes: 120,
      source: 'scanner',
      createdAt: '2026-05-16T12:00:00Z',
    },
  ],
  drafts: [
    {
      id: 'draft-1',
      sourcePath: '/Users/example/Music/Incoming/Forest Drive West - Dualism',
      relativePath: 'Forest Drive West - Dualism',
      status: 'needsReview',
      title: 'Dualism',
      type: 'album',
      catalogNumber: null,
      labelName: null,
      releaseDate: null,
      year: 2021,
      isVariousArtists: false,
      notOnLabel: false,
      artistNames: ['Forest Drive West'],
      artistCredits: [],
      selectedArtistIds: [],
      artistSuggestions: [],
      labels: [],
      genres: [],
      tags: [],
      externalSources: [],
      coverPath: null,
      issues: [
        {
          code: 'release_import.missing_cover',
          message: 'No cover image found; using generic placeholder.',
          severity: 'warning',
        },
      ],
      tracks: [
        {
          id: 'draft-track-1',
          filePath:
            '/Users/example/Music/Incoming/Forest Drive West - Dualism/01 Void Control.flac',
          relativePath: 'Forest Drive West - Dualism/01 Void Control.flac',
          format: 'flac',
          sizeBytes: 12,
          lastModifiedAt: '2026-05-16T12:00:00Z',
          durationSeconds: null,
          position: 1,
          title: 'Void Control',
          artistNames: ['Forest Drive West'],
          artistCredits: [],
          artistSuggestions: [],
          trackSuggestions: [],
          isSkipped: false,
          selectedTrackId: null,
          selectedArtistIds: [],
          issues: [
            {
              code: 'release_import.content_hash_missing',
              message: 'Content hash is missing; duplicate matching is weaker.',
              severity: 'warning',
            },
          ],
        },
      ],
    },
  ],
}

function importSessionsResponse() {
  return h.jsonResponse({
    items: [diagnosticSessionListItem],
    limit: 100,
    offset: 0,
    total: 1,
  })
}

function importSessionDetailResponse() {
  return h.jsonResponse(diagnosticSessionDetail)
}

describe('App import scan diagnostics', () => {
  it('shows selected session diagnostic groups and warning counts', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    h.mockFetch(importSessionsResponse(), importSessionDetailResponse())

    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(
      await h.screen.findByText(diagnosticSessionListItem.sourceRoot),
    )

    expect(await h.screen.findByText('Scan report')).toBeInTheDocument()
    expect(h.screen.getByText('Names only')).toBeInTheDocument()
    expect(h.screen.getByText('3 ignored')).toBeInTheDocument()
    expect(h.screen.getAllByText('1 warning')[0]).toBeVisible()
    expect(h.screen.getByText('Diagnostic groups')).toBeInTheDocument()
    expect(h.screen.getByText('missing_cover')).toBeInTheDocument()
    expect(
      h.screen.getByText('No image file found in release folder.'),
    ).toBeInTheDocument()
    expect(
      h.screen.getByText('Forest Drive West - Dualism/cover.tiff'),
    ).toBeInTheDocument()
  })

  it('shows release-level draft issues near release metadata without hiding track issues', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    h.mockFetch(importSessionsResponse(), importSessionDetailResponse())

    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(
      await h.screen.findByText(diagnosticSessionListItem.sourceRoot),
    )

    expect(await h.screen.findByText('Release issues')).toBeInTheDocument()
    expect(
      h.screen.getByText('No cover image found; using generic placeholder.'),
    ).toBeInTheDocument()
    expect(
      h.screen.getByText(
        'Content hash is missing; duplicate matching is weaker.',
      ),
    ).toBeInTheDocument()
  })
})
