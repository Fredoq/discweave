import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createRelease,
  createTrack,
  loadCatalog,
  updateRelease,
} from './catalogApi'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

type ReleaseRequestPayload = {
  tracklist?: Array<Record<string, unknown>>
}

function releaseRequestPayload(init: RequestInit | undefined) {
  if (!init || typeof init.body !== 'string') {
    throw new Error('Expected a JSON release request body')
  }

  return JSON.parse(init.body) as ReleaseRequestPayload
}

describe('catalog API adapter', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, '__cratebaseUseRealCatalogApi', {
      configurable: true,
      value: true,
    })
  })

  afterEach(() => {
    Reflect.deleteProperty(globalThis, '__cratebaseUseRealCatalogApi')
    vi.unstubAllGlobals()
  })

  it('loads collection catalog data from authenticated API routes', async () => {
    const fetchMock = vi.fn<Window['fetch']>()
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: '00000000-0000-7000-8000-000000000001',
              type: 'person',
              name: 'Aphex Twin',
            },
          ],
          limit: 100,
          offset: 0,
          total: 1,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ id: '00000000-0000-7000-8000-000000000002', name: 'Warp' }],
          limit: 100,
          offset: 0,
          total: 1,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: '00000000-0000-7000-8000-000000000003',
              title: 'Selected Ambient Works 85-92',
              type: 'album',
              labelId: '00000000-0000-7000-8000-000000000002',
              year: 1992,
              genres: ['Ambient'],
              tags: ['lossless'],
            },
          ],
          limit: 100,
          offset: 0,
          total: 1,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: '00000000-0000-7000-8000-000000000004',
              title: 'Polynomial-C',
              durationSeconds: 284,
              genres: ['IDM'],
              tags: ['album version'],
            },
            {
              id: '00000000-0000-7000-8000-000000000007',
              title: 'Polynomial-C Alternate',
              durationSeconds: 284,
              genres: ['IDM'],
              tags: ['version candidate'],
            },
          ],
          limit: 100,
          offset: 0,
          total: 2,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: '00000000-0000-7000-8000-000000000005',
              targetType: 'release',
              targetId: '00000000-0000-7000-8000-000000000003',
              status: 'owned',
              medium: {
                type: 'cd',
                description: 'CD',
                path: null,
                format: null,
                discCount: 1,
              },
              condition: 'veryGood',
              storageLocation: 'CD shelf',
            },
          ],
          limit: 100,
          offset: 0,
          total: 1,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: '00000000-0000-7000-8000-000000000006',
              contributorArtistId: '00000000-0000-7000-8000-000000000001',
              contributorName: 'Aphex Twin',
              targetType: 'release',
              targetId: '00000000-0000-7000-8000-000000000003',
              role: 'mainArtist',
            },
            {
              id: '00000000-0000-7000-8000-000000000008',
              contributorArtistId: '00000000-0000-7000-8000-000000000001',
              contributorName: 'Aphex Twin',
              targetType: 'track',
              targetId: '00000000-0000-7000-8000-000000000004',
              role: 'mainArtist',
            },
          ],
          limit: 100,
          offset: 0,
          total: 2,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ items: [], limit: 100, offset: 0, total: 0 }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: '00000000-0000-7000-8000-000000000009',
              sourceTrackId: '00000000-0000-7000-8000-000000000004',
              targetTrackId: '00000000-0000-7000-8000-000000000007',
              type: 'versionOf',
            },
          ],
          limit: 100,
          offset: 0,
          total: 1,
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const catalog = await loadCatalog()

    expect(fetchMock).toHaveBeenCalledWith('/api/artists?limit=100&offset=0', {
      credentials: 'include',
      method: 'GET',
    })
    expect(catalog.artists[0]).toMatchObject({
      id: '00000000-0000-7000-8000-000000000001',
      name: 'Aphex Twin',
      type: 'Person',
    })
    expect(catalog.releases[0]).toMatchObject({
      artist: 'Aphex Twin',
      label: 'Warp',
      title: 'Selected Ambient Works 85-92',
    })
    expect(catalog.ownedItems[0]).toMatchObject({
      medium: 'CD',
      releaseTitle: 'Selected Ambient Works 85-92',
      status: 'Owned',
    })
    expect(JSON.stringify(catalog)).not.toMatch(
      /authenticated collection api|collection api|release api/i,
    )
  })

  it('keeps manual digital owned-copy placeholders from displaying an inferred file format', async () => {
    const fetchMock = vi.fn<Window['fetch']>()
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: '00000000-0000-7000-8000-000000000001',
              type: 'person',
              name: 'Digital Artist',
            },
          ],
          limit: 100,
          offset: 0,
          total: 1,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ items: [], limit: 100, offset: 0, total: 0 }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: '00000000-0000-7000-8000-000000000003',
              title: 'Digital Shell',
              type: 'album',
              labelId: null,
              year: 2026,
              genres: [],
              tags: [],
              artistCredits: [
                {
                  artistId: '00000000-0000-7000-8000-000000000001',
                  artistName: 'Digital Artist',
                  role: 'mainArtist',
                },
              ],
            },
          ],
          limit: 100,
          offset: 0,
          total: 1,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ items: [], limit: 100, offset: 0, total: 0 }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: '00000000-0000-7000-8000-000000000005',
              targetType: 'release',
              targetId: '00000000-0000-7000-8000-000000000003',
              status: 'owned',
              medium: {
                type: 'digital',
                description: 'FLAC',
                path: '/cratebase/manual-entry-placeholder',
                format: 'flac',
                discCount: null,
              },
              condition: null,
              storageLocation: null,
            },
          ],
          limit: 100,
          offset: 0,
          total: 1,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ items: [], limit: 100, offset: 0, total: 0 }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ items: [], limit: 100, offset: 0, total: 0 }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ items: [], limit: 100, offset: 0, total: 0 }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const catalog = await loadCatalog()

    expect(catalog.releases[0].ownedCopies[0]).toMatchObject({
      medium: 'Digital',
    })
    expect(catalog.ownedItems[0]).toMatchObject({
      digitalState: 'Digital copy recorded',
      fileFormat: 'None recorded',
      medium: 'Digital',
    })
  })

  it('uses track release appearances when release tracklists are not included', async () => {
    const fetchMock = vi.fn<Window['fetch']>().mockImplementation((input) => {
      const requestUrl =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url
      const url = new URL(requestUrl, 'http://localhost')

      if (url.pathname === '/api/artists') {
        return Promise.resolve(
          jsonResponse({
            items: [
              {
                id: '00000000-0000-7000-8000-000000000001',
                type: 'person',
                name: 'Eyelar',
              },
            ],
            limit: 100,
            offset: 0,
            total: 1,
          }),
        )
      }

      if (url.pathname === '/api/releases') {
        return Promise.resolve(
          jsonResponse({
            items: [
              {
                id: '00000000-0000-7000-8000-000000000002',
                title: 'This is Real (Disappear)',
                type: 'single',
                labelId: null,
                year: 2026,
                genres: [],
                tags: [],
                artistCredits: [
                  {
                    artistId: '00000000-0000-7000-8000-000000000001',
                    artistName: 'Eyelar',
                    role: 'mainArtist',
                  },
                ],
              },
            ],
            limit: 100,
            offset: 0,
            total: 1,
          }),
        )
      }

      if (url.pathname === '/api/tracks') {
        return Promise.resolve(
          jsonResponse({
            items: [
              {
                id: '00000000-0000-7000-8000-000000000003',
                title: 'This is Real (Disappear)',
                durationSeconds: 211,
                genres: [],
                tags: [],
                releaseAppearances: [
                  {
                    releaseId: '00000000-0000-7000-8000-000000000002',
                    releaseTitle: 'This is Real (Disappear)',
                    releaseArtist: 'Eyelar',
                    year: 2026,
                    label: null,
                    position: 1,
                    durationSeconds: 211,
                    versionNote: 'Single version',
                  },
                ],
              },
            ],
            limit: 100,
            offset: 0,
            total: 1,
          }),
        )
      }

      return Promise.resolve(
        jsonResponse({
          items: [],
          limit: 100,
          offset: 0,
          total: 0,
        }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const catalog = await loadCatalog()

    expect(catalog.tracks[0]).toMatchObject({
      release: {
        id: '00000000-0000-7000-8000-000000000002',
        title: 'This is Real (Disappear)',
        artist: 'Eyelar',
        year: '2026',
      },
      trackNumber: '1',
      duration: '3:31',
      versionHint: 'Single version',
    })
  })

  it('rejects non-numeric track appearance positions before saving', async () => {
    const fetchMock = vi.fn<Window['fetch']>()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      createTrack({
        id: 'blue-monday',
        title: 'Blue Monday',
        artist: 'New Order',
        release: {
          id: '00000000-0000-7000-8000-000000000001',
          title: 'Blue Monday',
          artist: 'New Order',
          year: '1983',
          label: 'Factory',
        },
        trackNumber: 'A',
        duration: '7:29',
        versionHint: '12-inch version',
        relationHint: 'Appears on release.',
        tags: [],
        credits: [],
        releaseAppearances: [
          {
            releaseId: '00000000-0000-7000-8000-000000000001',
            releaseTitle: 'Blue Monday',
            releaseArtist: 'New Order',
            year: '1983',
            label: 'Factory',
            position: 'A',
            duration: '7:29',
            versionNote: '12-inch version',
          },
        ],
        relations: [],
        fileMetadata: {
          format: 'None recorded',
          path: 'None recorded',
          bitrate: 'None recorded',
          sampleRate: 'None recorded',
          channels: 'None recorded',
          importedAt: 'None recorded',
          checksum: 'None recorded',
        },
      }),
    ).rejects.toThrow(/positive number/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends existing track ids in release create tracklists', async () => {
    const fetchMock = vi.fn<Window['fetch']>().mockResolvedValue(
      jsonResponse({
        id: '00000000-0000-7000-8000-000000000010',
        title: 'Blue Monday Archive',
        type: 'single',
        year: 1983,
        genres: ['Synth-pop'],
        tags: [],
        labels: [],
        tracklist: [],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await createRelease(
      {
        id: '00000000-0000-7000-8000-000000000010',
        title: 'Blue Monday Archive',
        artist: 'New Order',
        artistCredits: [
          {
            artistId: '00000000-0000-7000-8000-000000000001',
            artist: 'New Order',
            role: 'Main artist',
          },
        ],
        type: 'Single',
        year: '1983',
        label: 'Factory',
        labels: [],
        genres: ['Synth-pop'],
        tags: [],
        releaseNotes: '',
        ownedCopies: [],
      },
      [
        {
          id: '00000000-0000-7000-8000-000000000020',
          title: 'Blue Monday',
          artist: 'New Order',
          artistId: '00000000-0000-7000-8000-000000000001',
          release: {
            id: '00000000-0000-7000-8000-000000000010',
            title: 'Blue Monday Archive',
            artist: 'New Order',
            year: '1983',
            label: 'Factory',
          },
          trackNumber: '2',
          duration: '7:29',
          versionHint: 'Archive appearance',
          relationHint: '',
          tags: [],
          credits: [
            {
              artistId: '00000000-0000-7000-8000-000000000001',
              artist: 'New Order',
              role: 'Main artist',
              scope: '',
            },
          ],
          releaseAppearances: [
            {
              releaseId: '00000000-0000-7000-8000-000000000002',
              releaseTitle: 'Blue Monday',
              releaseArtist: 'New Order',
              year: '1983',
              label: 'Factory',
              position: 'A',
              duration: '7:29',
              versionNote: '12-inch version',
            },
            {
              releaseId: '00000000-0000-7000-8000-000000000010',
              releaseTitle: 'Blue Monday Archive',
              releaseArtist: 'New Order',
              year: '1983',
              label: 'Factory',
              position: '2',
              duration: '7:29',
              versionNote: 'Archive appearance',
            },
          ],
          relations: [],
          fileMetadata: {
            format: 'None recorded',
            path: 'No file linked',
            bitrate: 'Not recorded',
            sampleRate: 'Not recorded',
            channels: 'Not recorded',
            importedAt: 'Manual entry',
            checksum: 'Not recorded',
          },
        },
      ],
    )

    const payload = releaseRequestPayload(fetchMock.mock.calls[0][1])

    expect(payload.tracklist).toHaveLength(1)
    const [tracklistRow] = payload.tracklist ?? []

    expect(tracklistRow).toMatchObject({
      trackId: '00000000-0000-7000-8000-000000000020',
      position: 2,
      versionNote: 'Archive appearance',
    })
    expect(tracklistRow).not.toHaveProperty('title')
    expect(tracklistRow).not.toHaveProperty('artistCredits')
  })

  it('uses row order fallback for unnumbered release tracklist rows', async () => {
    const fetchMock = vi.fn<Window['fetch']>().mockResolvedValue(
      jsonResponse({
        id: '00000000-0000-7000-8000-000000000010',
        title: 'Unnumbered Archive',
        type: 'single',
        year: 1983,
        genres: ['Synth-pop'],
        tags: [],
        labels: [],
        tracklist: [],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await createRelease(
      {
        id: '00000000-0000-7000-8000-000000000010',
        title: 'Unnumbered Archive',
        artist: 'New Order',
        artistCredits: [
          {
            artistId: '00000000-0000-7000-8000-000000000001',
            artist: 'New Order',
            role: 'Main artist',
          },
        ],
        type: 'Single',
        year: '1983',
        label: 'Factory',
        labels: [],
        genres: ['Synth-pop'],
        tags: [],
        releaseNotes: '',
        ownedCopies: [],
      },
      [
        {
          id: '00000000-0000-7000-8000-000000000020',
          title: 'Blue Monday',
          artist: 'New Order',
          artistId: '00000000-0000-7000-8000-000000000001',
          release: {
            id: '00000000-0000-7000-8000-000000000010',
            title: 'Unnumbered Archive',
            artist: 'New Order',
            year: '1983',
            label: 'Factory',
          },
          trackNumber: 'Unnumbered',
          duration: '7:29',
          versionHint: 'No version relation recorded',
          relationHint: '',
          tags: [],
          credits: [],
          releaseAppearances: [],
          relations: [],
          fileMetadata: {
            format: 'None recorded',
            path: 'No file linked',
            bitrate: 'Not recorded',
            sampleRate: 'Not recorded',
            channels: 'Not recorded',
            importedAt: 'Manual entry',
            checksum: 'Not recorded',
          },
        },
      ],
    )

    const payload = releaseRequestPayload(fetchMock.mock.calls[0][1])

    expect(payload.tracklist?.[0]).toMatchObject({
      trackId: '00000000-0000-7000-8000-000000000020',
      position: 1,
    })
  })

  it('sends desired release tracklists when updating releases', async () => {
    const fetchMock = vi.fn<Window['fetch']>().mockResolvedValue(
      jsonResponse({
        id: '00000000-0000-7000-8000-000000000010',
        title: 'Blue Monday',
        type: 'single',
        year: 1983,
        genres: ['Synth-pop'],
        tags: [],
        labels: [],
        tracklist: [],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await updateRelease(
      {
        id: '00000000-0000-7000-8000-000000000010',
        title: 'Blue Monday',
        artist: 'New Order',
        artistCredits: [
          {
            artistId: '00000000-0000-7000-8000-000000000001',
            artist: 'New Order',
            role: 'Main artist',
          },
        ],
        type: 'Single',
        year: '1983',
        label: 'Factory',
        labels: [],
        genres: ['Synth-pop'],
        tags: [],
        releaseNotes: '',
        ownedCopies: [],
      },
      [],
    )

    const payload = releaseRequestPayload(fetchMock.mock.calls[0][1])

    expect(payload.tracklist).toEqual([])
  })

  it('rejects normal catalog responses that expose collection ids', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<Window['fetch']>().mockImplementation(() =>
        Promise.resolve(
          jsonResponse({
            items: [
              {
                id: '00000000-0000-7000-8000-000000000001',
                collectionId: '00000000-0000-7000-8000-000000000099',
                type: 'person',
                name: 'Leaked Artist',
              },
            ],
            limit: 100,
            offset: 0,
            total: 1,
          }),
        ),
      ),
    )

    await expect(loadCatalog()).rejects.toThrow(/collection ids/i)
  })

  it('continues loading paged catalog endpoints until totals are reached', async () => {
    const fetchMock = vi.fn<Window['fetch']>().mockImplementation((input) => {
      const requestUrl =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url
      const url = new URL(requestUrl, 'http://localhost')
      const offset = Number(url.searchParams.get('offset') ?? 0)

      if (url.pathname === '/api/artists') {
        return Promise.resolve(
          jsonResponse({
            items: [
              {
                id: `00000000-0000-7000-8000-00000000000${offset + 1}`,
                type: 'person',
                name: offset === 0 ? 'First Page Artist' : 'Second Page Artist',
              },
            ],
            limit: 100,
            offset,
            total: 2,
          }),
        )
      }

      return Promise.resolve(
        jsonResponse({ items: [], limit: 100, offset, total: 0 }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const catalog = await loadCatalog()

    expect(catalog.artists.map((artist) => artist.name)).toEqual([
      'First Page Artist',
      'Second Page Artist',
    ])
    expect(fetchMock).toHaveBeenCalledWith('/api/artists?limit=100&offset=0', {
      credentials: 'include',
      method: 'GET',
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/artists?limit=100&offset=1', {
      credentials: 'include',
      method: 'GET',
    })
  })

  it('treats 404 catalog lists as empty collection data', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<Window['fetch']>()
        .mockImplementation(() =>
          Promise.resolve(jsonResponse({ code: 'catalog.not_found' }, 404)),
        ),
    )

    const catalog = await loadCatalog()

    expect(catalog).toMatchObject({
      artists: [],
      releases: [],
      tracks: [],
      ownedItems: [],
      relations: [],
      playlists: [],
    })
  })
})
