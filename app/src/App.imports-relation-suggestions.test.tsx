import { describe, expect, it, vi } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

function importSessionListResponse() {
  return h.jsonResponse({
    items: [
      {
        id: 'import-session-1',
        sourceRoot: '/Users/example/Music',
        status: 'readyForReview',
        draftCount: 1,
        trackCount: 2,
        ignoredFileCount: 0,
        createdAt: '2026-05-16T12:00:00Z',
        updatedAt: '2026-05-16T12:00:00Z',
        drafts: [],
      },
    ],
    limit: 100,
    offset: 0,
    total: 1,
  })
}

function importSessionDetailResponse(
  relationSuggestionDecision: 'pending' | 'accepted' = 'pending',
) {
  return h.jsonResponse({
    id: 'import-session-1',
    sourceRoot: '/Users/example/Music',
    status: 'readyForReview',
    draftCount: 1,
    trackCount: 2,
    ignoredFileCount: 0,
    createdAt: '2026-05-16T12:00:00Z',
    updatedAt: '2026-05-16T12:00:00Z',
    drafts: [
      {
        id: 'draft-1',
        sourcePath: '/Users/example/Music/Release',
        relativePath: 'Release',
        status: 'needsReview',
        title: 'Imported Release',
        type: 'album',
        catalogNumber: null,
        labelName: null,
        releaseDate: null,
        year: 1992,
        isVariousArtists: false,
        notOnLabel: true,
        artistNames: ['Run-DMC'],
        artistCredits: [],
        selectedArtistIds: [],
        artistSuggestions: [],
        labels: [],
        genres: [],
        tags: [],
        externalSources: [],
        coverPath: null,
        issues: [],
        tracks: [
          {
            id: 'draft-track-base',
            filePath: '/Users/example/Music/Release/01 Base.flac',
            relativePath: 'Release/01 Base.flac',
            format: 'flac',
            sizeBytes: 12,
            lastModifiedAt: '2026-05-16T12:00:00Z',
            durationSeconds: null,
            position: 1,
            disc: null,
            side: null,
            title: "It's Like That",
            artistNames: ['Run-DMC'],
            artistCredits: [],
            artistSuggestions: [],
            trackSuggestions: [],
            isSkipped: false,
            selectedTrackId: null,
            selectedArtistIds: [],
            issues: [],
          },
          {
            id: 'draft-track-edit',
            filePath: '/Users/example/Music/Release/02 Radio Edit.flac',
            relativePath: 'Release/02 Radio Edit.flac',
            format: 'flac',
            sizeBytes: 12,
            lastModifiedAt: '2026-05-16T12:00:00Z',
            durationSeconds: null,
            position: 2,
            disc: null,
            side: null,
            title: "It's Like That (Radio Edit)",
            artistNames: ['Run-DMC'],
            artistCredits: [],
            artistSuggestions: [],
            trackSuggestions: [],
            isSkipped: false,
            selectedTrackId: null,
            selectedArtistIds: [],
            issues: [],
          },
        ],
      },
      {
        id: 'draft-2',
        sourcePath: '/Users/example/Music/Other Release',
        relativePath: 'Other Release',
        status: 'needsReview',
        title: 'Other Imported Release',
        type: 'album',
        catalogNumber: null,
        labelName: null,
        releaseDate: null,
        year: 1993,
        isVariousArtists: false,
        notOnLabel: true,
        artistNames: ['Run-DMC'],
        artistCredits: [],
        selectedArtistIds: [],
        artistSuggestions: [],
        labels: [],
        genres: [],
        tags: [],
        externalSources: [],
        coverPath: null,
        issues: [],
        tracks: [
          {
            id: 'other-draft-track',
            filePath: '/Users/example/Music/Other Release/01 Other Mix.flac',
            relativePath: 'Other Release/01 Other Mix.flac',
            format: 'flac',
            sizeBytes: 12,
            lastModifiedAt: '2026-05-16T12:00:00Z',
            durationSeconds: null,
            position: 1,
            disc: null,
            side: null,
            title: "It's Like That (Other Mix)",
            artistNames: ['Run-DMC'],
            artistCredits: [],
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
    relationSuggestions: [
      {
        id: 'suggestion-1',
        draftId: 'draft-1',
        token: 'Radio Edit',
        confidence: 95,
        decision: relationSuggestionDecision,
        suggested: {
          source: { kind: 'draftTrack', id: 'draft-track-edit' },
          target: { kind: 'draftTrack', id: 'draft-track-base' },
          relationTypeCode: 'versionOf',
        },
        reviewed: {
          source: { kind: 'draftTrack', id: 'draft-track-edit' },
          target: { kind: 'draftTrack', id: 'draft-track-base' },
          relationTypeCode: 'versionOf',
        },
        targetOptions: [{ kind: 'draftTrack', id: 'draft-track-base' }],
        isModified: false,
      },
      {
        id: 'suggestion-other',
        draftId: 'draft-2',
        token: 'Other Mix',
        confidence: 90,
        decision: 'pending',
        suggested: {
          source: { kind: 'draftTrack', id: 'other-draft-track' },
          target: { kind: 'draftTrack', id: 'draft-track-base' },
          relationTypeCode: 'remixOf',
        },
        reviewed: {
          source: { kind: 'draftTrack', id: 'other-draft-track' },
          target: { kind: 'draftTrack', id: 'draft-track-base' },
          relationTypeCode: 'remixOf',
        },
        targetOptions: [{ kind: 'draftTrack', id: 'draft-track-base' }],
        isModified: false,
      },
    ],
  })
}

describe('App import relation suggestions', () => {
  it('renders a pending relation suggestion and accepts the reviewed payload', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    let resolveUpdateResponse!: (response: Response) => void
    const updateResponse = new Promise<Response>((resolve) => {
      resolveUpdateResponse = resolve
    })
    const fetchMock = h.mockFetch(
      importSessionListResponse(),
      importSessionDetailResponse('pending'),
    )
    fetchMock.mockImplementationOnce(() => updateResponse)
    const user = h.userEvent.setup()

    h.render(<h.App />)

    await user.click(
      await h.screen.findByRole('button', { name: /\/Users\/example\/Music/i }),
    )

    expect(
      await h.screen.findByRole('heading', { name: 'Relation suggestions' }),
    ).toBeInTheDocument()
    expect(h.screen.getByText('Radio Edit')).toBeInTheDocument()
    expect(h.screen.getByDisplayValue('Version of')).toBeInTheDocument()
    expect(
      h.screen.getByRole('option', { name: "It's Like That" }),
    ).toBeInTheDocument()
    expect(h.screen.queryByText('Other Mix')).not.toBeInTheDocument()
    expect(
      h.screen.getByRole('button', {
        name: /accept relation suggestion radio edit/i,
      }),
    ).toBeEnabled()
    expect(
      h.screen.getByRole('button', {
        name: /reject relation suggestion radio edit/i,
      }),
    ).toBeEnabled()

    await user.click(
      h.screen.getByRole('button', {
        name: /accept relation suggestion radio edit/i,
      }),
    )

    await h.waitFor(() => {
      expect(
        h.screen.getByRole('button', {
          name: /accept relation suggestion radio edit/i,
        }),
      ).toBeDisabled()
      expect(
        h.screen.getByRole('button', {
          name: /reject relation suggestion radio edit/i,
        }),
      ).toBeDisabled()
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/imports/import-session-1/relation-suggestions/suggestion-1',
        expect.objectContaining({ method: 'PUT' }),
      )
    })
    const updateCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        url ===
          '/api/imports/import-session-1/relation-suggestions/suggestion-1' &&
        init?.method === 'PUT',
    )
    const updateBody = JSON.parse(
      ((updateCall?.[1] as RequestInit).body as string) ?? '{}',
    ) as Record<string, unknown>

    expect(updateBody).toEqual({
      decision: 'accepted',
      reviewed: {
        source: { kind: 'draftTrack', id: 'draft-track-edit' },
        target: { kind: 'draftTrack', id: 'draft-track-base' },
        relationTypeCode: 'versionOf',
      },
    })
    resolveUpdateResponse(importSessionDetailResponse('accepted'))
    expect(await h.screen.findByText('accepted')).toBeInTheDocument()
  })
})
