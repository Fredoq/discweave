import { describe, expect, it, vi } from 'vitest'
import * as h from './test/appTestHarness'
import type { ExternalMetadataReleaseDetailDto } from './features/catalog/catalogApi'

h.setupAppTestHooks()

function requestUrl(input: RequestInfo | URL) {
  const url =
    input instanceof Request
      ? input.url
      : input instanceof URL
        ? input.href
        : input
  return new URL(url, window.location.origin)
}

function track(overrides: Record<string, unknown> = {}) {
  return {
    id: 'draft-track-1',
    filePath: '/Music/Release/01 Track.flac',
    relativePath: 'Release/01 Track.flac',
    format: 'flac',
    sizeBytes: 12,
    lastModifiedAt: '2026-05-16T12:00:00Z',
    durationSeconds: null,
    position: 1,
    disc: 'CD 1',
    side: 'A',
    title: 'A Huge Ever Growing Pulsating Brain',
    artistNames: ['Aphex Twin'],
    artistCredits: [],
    artistSuggestions: [],
    trackSuggestions: [],
    isSkipped: false,
    selectedTrackId: null,
    selectedArtistIds: [],
    issues: [],
    ...overrides,
  }
}

function session(status: 'needsReview' | 'confirmed', tracks: unknown[]) {
  return h.jsonResponse({
    id: 'import-session-1',
    sourceRoot: '/Music',
    status: status === 'confirmed' ? 'confirmed' : 'readyForReview',
    draftCount: 1,
    trackCount: tracks.length,
    ignoredFileCount: 0,
    createdAt: '2026-05-16T12:00:00Z',
    updatedAt: '2026-05-16T12:00:00Z',
    drafts: [
      {
        id: 'draft-1',
        sourceKind: 'localFiles',
        sourcePath: '/Music/Release',
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
        genres: [],
        tags: ['local-import'],
        externalSources: [],
        coverPath: null,
        issues: [],
        tracks,
      },
    ],
  })
}

