import { describe, expect, it, vi } from 'vitest'
import type { ReleaseDto } from './features/catalog/catalogApi'
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
  {
    id: 'loose-1',
    filePath: '/Users/example/Music/Incoming/Loose Basket/01 Root Track.flac',
    relativePath: '01 Root Track.flac',
    format: 'flac',
    sizeBytes: 44040192,
    lastModifiedAt: '2026-05-16T12:00:00Z',
    contentHash: 'sha256-root-track',
    durationSeconds: 222,
    codec: 'FLAC',
    quality: 'lossless',
    bitrateKbps: 842,
    sampleRateHz: 44100,
    channels: 2,
    titleHint: 'Root Track',
    artistHints: ['Loose Artist'],
    albumTitleHint: 'Loose Album',
    albumArtistHints: ['Loose Album Artist'],
    trackNumber: 1,
    reason: 'root_audio_unclear_release_context',
    decision: 'pending',
    sourceDraftId: null,
    sourceDraftTrackId: null,
    createdAt: '2026-05-16T12:00:00Z',
    updatedAt: '2026-05-16T12:00:00Z',
  },
  {
    id: 'loose-2',
    filePath:
      '/Users/example/Music/Incoming/Loose Basket/Mixed Folder/02 Metadata Missing Hash.mp3',
    relativePath: 'Mixed Folder/02 Metadata Missing Hash.mp3',
    format: 'mp3',
    sizeBytes: 7340032,
    lastModifiedAt: '2026-05-16T12:00:00Z',
    contentHash: null,
    durationSeconds: 185,
    codec: 'MP3',
    quality: 'lossy',
    bitrateKbps: 320,
    sampleRateHz: 48000,
    channels: 2,
    titleHint: 'Metadata Missing Hash',
    artistHints: ['Mixed Artist'],
    albumTitleHint: 'Mixed Album A',
    albumArtistHints: [],
    trackNumber: 2,
    reason: 'mixed_album_tags',
    decision: 'pending',
    sourceDraftId: null,
    sourceDraftTrackId: null,
    createdAt: '2026-05-16T12:00:00Z',
    updatedAt: '2026-05-16T12:00:00Z',
  },
  {
    id: 'loose-3',
    filePath: '/Users/example/Music/Incoming/Loose Basket/ignored.wav',
    relativePath: 'ignored.wav',
    format: 'wav',
    sizeBytes: 22020096,
    lastModifiedAt: '2026-05-16T12:00:00Z',
    contentHash: null,
    durationSeconds: null,
    codec: 'WAV',
    quality: 'lossless',
    bitrateKbps: null,
    sampleRateHz: null,
    channels: null,
    titleHint: null,
    artistHints: [],
    albumTitleHint: null,
    albumArtistHints: [],
    trackNumber: null,
    reason: 'root_audio_unclear_release_context',
    decision: 'ignored',
    sourceDraftId: null,
    sourceDraftTrackId: null,
    createdAt: '2026-05-16T12:00:00Z',
    updatedAt: '2026-05-16T12:00:00Z',
  },
  {
    id: 'loose-4',
    filePath: '/Users/example/Music/Incoming/Loose Basket/converted.m4a',
    relativePath: 'converted.m4a',
    format: 'm4a',
    sizeBytes: 5505024,
    lastModifiedAt: '2026-05-16T12:00:00Z',
    contentHash: 'sha256-converted',
    durationSeconds: 61,
    codec: 'AAC',
    quality: 'lossy',
    bitrateKbps: 256,
    sampleRateHz: 44100,
    channels: 2,
    titleHint: null,
    artistHints: [],
    albumTitleHint: null,
    albumArtistHints: [],
    trackNumber: null,
    reason: 'root_audio_unclear_release_context',
    decision: 'converted',
    sourceDraftId: null,
    sourceDraftTrackId: null,
    createdAt: '2026-05-16T12:00:00Z',
    updatedAt: '2026-05-16T12:00:00Z',
  },
]

function importSessionsResponse() {
  return h.jsonResponse({
    items: [looseSessionListItem],
    limit: 100,
    offset: 0,
    total: 1,
  })
}

function importSessionDetailResponse(candidates = looseCandidates) {
  return h.jsonResponse({
    ...looseSessionListItem,
    looseFileCandidateCount: candidates.length,
    looseFileCandidates: candidates,
    drafts: [],
  })
}

