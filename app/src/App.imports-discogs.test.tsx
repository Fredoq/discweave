import { describe, expect, it, vi } from 'vitest'
import * as h from './test/appTestHarness'
import { DiscogsCandidateReview } from './features/releases/DiscogsCandidateReview'
import type { ExternalMetadataReleaseDetailDto } from './features/catalog/catalogApi'
import type {
  DiscogsApplyGroups,
  DiscogsCurrentRelease,
} from './features/releases/DiscogsReleaseLookupPanel'
import type { DiscogsCurrentTrackForMapping } from './features/releases/discogsTrackMapping'

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

function importSessionDetailResponse(
  status: 'needsReview' | 'confirmed',
  draftGenres: string[] = [],
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
            title: 'A Huge Ever Growing Pulsating Brain',
            artistNames: ['Aphex Twin'],
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
  })
}

function importSessionListResponse() {
  return h.jsonResponse({
    items: [
      {
        id: 'import-session-1',
        sourceRoot: '/Users/example/Music',
        status: 'readyForReview',
        draftCount: 1,
        trackCount: 1,
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

describe('App import Discogs lookup', () => {
  it('applies a reviewed Discogs release to an import draft before saving', async () => {
    vi.stubGlobal('__discweaveUseRealCatalogApi', true)
    window.history.pushState({}, '', '/imports')
    const fetchMock = h.vi
      .fn<Window['fetch']>()
      .mockImplementation((input, init) => {
        const url = requestUrl(input)

        if (
          url.pathname === '/api/imports' &&
          url.searchParams.get('limit') === '100'
        ) {
          return Promise.resolve(importSessionListResponse())
        }

        if (
          url.pathname === '/api/imports/import-session-1' &&
          (!init?.method || init.method === 'GET')
        ) {
          return Promise.resolve(importSessionDetailResponse('needsReview'))
        }

        if (url.pathname === '/api/external-metadata/discogs/releases') {
          return Promise.resolve(
            h.jsonResponse({
              items: [
                {
                  source: discogsSource('orb-1991'),
                  title: "The Orb's Adventures Beyond The Ultraworld",
                  artists: ['The Orb'],
                  year: 1991,
                  trackCount: 1,
                  labels: ['Big Life'],
                  formats: ['FLAC', 'Album'],
                  catalogNumber: 'BLRCD 5',
                  barcodes: [],
                },
              ],
              limit: 25,
              total: 1,
            }),
          )
        }

        if (
          url.pathname === '/api/external-metadata/discogs/releases/orb-1991'
        ) {
          return Promise.resolve(h.jsonResponse(discogsReleaseDetail()))
        }

        if (
          url.pathname === '/api/imports/import-session-1/drafts/draft-1' &&
          init?.method === 'PUT'
        ) {
          return Promise.resolve(importSessionDetailResponse('needsReview'))
        }

        throw new Error(`Unexpected request: ${url.pathname}`)
      })
    h.vi.stubGlobal('fetch', fetchMock)
    const user = h.userEvent.setup()

    h.render(<h.App />)

    await user.click(
      await h.screen.findByRole('button', { name: /\/Users\/example\/Music/i }),
    )
    const detail = await h.screen.findByRole('region', {
      name: /discogs release lookup/i,
    })

    await user.click(
      h.within(detail).getByRole('button', { name: 'Search Discogs' }),
    )
    await user.click(
      h.within(detail).getByRole('button', { name: 'Search Discogs releases' }),
    )
    const searchUrl = fetchMock.mock.calls
      .map(([input]) => requestUrl(input))
      .find((url) => url.pathname === '/api/external-metadata/discogs/releases')
    expect(searchUrl?.searchParams.get('trackCount')).toBe('1')
    await user.click(
      await h.within(detail).findByRole('button', {
        name: /review the orb's adventures/i,
      }),
    )
    expect(
      h
        .within(detail)
        .getAllByText((_, element) =>
          Boolean(element?.textContent?.includes('1991 · 1 track')),
        ).length,
    ).toBeGreaterThan(0)
    expect(
      h.within(detail).getAllByText(/local file links stay attached/i).length,
    ).toBeGreaterThan(0)

    await user.click(
      h.within(detail).getByRole('button', {
        name: 'Apply selected Discogs fields',
      }),
    )

    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/imports/import-session-1/drafts/draft-1',
      expect.objectContaining({ method: 'PUT' }),
    )
    expect(
      h.screen.getByDisplayValue("The Orb's Adventures Beyond The Ultraworld"),
    ).toBeVisible()
    expect(h.screen.getByLabelText('Electronic')).toBeChecked()
    expect(h.screen.queryByText('Genre Electronic')).not.toBeInTheDocument()
    expect(h.screen.getByText('Big Life')).toBeInTheDocument()
    expect(
      h.screen.getByDisplayValue('A Huge Ever Growing Pulsating Brain'),
    ).toBeVisible()
    expect(h.screen.getByLabelText('Disc')).toHaveValue('CD 1')
    expect(h.screen.getByLabelText('Side')).toHaveValue('A')
    expect(
      h.screen.getByLabelText('Inherit release main artists'),
    ).toBeChecked()
    expect(h.screen.getByDisplayValue('Release/cover.jpg')).toBeVisible()

    await user.click(h.screen.getByRole('button', { name: /^save$/i }))

    await h.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/imports/import-session-1/drafts/draft-1',
        expect.objectContaining({ method: 'PUT' }),
      )
    })
    const updateCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === '/api/imports/import-session-1/drafts/draft-1' &&
        init?.method === 'PUT',
    )
    const updateBody = JSON.parse(
      ((updateCall?.[1] as RequestInit).body as string) ?? '{}',
    ) as {
      externalSources: Array<Record<string, string>>
      tags: string[]
      tracks: Array<Record<string, unknown>>
    }
    expect(updateBody.tags).toEqual(['local-import'])
    expect(updateBody.externalSources[0]).toMatchObject({
      providerCode: 'discogs',
      resourceType: 'release',
      externalId: 'orb-1991',
      sourceUrl: 'https://www.discogs.com/release/orb-1991',
    })
    expect(updateBody.externalSources[0]).not.toHaveProperty('appliedAt')
    expect(updateBody.tracks[0]).toMatchObject({
      id: 'draft-track-1',
      title: 'A Huge Ever Growing Pulsating Brain',
      durationSeconds: 1128,
      disc: 'CD 1',
      side: 'A',
      isSkipped: false,
    })
  })

  it('blocks an unsafe imported-to-Discogs track count mismatch', () => {
    const unsafeDetail =
      discogsReleaseDetail() as ExternalMetadataReleaseDetailDto
    unsafeDetail.tracklist = [
      ...unsafeDetail.tracklist,
      {
        title: 'Back Side Of The Moon',
        position: '2',
        disc: 'CD 1',
        side: 'A',
        durationSeconds: 855,
        artists: ['The Orb'],
      },
    ]
    unsafeDetail.draft.tracklist = [
      ...unsafeDetail.draft.tracklist,
      {
        title: 'Back Side Of The Moon',
        position: 2,
        disc: 'CD 1',
        side: 'A',
        durationSeconds: 855,
        artistCredits: [],
      },
    ]

    const groups: DiscogsApplyGroups = {
      core: true,
      artists: true,
      classification: true,
      labels: true,
      tracklist: true,
    }
    const current: DiscogsCurrentRelease = {
      artists: 'Aphex Twin',
      externalSourceCount: 0,
      genres: '',
      labels: '',
      releaseDate: '',
      title: 'Imported Release',
      trackCount: 1,
      year: '1992',
    }
    const currentTracks: DiscogsCurrentTrackForMapping[] = [
      {
        id: 'draft-track-1',
        title: 'A Huge Ever Growing Pulsating Brain',
        fileName: '01 Track.flac',
        position: 1,
      },
    ]

    h.render(
      <DiscogsCandidateReview
        applyGroups={groups}
        current={current}
        currentTracks={currentTracks}
        detail={unsafeDetail}
        dictionaries={h.defaultCatalogDictionaries}
        hasSelectedGroup
        onApplyDraft={h.vi.fn()}
        onUpdateApplyGroup={h.vi.fn()}
      />,
    )

    expect(
      h.screen.getByRole('button', {
        name: 'Apply selected Discogs fields',
      }),
    ).toBeDisabled()
    expect(
      h.screen.getByText('Resolve 1 unmatched track to continue.'),
    ).toBeVisible()
  })
})

function discogsSource(externalId: string) {
  return {
    providerName: 'discogs',
    resourceType: 'release',
    externalId,
    sourceUrl: `https://www.discogs.com/release/${externalId}`,
    attribution: 'Data provided by Discogs.',
  }
}

function discogsReleaseDetail() {
  return {
    source: discogsSource('orb-1991'),
    title: "The Orb's Adventures Beyond The Ultraworld",
    artists: ['The Orb'],
    year: 1991,
    labels: ['Big Life'],
    formats: ['FLAC', 'Album'],
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
