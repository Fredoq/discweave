import { describe, expect, it, vi } from 'vitest'
import * as h from './test/appTestHarness'

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
            title: 'Track',
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
                  trackCount: 2,
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
    await user.click(
      await h.within(detail).findByRole('button', {
        name: /review the orb's adventures/i,
      }),
    )
    expect(
      h
        .within(detail)
        .getAllByText((_, element) =>
          Boolean(element?.textContent?.includes('1991 · 2 tracks')),
        ).length,
    ).toBeGreaterThan(0)
    expect(
      h.within(detail).getAllByText(/updates imported file rows/i).length,
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
      providerName: 'discogs',
      resourceType: 'release',
      externalId: 'orb-1991',
      sourceUrl: 'https://www.discogs.com/release/orb-1991',
    })
    expect(updateBody.externalSources[0].appliedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T/,
    )
    expect(updateBody.tracks[0]).toMatchObject({
      id: 'draft-track-1',
      title: 'A Huge Ever Growing Pulsating Brain',
      durationSeconds: 1128,
      disc: 'CD 1',
      side: 'A',
      isSkipped: false,
    })
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
      {
        title: 'Back Side Of The Moon',
        position: '2',
        disc: 'CD 1',
        side: 'A',
        durationSeconds: 855,
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
          title: 'Back Side Of The Moon',
          position: 2,
          disc: 'CD 1',
          side: 'A',
          durationSeconds: 855,
          artistCredits: [],
        },
      ],
      externalSources: [
        {
          providerName: 'discogs',
          resourceType: 'release',
          externalId: 'orb-1991',
          sourceUrl: 'https://www.discogs.com/release/orb-1991',
        },
      ],
    },
  }
}