function looseDraftCreatedResponse() {
  return h.jsonResponse({
    ...looseSessionListItem,
    draftCount: 1,
    trackCount: 1,
    looseFileCandidateCount: looseCandidates.length,
    looseFileCandidates: looseCandidates.map((candidate) =>
      candidate.id === 'loose-1'
        ? { ...candidate, decision: 'consumed', sourceDraftId: 'draft-loose-1' }
        : candidate,
    ),
    drafts: [
      {
        id: 'draft-loose-1',
        sourcePath: '/Users/example/Music/Incoming/Loose Basket',
        relativePath: 'Loose files',
        status: 'needsReview',
        title: 'Loose Album',
        type: 'unknown',
        catalogNumber: null,
        labelName: null,
        releaseDate: null,
        year: null,
        isVariousArtists: false,
        notOnLabel: false,
        artistNames: ['Loose Album Artist'],
        artistCredits: [],
        selectedArtistIds: [],
        artistSuggestions: [],
        labels: [],
        genres: [],
        tags: ['local-import', 'loose-files'],
        externalSources: [],
        coverPath: null,
        issues: [],
        tracks: [
          {
            id: 'draft-track-loose-1',
            filePath: looseCandidates[0].filePath,
            relativePath: looseCandidates[0].relativePath,
            format: looseCandidates[0].format,
            sizeBytes: looseCandidates[0].sizeBytes,
            lastModifiedAt: looseCandidates[0].lastModifiedAt,
            durationSeconds: looseCandidates[0].durationSeconds,
            position: 1,
            disc: null,
            side: null,
            title: 'Root Track',
            artistNames: ['Loose Artist'],
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
  })
}

const attachReleaseTrack: NonNullable<ReleaseDto['tracklist']>[number] = {
  releaseTrackId: 'release-track-root',
  trackId: 'track-root',
  title: 'Root Track',
  position: 1,
  disc: null,
  side: null,
  durationSeconds: 222,
  artistCredits: [],
  linkedLocalFiles: [],
}

const attachRelease: ReleaseDto = {
  id: 'release-loose-album',
  title: 'Loose Album',
  type: 'album',
  labelId: null,
  year: 2026,
  releaseDate: null,
  genres: ['Electronic'],
  tags: [],
  isVariousArtists: false,
  notOnLabel: true,
  coverImage: null,
  externalSources: [],
  artistCredits: [
    {
      artistId: 'artist-loose',
      artistName: 'Loose Album Artist',
      primaryRole: 'mainArtist',
      roles: ['mainArtist'],
    },
  ],
  labels: [],
  tracklist: [attachReleaseTrack],
}

function releaseSearchResponse(release = attachRelease) {
  return h.jsonResponse({ items: [release], limit: 100, offset: 0, total: 1 })
}

function looseAttachCreatedResponse() {
  return h.jsonResponse({
    ...looseSessionListItem,
    looseFileCandidateCount: looseCandidates.length,
    looseFileCandidates: looseCandidates.map((candidate) =>
      candidate.id === 'loose-1'
        ? { ...candidate, decision: 'consumed' }
        : candidate,
    ),
    drafts: [],
  })
}

type AttachRequestBody = {
  releaseId: string
  mappings: Array<{
    candidateId: string
    releaseTrackId: string
    confirmRelink: boolean
  }>
}

function jsonRequestBody<T>(init: RequestInit | undefined) {
  const body = init?.body
  return JSON.parse(typeof body === 'string' ? body : '{}') as T
}

describe('App import loose files view', () => {
  it('shows selected session loose file candidates without implying catalog tracks', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    h.mockFetch(importSessionsResponse(), importSessionDetailResponse())
    const user = h.userEvent.setup()

    h.render(<h.App />)

    await user.click(await h.screen.findByText(looseSessionListItem.sourceRoot))

    expect(await h.screen.findByText('Loose files')).toBeInTheDocument()
    expect(h.screen.getByText('4 staged files')).toBeInTheDocument()
    expect(
      h.screen.getByText(
        'Loose files are staged metadata, not catalog tracks.',
      ),
    ).toBeInTheDocument()
    expect(h.screen.getByText('01 Root Track.flac')).toBeInTheDocument()
    expect(
      h.screen.getByText('Root audio unclear release context'),
    ).toBeInTheDocument()
    expect(h.screen.getByText('Mixed album tags')).toBeInTheDocument()
    expect(h.screen.getAllByText('Hash present')[0]).toBeInTheDocument()
    expect(h.screen.getAllByText('Missing hash')[0]).toBeInTheDocument()
    expect(h.screen.getByText('3:42')).toBeInTheDocument()
    expect(h.screen.getAllByText('FLAC')[0]).toBeInTheDocument()
    expect(h.screen.getAllByText('lossless')[0]).toBeInTheDocument()
    expect(h.screen.getByText('Root Track')).toBeInTheDocument()
    expect(h.screen.getByText('Loose Artist')).toBeInTheDocument()
    expect(h.screen.getByText('Loose Album')).toBeInTheDocument()
  })

  it('creates a release draft from selected pending loose files', async () => {
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
    const createButton = await h.screen.findByRole('button', {
      name: /create release draft/i,
    })
    expect(createButton).toBeDisabled()

    await user.click(
      h.screen.getByRole('checkbox', { name: /select 01 root track\.flac/i }),
    )
    expect(createButton).toBeEnabled()
    await user.click(createButton)

    expect(
      await h.screen.findByText('Release draft created'),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('heading', { name: 'Loose Album' }),
    ).toBeInTheDocument()
    expect(h.screen.getByText('Consumed')).toBeInTheDocument()

    const createCall = fetchMock.mock.calls.find(([input]) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url
      return url.includes('/api/imports/import-session-loose/loose-file-drafts')
    })
    expect(createCall).toBeDefined()
    expect(createCall?.[1]?.method).toBe('POST')
    const requestBody = createCall?.[1]?.body
    expect(typeof requestBody).toBe('string')
    expect(
      JSON.parse(typeof requestBody === 'string' ? requestBody : '{}'),
    ).toEqual({
      candidateIds: ['loose-1'],
    })
  })

  it('attaches selected loose files to an existing release track', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    const fetchMock = h.mockFetch(
      importSessionsResponse(),
      importSessionDetailResponse(),
      releaseSearchResponse(),
      looseAttachCreatedResponse(),
      importSessionsResponse(),
    )
    const user = h.userEvent.setup()

    h.render(<h.App />)

    await user.click(await h.screen.findByText(looseSessionListItem.sourceRoot))
    await user.click(
      h.screen.getByRole('checkbox', { name: /select 01 root track\.flac/i }),
    )
    await user.click(
      h.screen.getByRole('button', { name: /attach to existing release/i }),
    )
    await user.type(h.screen.getByLabelText('Search releases'), 'Loose Album')
    await user.click(h.screen.getByRole('button', { name: /^search$/i }))
    await user.click(
      await h.screen.findByRole('button', { name: /loose album/i }),
    )

    expect(h.screen.getAllByText('Track 1')[0]).toBeInTheDocument()
    expect(h.screen.getAllByText('Root Track')[0]).toBeInTheDocument()
    expect(h.screen.getByText('No linked local file')).toBeInTheDocument()
    await user.click(
      h.screen.getByRole('button', { name: /confirm attachment/i }),
    )

    expect(
      await h.screen.findByText('Loose files attached'),
    ).toBeInTheDocument()
    expect(h.screen.getByText('Consumed')).toBeInTheDocument()
    const attachCall = fetchMock.mock.calls.find(([input]) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url
      return url.includes(
        '/api/imports/import-session-loose/loose-file-attachments',
      )
    })
    expect(attachCall).toBeDefined()
    expect(attachCall?.[1]?.method).toBe('POST')
    const requestBody = attachCall?.[1]?.body
    expect(typeof requestBody).toBe('string')
    expect(
      JSON.parse(typeof requestBody === 'string' ? requestBody : '{}'),
    ).toEqual({
      releaseId: 'release-loose-album',
      mappings: [
        {
          candidateId: 'loose-1',
          releaseTrackId: 'release-track-root',
          confirmRelink: false,
        },
      ],
    })
  })

  it('requires explicit confirmation before replacing an existing release track file link', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    const linkedRelease = {
      ...attachRelease,
      tracklist: [
        {
          ...attachReleaseTrack,
          linkedLocalFiles: [
            {
              localAudioFileId: 'local-existing',
              path: '/Music/Existing.flac',
              contentHash: 'old-hash',
              format: 'flac',
            },
          ],
        },
      ],
    }
    const fetchMock = h.mockFetch(
      importSessionsResponse(),
      importSessionDetailResponse(),
      releaseSearchResponse(linkedRelease),
      h.jsonResponse(
        {
          code: 'release_import_loose_file.link_exists',
          message:
            'Release track already has a linked local file; confirm relink before replacing it',
        },
        400,
      ),
      looseAttachCreatedResponse(),
      importSessionsResponse(),
    )
    const user = h.userEvent.setup()

    h.render(<h.App />)

    await user.click(await h.screen.findByText(looseSessionListItem.sourceRoot))
    await user.click(
      h.screen.getByRole('checkbox', { name: /select 01 root track\.flac/i }),
    )
    await user.click(
      h.screen.getByRole('button', { name: /attach to existing release/i }),
    )
    await user.type(h.screen.getByLabelText('Search releases'), 'Loose Album')
    await user.click(h.screen.getByRole('button', { name: /^search$/i }))
    await user.click(
      await h.screen.findByRole('button', { name: /loose album/i }),
    )

    expect(h.screen.getByText('/Music/Existing.flac')).toBeInTheDocument()
    await user.click(
      h.screen.getByRole('button', { name: /confirm attachment/i }),
    )
    expect(
      await h.screen.findByText(
        'Release track already has a linked local file; confirm relink before replacing it',
      ),
    ).toBeInTheDocument()

    await user.click(h.screen.getByLabelText(/confirm relink/i))
    await user.click(
      h.screen.getByRole('button', { name: /confirm attachment/i }),
    )

    expect(
      await h.screen.findByText('Loose files attached'),
    ).toBeInTheDocument()
    const attachBodies = fetchMock.mock.calls
      .filter(([input]) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url
        return url.includes(
          '/api/imports/import-session-loose/loose-file-attachments',
        )
      })
      .map(([, init]) => jsonRequestBody<AttachRequestBody>(init))
    expect(attachBodies.map((body) => body.mappings[0].confirmRelink)).toEqual([
      false,
      true,
    ])
  })

  it('shows an empty loose file state for sessions without candidates', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    h.mockFetch(importSessionsResponse(), importSessionDetailResponse([]))
    const user = h.userEvent.setup()

    h.render(<h.App />)

    await user.click(await h.screen.findByText(looseSessionListItem.sourceRoot))

    expect(await h.screen.findByText('Loose files')).toBeInTheDocument()
    expect(
      h.screen.getByText('No loose files for this session.'),
    ).toBeInTheDocument()
    expect(
      h.screen.getByText('This scan did not stage unmatched file metadata.'),
    ).toBeInTheDocument()
  })

  it('filters loose files by pending, ignored, consumed, metadata, and missing hash states', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    h.mockFetch(importSessionsResponse(), importSessionDetailResponse())
    const user = h.userEvent.setup()

    h.render(<h.App />)

    await user.click(await h.screen.findByText(looseSessionListItem.sourceRoot))

    const filters = h.within(h.screen.getByLabelText('Loose file filters'))

    await user.click(await filters.findByRole('button', { name: /pending/i }))
    expect(h.screen.getByText('01 Root Track.flac')).toBeInTheDocument()
    expect(
      h.screen.getByText('Mixed Folder/02 Metadata Missing Hash.mp3'),
    ).toBeInTheDocument()
    expect(h.screen.queryByText('ignored.wav')).not.toBeInTheDocument()

    await user.click(filters.getByRole('button', { name: /ignored/i }))
    expect(h.screen.getByText('ignored.wav')).toBeInTheDocument()
    expect(h.screen.queryByText('converted.m4a')).not.toBeInTheDocument()

    await user.click(
      filters.getByRole('button', { name: /consumed \/ converted/i }),
    )
    expect(h.screen.getByText('converted.m4a')).toBeInTheDocument()
    expect(h.screen.queryByText('ignored.wav')).not.toBeInTheDocument()

    await user.click(filters.getByRole('button', { name: /has metadata/i }))
    expect(h.screen.getByText('01 Root Track.flac')).toBeInTheDocument()
    expect(
      h.screen.getByText('Mixed Folder/02 Metadata Missing Hash.mp3'),
    ).toBeInTheDocument()
    expect(h.screen.queryByText('converted.m4a')).not.toBeInTheDocument()

    await user.click(filters.getByRole('button', { name: /missing hash/i }))
    expect(
      h.screen.getByText('Mixed Folder/02 Metadata Missing Hash.mp3'),
    ).toBeInTheDocument()
    expect(h.screen.getByText('ignored.wav')).toBeInTheDocument()
    expect(h.screen.queryByText('01 Root Track.flac')).not.toBeInTheDocument()
  })
})
