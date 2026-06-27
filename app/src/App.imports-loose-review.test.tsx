import { describe, expect, it, vi } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

const looseSessionListItem = {
  id: 'import-session-loose',
  sourceRoot: '/Users/example/Music/Incoming/Loose Basket',
  status: 'readyForReview',
  scanMode: 'full',
  draftCount: 0,
  trackCount: 0,
  ignoredFileCount: 1,
  looseFileCandidateCount: 4,
  createdAt: '2026-05-16T12:00:00Z',
  updatedAt: '2026-05-16T12:00:00Z',
  diagnostics: [],
  diagnosticSummaries: [],
  looseFileCandidates: null,
  drafts: [],
}

const looseCandidates = [
  looseCandidate('loose-1', '01 Root Track.flac', {
    titleHint: 'Root Track',
    artistHints: ['Loose Artist'],
    albumTitleHint: 'Loose Album',
    albumArtistHints: ['Loose Album Artist'],
    trackNumber: 1,
  }),
  looseCandidate('loose-2', 'Mixed Folder/02 Metadata Missing Hash.mp3', {
    titleHint: 'Metadata Missing Hash',
    artistHints: ['Mixed Artist'],
    albumTitleHint: 'Mixed Album A',
    contentHash: null,
    format: 'mp3',
    trackNumber: 2,
    reason: 'mixed_album_tags',
  }),
  looseCandidate('loose-3', 'ignored.wav', {
    contentHash: null,
    decision: 'ignored',
    titleHint: null,
  }),
  looseCandidate('loose-4', 'converted.m4a', {
    decision: 'converted',
    titleHint: null,
  }),
]

const mixedSessionListItem = {
  ...looseSessionListItem,
  id: 'import-session-mixed',
  sourceRoot: '/Users/example/Music/Incoming/Mixed Import',
  draftCount: 1,
  trackCount: 1,
}

const mixedExistingDraft = {
  id: 'draft-existing-1',
  sourcePath: '/Users/example/Music/Incoming/Mixed Import/Existing Album',
  relativePath: 'Existing Album',
  status: 'needsReview',
  title: 'Existing Album',
  type: 'album',
  catalogNumber: null,
  labelName: null,
  releaseDate: null,
  year: null,
  isVariousArtists: false,
  notOnLabel: false,
  artistNames: ['Existing Artist'],
  artistCredits: [],
  selectedArtistIds: [],
  artistSuggestions: [],
  labels: [],
  genres: [],
  tags: [],
  externalSources: [],
  coverPath: null,
  issues: [],
  tracks: [],
}

function looseCandidate(
  id: string,
  relativePath: string,
  overrides: Record<string, unknown>,
) {
  return {
    id,
    filePath: `/Users/example/Music/Incoming/Loose Basket/${relativePath}`,
    relativePath,
    format: 'flac',
    sizeBytes: 44040192,
    lastModifiedAt: '2026-05-16T12:00:00Z',
    contentHash: `sha256-${id}`,
    durationSeconds: 222,
    codec: 'FLAC',
    quality: 'lossless',
    bitrateKbps: 842,
    sampleRateHz: 44100,
    channels: 2,
    titleHint: 'Root Track',
    artistHints: [],
    albumTitleHint: null,
    albumArtistHints: [],
    trackNumber: null,
    reason: 'root_audio_unclear_release_context',
    decision: 'pending',
    sourceDraftId: null,
    sourceDraftTrackId: null,
    createdAt: '2026-05-16T12:00:00Z',
    updatedAt: '2026-05-16T12:00:00Z',
    ...overrides,
  }
}

function importSessionsResponse(item = looseSessionListItem) {
  return h.jsonResponse({ items: [item], limit: 100, offset: 0, total: 1 })
}

function importSessionDetailResponse(
  item = looseSessionListItem,
  drafts: unknown[] = [],
) {
  return h.jsonResponse({
    ...item,
    looseFileCandidateCount: looseCandidates.length,
    looseFileCandidates: looseCandidates,
    drafts,
  })
}

function looseDraftCreatedResponse(item = looseSessionListItem) {
  return h.jsonResponse({
    ...item,
    draftCount: item.draftCount + 1,
    trackCount: item.trackCount + 2,
    looseFileCandidateCount: looseCandidates.length,
    looseFileCandidates: looseCandidates.map((candidate) =>
      candidate.decision === 'pending'
        ? { ...candidate, decision: 'convertedToDraft' }
        : candidate,
    ),
    drafts: [
      ...(item.id === mixedSessionListItem.id ? [mixedExistingDraft] : []),
      {
        ...mixedExistingDraft,
        id: 'draft-created-from-loose',
        relativePath: 'Loose files',
        title: 'Mixed Album A',
        artistNames: [],
      },
    ],
    relationSuggestions: [],
  })
}

