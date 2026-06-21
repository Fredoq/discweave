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

    await user.click(await h.screen.findByRole('button', { name: /pending/i }))
    expect(h.screen.getByText('01 Root Track.flac')).toBeInTheDocument()
    expect(
      h.screen.getByText('Mixed Folder/02 Metadata Missing Hash.mp3'),
    ).toBeInTheDocument()
    expect(h.screen.queryByText('ignored.wav')).not.toBeInTheDocument()

    await user.click(h.screen.getByRole('button', { name: /ignored/i }))
    expect(h.screen.getByText('ignored.wav')).toBeInTheDocument()
    expect(h.screen.queryByText('converted.m4a')).not.toBeInTheDocument()

    await user.click(
      h.screen.getByRole('button', { name: /consumed \/ converted/i }),
    )
    expect(h.screen.getByText('converted.m4a')).toBeInTheDocument()
    expect(h.screen.queryByText('ignored.wav')).not.toBeInTheDocument()

    await user.click(h.screen.getByRole('button', { name: /has metadata/i }))
    expect(h.screen.getByText('01 Root Track.flac')).toBeInTheDocument()
    expect(
      h.screen.getByText('Mixed Folder/02 Metadata Missing Hash.mp3'),
    ).toBeInTheDocument()
    expect(h.screen.queryByText('converted.m4a')).not.toBeInTheDocument()

    await user.click(h.screen.getByRole('button', { name: /missing hash/i }))
    expect(
      h.screen.getByText('Mixed Folder/02 Metadata Missing Hash.mp3'),
    ).toBeInTheDocument()
    expect(h.screen.getByText('ignored.wav')).toBeInTheDocument()
    expect(h.screen.queryByText('01 Root Track.flac')).not.toBeInTheDocument()
  })
})