function sessionList() {
  return h.jsonResponse({
    items: [
      {
        id: 'import-session-1',
        sourceRoot: '/Music',
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

function preflight() {
  return h.jsonResponse({
    sessionId: 'import-session-1',
    draftId: 'draft-1',
    draftStatus: 'ready',
    canConfirm: true,
    outcome: 'newRelease',
    summary: {
      includedTrackCount: 2,
      skippedTrackCount: 0,
      duplicateTrackCount: 0,
      newReleases: 1,
      reusedReleases: 0,
      updatedReleases: 0,
      newTracks: 2,
      reusedTracks: 0,
      newDigitalOwnedItems: 1,
      reusedDigitalOwnedItems: 0,
      newLocalAudioFiles: 2,
      updatedLocalAudioFiles: 0,
      newDigitalTrackFileLinks: 2,
      relinkedDigitalTrackFileLinks: 0,
      unchangedDigitalTrackFileLinks: 0,
    },
    actions: [],
    tracks: [1, 2].map((position) => ({
      draftTrackId: `draft-track-${position}`,
      title: `Track ${position}`,
      position,
      isSkipped: false,
      selectedTrackId: null,
      trackAction: 'create',
      localFileAction: 'create',
      fileLinkAction: 'create',
    })),
    issues: [],
    blockingErrors: [],
  })
}

function source(externalId: string) {
  return {
    providerName: 'discogs',
    resourceType: 'release',
    externalId,
    sourceUrl: `https://www.discogs.com/release/${externalId}`,
    attribution: 'Data provided by Discogs.',
  }
}

function detail() {
  return {
    source: source('orb-1991'),
    title: "The Orb's Adventures Beyond The Ultraworld",
    artists: ['The Orb'],
    year: 1991,
    trackCount: 2,
    labels: ['Big Life'],
    formats: ['FLAC'],
    catalogNumber: 'BLRCD 5',
    barcodes: [],
    identifiers: [],
    credits: [],
    tracklist: [
      {
        title: 'A Huge Ever Growing Pulsating Brain',
        position: '1',
        disc: 'CD 1',
        side: 'A',
        durationSeconds: 1128,
        artists: ['The Orb'],
      },
      {
        title: 'Discogs version',
        position: '2',
        disc: 'CD 1',
        side: 'A',
        durationSeconds: 333,
        artists: ['The Orb'],
      },
    ],
    draft: {
      title: "The Orb's Adventures Beyond The Ultraworld",
      type: 'album',
      genres: ['Electronic'],
      year: 1991,
      releaseDate: null,
      artistCredits: [{ name: 'The Orb', role: 'mainArtist' }],
      labels: [
        {
          name: 'Big Life',
          catalogNumber: 'BLRCD 5',
          hasNoCatalogNumber: false,
        },
      ],
      tracklist: [
        {
          title: 'A Huge Ever Growing Pulsating Brain',
          position: 1,
          disc: 'CD 1',
          side: 'A',
          durationSeconds: 1128,
          artistCredits: [],
        },
        {
          title: 'Discogs version',
          position: 2,
          disc: 'CD 1',
          side: 'A',
          durationSeconds: 333,
          artistCredits: [],
        },
      ],
      externalSources: [
        {
          providerCode: 'discogs',
          resourceType: 'release',
          externalId: 'orb-1991',
          sourceUrl: 'https://www.discogs.com/release/orb-1991',
        },
      ],
    },
  }
}

describe('App partial Discogs mapping', () => {
  it('round-trips skip and keep decisions through save and confirm', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    const localTracks = [
      track(),
      track({
        id: 'draft-track-2',
        filePath: '/Music/Release/02 Kept.flac',
        relativePath: 'Release/02 Kept.flac',
        position: 2,
        title: 'Local-only version',
        durationSeconds: 321,
        side: 'B',
        artistNames: ['Local Artist'],
        artistCredits: [
          { artistId: null, name: 'Local Artist', role: 'mainArtist' },
        ],
      }),
    ]
    const discogsDetail = detail() as ExternalMetadataReleaseDetailDto
    let savedTracks: Array<Record<string, unknown>> = []
    let preflightTracks: Array<Record<string, unknown>> = []
    const fetchMock = h.vi
      .fn<Window['fetch']>()
      .mockImplementation((input, init) => {
        const url = requestUrl(input)
        if (
          url.pathname === '/api/imports' &&
          url.searchParams.get('limit') === '100'
        )
          return Promise.resolve(sessionList())
        if (
          url.pathname === '/api/imports/import-session-1' &&
          (!init?.method || init.method === 'GET')
        )
          return Promise.resolve(session('needsReview', localTracks))
        if (url.pathname === '/api/external-metadata/discogs/releases')
          return Promise.resolve(
            h.jsonResponse({
              items: [
                {
                  source: source('orb-1991'),
                  title: "The Orb's Adventures Beyond The Ultraworld",
                  artists: ['The Orb'],
                  year: 1991,
                  trackCount: 2,
                  labels: ['Big Life'],
                  formats: ['FLAC'],
                  catalogNumber: 'BLRCD 5',
                  barcodes: [],
                },
              ],
              limit: 25,
              total: 1,
            }),
          )
        if (url.pathname === '/api/external-metadata/discogs/releases/orb-1991')
          return Promise.resolve(h.jsonResponse(discogsDetail))
        if (url.pathname.endsWith('/confirmation-preflight')) {
          const body = JSON.parse((init?.body as string) ?? '{}') as {
            tracks?: Array<Record<string, unknown>>
          }
          preflightTracks = body.tracks ?? []
          return Promise.resolve(preflight())
        }
        if (
          url.pathname.endsWith('/drafts/draft-1') &&
          init?.method === 'PUT'
        ) {
          const body = JSON.parse((init.body as string) ?? '{}') as {
            tracks?: Array<Record<string, unknown>>
          }
          savedTracks = body.tracks ?? []
          return Promise.resolve(
            session(
              'needsReview',
              savedTracks.map((item, index) => ({
                ...localTracks[index],
                ...item,
                sourceKind: 'localFiles',
              })),
            ),
          )
        }
        if (url.pathname.endsWith('/drafts/draft-1/confirm'))
          return Promise.resolve(session('confirmed', localTracks))
        throw new Error(`Unexpected request: ${url.pathname}`)
      })
    h.vi.stubGlobal('fetch', fetchMock)
    const user = h.userEvent.setup()
    h.render(<h.App />)
    await user.click(await h.screen.findByRole('button', { name: /\/Music/i }))
    const lookup = await h.screen.findByRole('region', {
      name: /discogs release lookup/i,
    })
    await user.click(
      h.within(lookup).getByRole('button', { name: 'Search Discogs' }),
    )
    await user.click(
      h.within(lookup).getByRole('button', { name: 'Search Discogs releases' }),
    )
    await user.click(
      await h
        .within(lookup)
        .findByRole('button', { name: /review the orb's adventures/i }),
    )
    await user.click(
      h.within(lookup).getByRole('button', { name: 'Skip Discogs row 2' }),
    )
    const exceptions = h.screen.getByRole('region', {
      name: 'Local track exceptions',
    })
    await user.click(
      h.within(exceptions).getByRole('button', { name: 'Keep my metadata' }),
    )
    await user.click(
      h
        .within(lookup)
        .getByRole('button', { name: 'Apply selected Discogs fields' }),
    )
    await user.click(h.screen.getByRole('button', { name: /^save$/i }))
    await h.waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            url === '/api/imports/import-session-1/drafts/draft-1' &&
            init?.method === 'PUT',
        ),
      ).toBe(true),
    )
    const update = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === '/api/imports/import-session-1/drafts/draft-1' &&
        init?.method === 'PUT',
    )
    const body = JSON.parse(
      ((update?.[1] as RequestInit).body as string) ?? '{}',
    ) as { tracks: Array<Record<string, unknown>> }
    expect(body.tracks.map((item) => item.id)).toEqual([
      'draft-track-1',
      'draft-track-2',
    ])
    expect(body.tracks[0]).toMatchObject({
      id: 'draft-track-1',
      durationSeconds: 1128,
      disc: 'CD 1',
      side: 'A',
    })
    expect(body.tracks[1]).toMatchObject({
      id: 'draft-track-2',
      title: 'Local-only version',
      durationSeconds: 321,
      side: 'B',
    })
    await user.click(h.screen.getByRole('button', { name: /^confirm$/i }))
    const dialog = await h.screen.findByRole('dialog', {
      name: /confirm import draft/i,
    })
    await user.click(
      h.within(dialog).getByRole('button', { name: /confirm import/i }),
    )
    await h.waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url]) =>
            url === '/api/imports/import-session-1/drafts/draft-1/confirm',
        ),
      ).toBe(true),
    )
    expect(savedTracks.map((item) => item.id)).toEqual([
      'draft-track-1',
      'draft-track-2',
    ])
    expect(preflightTracks[1]).toMatchObject({
      id: 'draft-track-2',
      title: 'Local-only version',
      durationSeconds: 321,
      side: 'B',
    })
  })
})