function jsonRequestBody<T>(init: RequestInit | undefined) {
  const body = init?.body
  return JSON.parse(typeof body === 'string' ? body : '{}') as T
}

describe('App import loose file review', () => {
  it('shows a right-side loose review workspace for a loose-only session', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    h.mockFetch(importSessionsResponse(), importSessionDetailResponse())
    const user = h.userEvent.setup()

    h.render(<h.App />)

    await user.click(await h.screen.findByText(looseSessionListItem.sourceRoot))

    expect(
      await h.screen.findByRole('heading', { name: 'Loose file review' }),
    ).toBeInTheDocument()
    expect(h.screen.getByText('4 total')).toBeInTheDocument()
    expect(h.screen.getByText('2 pending')).toBeInTheDocument()
    expect(
      h.screen.queryByRole('heading', { name: 'No release draft selected' }),
    ).not.toBeInTheDocument()
  })

  it('creates a loose draft with a reviewed title choice for mixed album tags', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    const fetchMock = h.mockFetch(
      importSessionsResponse(),
      importSessionDetailResponse(),
      looseDraftCreatedResponse(),
      importSessionsResponse(),
    )
    const user = h.userEvent.setup()

    h.render(<h.App />)

    await user.click(await h.screen.findByText(looseSessionListItem.sourceRoot))
    await user.click(
      await h.screen.findByRole('button', { name: /select all pending/i }),
    )
    await user.click(
      h.screen.getByRole('button', { name: /use mixed album a/i }),
    )
    await user.click(
      h.screen.getByRole('button', { name: /^create release draft$/i }),
    )

    expect(
      await h.screen.findByText('Release draft created'),
    ).toBeInTheDocument()
    const createCall = findLooseDraftCreateCall(
      fetchMock,
      'import-session-loose',
    )
    expect(createCall).toBeDefined()
    expect(jsonRequestBody<{ reviewedTitle: string }>(createCall?.[1])).toEqual(
      expect.objectContaining({
        candidateIds: ['loose-1', 'loose-2'],
        reviewedTitle: 'Mixed Album A',
      }),
    )
  })

  it('opens loose review for mixed sessions from the loose files panel', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    const fetchMock = h.mockFetch(
      importSessionsResponse(mixedSessionListItem),
      importSessionDetailResponse(mixedSessionListItem, [mixedExistingDraft]),
      looseDraftCreatedResponse(mixedSessionListItem),
      importSessionsResponse(mixedSessionListItem),
    )
    const user = h.userEvent.setup()

    h.render(<h.App />)

    await user.click(await h.screen.findByText(mixedSessionListItem.sourceRoot))

    expect(
      await h.screen.findByRole('heading', { name: 'Existing Album' }),
    ).toBeInTheDocument()
    expect(
      h.screen.queryByRole('heading', { name: 'Loose file review' }),
    ).not.toBeInTheDocument()

    await user.click(
      h.screen.getByRole('button', { name: /review loose files/i }),
    )
    expect(
      await h.screen.findByRole('heading', { name: 'Loose file review' }),
    ).toBeInTheDocument()

    await user.click(
      h.screen.getByRole('button', { name: /select all pending/i }),
    )
    await user.click(
      h.screen.getByRole('button', { name: /use mixed album a/i }),
    )
    await user.click(
      h.screen.getByRole('button', { name: /^create release draft$/i }),
    )

    expect(
      await h.screen.findByText('Release draft created'),
    ).toBeInTheDocument()
    const createCall = findLooseDraftCreateCall(
      fetchMock,
      'import-session-mixed',
    )
    expect(createCall).toBeDefined()
    expect(jsonRequestBody<{ reviewedTitle: string }>(createCall?.[1])).toEqual(
      expect.objectContaining({
        candidateIds: ['loose-1', 'loose-2'],
        reviewedTitle: 'Mixed Album A',
      }),
    )
  })
})

function findLooseDraftCreateCall(
  fetchMock: ReturnType<typeof h.mockFetch>,
  sessionId: string,
) {
  return fetchMock.mock.calls.find(([input]) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url
    return url.includes(`/api/imports/${sessionId}/loose-file-drafts`)
  })
}
