import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearCatalogForTests,
  createDesktopFolderScan,
  createOwnedItem,
  createPlaylist,
  createRelease,
  createTrack,
  defaultCatalogDictionaries,
  defaultRatingCriteria,
  deletePlaylist,
  getInitialCatalogStateForTests,
  loadCatalogLinks,
  loadCatalog,
  removeReleaseCover,
  seedCatalogForTests,
  uploadReleaseCover,
  upsertRating,
  updatePlaylist,
  updateRelease,
} from './catalogApi'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

function defaultDictionaryListResponse() {
  const items = Object.values(defaultCatalogDictionaries).flat()

  return jsonResponse({
    items,
    limit: 100,
    offset: 0,
    total: items.length,
  })
}

function defaultRatingCriteriaListResponse() {
  return jsonResponse({
    items: defaultRatingCriteria,
    limit: 100,
    offset: 0,
    total: defaultRatingCriteria.length,
  })
}

function emptyListResponse() {
  return jsonResponse({ items: [], limit: 100, offset: 0, total: 0 })
}

function dictionaryListResponse(
  mapEntry: (
    entry: (typeof defaultCatalogDictionaries)[keyof typeof defaultCatalogDictionaries][number],
  ) => (typeof defaultCatalogDictionaries)[keyof typeof defaultCatalogDictionaries][number],
) {
  const items = Object.values(defaultCatalogDictionaries).flat().map(mapEntry)

  return jsonResponse({
    items,
    limit: 100,
    offset: 0,
    total: items.length,
  })
}

type ReleaseRequestPayload = {
  tracklist?: Array<Record<string, unknown>>
}

type OwnedItemRequestPayload = {
  medium?: {
    type?: string
    format?: string
  }
}

function releaseRequestPayload(init: RequestInit | undefined) {
  return requestPayload<ReleaseRequestPayload>(init)
}

function requestPayload<T>(init: RequestInit | undefined) {
  if (!init || typeof init.body !== 'string') {
    throw new Error('Expected a JSON request body')
  }

  return JSON.parse(init.body) as T
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
    clearCatalogForTests()
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
              coverImage: {
                url: '/api/releases/00000000-0000-7000-8000-000000000003/cover-image',
                contentType: 'image/png',
                originalFileName: 'saw-front.png',
                sizeBytes: 512,
                sourceType: 'localUpload',
              },
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
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: '00000000-0000-7000-8000-000000000011',
              name: 'Duplicate watch',
              description: 'Tracks to inspect after import.',
              type: 'manual',
              rules: {
                tags: [],
                genres: [],
                media: [],
                ownershipStatuses: [],
                yearFrom: null,
                yearTo: null,
              },
              entries: [
                {
                  kind: 'track',
                  id: '00000000-0000-7000-8000-000000000004',
                  title: 'Polynomial-C',
                  subtitle: 'Aphex Twin',
                },
              ],
              results: [
                {
                  kind: 'track',
                  id: '00000000-0000-7000-8000-000000000004',
                  title: 'Polynomial-C',
                  subtitle: 'Aphex Twin',
                },
              ],
            },
          ],
          limit: 100,
          offset: 0,
          total: 1,
        }),
      )
      .mockResolvedValueOnce(defaultDictionaryListResponse())
      .mockResolvedValueOnce(defaultRatingCriteriaListResponse())
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: '00000000-0000-7000-8000-000000000010',
              criterionId: defaultRatingCriteria[0].id,
              targetType: 'track',
              targetId: '00000000-0000-7000-8000-000000000004',
              value: 9,
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
      coverImage: {
        url: '/api/releases/00000000-0000-7000-8000-000000000003/cover-image',
        contentType: 'image/png',
        originalFileName: 'saw-front.png',
        sizeBytes: 512,
        sourceType: 'localUpload',
      },
      label: 'Warp',
      title: 'Selected Ambient Works 85-92',
    })
    expect(catalog.ownedItems[0]).toMatchObject({
      medium: 'CD',
      releaseTitle: 'Selected Ambient Works 85-92',
      status: 'Owned',
    })
    expect(catalog.tracks[0].ratings).toEqual([
      expect.objectContaining({ value: 9 }),
    ])
    expect(catalog.playlists[0]).toMatchObject({
      id: '00000000-0000-7000-8000-000000000011',
      name: 'Duplicate watch',
      tracks: [{ title: 'Polynomial-C' }],
      type: 'Manual',
    })
    expect(JSON.stringify(catalog)).not.toMatch(
      /authenticated collection api|collection api|release api/i,
    )
  })

  it('rejects invalid rating values before sending a request', async () => {
    const fetchMock = vi.fn<Window['fetch']>()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      upsertRating('track', 'track-1', defaultRatingCriteria[0].id, 11),
    ).rejects.toThrow('Rating value must be an integer from 1 to 10')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uploads release covers with multipart form data', async () => {
    const fetchMock = vi.fn<Window['fetch']>().mockResolvedValue(
      jsonResponse({
        url: '/api/releases/release-id/cover-image',
        contentType: 'image/png',
        originalFileName: 'front.png',
        sizeBytes: 16,
        sourceType: 'localUpload',
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const file = new File(['cover-bytes'], 'front.png', {
      type: 'image/png',
    })

    await uploadReleaseCover('release-id', file)

    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/releases/release-id/cover-image',
    )
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      credentials: 'include',
      method: 'PUT',
    })
    const body = fetchMock.mock.calls[0][1]?.body
    expect(body).toBeInstanceOf(FormData)
    expect((body as FormData).get('file')).toBe(file)
  })

  it('removes release covers with explicit delete confirmation', async () => {
    const fetchMock = vi
      .fn<Window['fetch']>()
      .mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await removeReleaseCover('release-id')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/releases/release-id/cover-image',
      {
        credentials: 'include',
        headers: { 'X-Cratebase-Confirm-Delete': 'release-cover:release-id' },
        method: 'DELETE',
      },
    )
  })

  it('keeps test catalog track appearances in sync when release covers change', async () => {
    Reflect.deleteProperty(globalThis, '__cratebaseUseRealCatalogApi')
    seedCatalogForTests({
      artists: [],
      releases: [
        {
          id: 'release-id',
          title: 'Cover Sync EP',
          artist: 'Cover Sync Artist',
          type: 'EP',
          year: '2026',
          label: 'Not On Label',
          genres: [],
          tags: [],
          releaseNotes: '',
          ownedCopies: [],
        },
      ],
      tracks: [
        {
          id: 'track-id',
          title: 'Cover Sync Track',
          artist: 'Cover Sync Artist',
          release: {
            id: 'release-id',
            title: 'Cover Sync EP',
            artist: 'Cover Sync Artist',
            year: '2026',
            label: 'Not On Label',
          },
          trackNumber: '1',
          duration: '2:03',
          versionHint: 'Single version',
          relationHint: '',
          tags: [],
          credits: [],
          releaseAppearances: [
            {
              releaseId: 'release-id',
              releaseTitle: 'Cover Sync EP',
              releaseArtist: 'Cover Sync Artist',
              year: '2026',
              label: 'Not On Label',
              position: '1',
              duration: '2:03',
              versionNote: 'Single version',
            },
          ],
          relations: [],
          fileMetadata: {
            format: 'None recorded',
            path: 'No file linked',
            bitrate: 'Not recorded',
            sampleRate: 'Not recorded',
            channels: 'Not recorded',
            importedAt: 'Not recorded',
            checksum: 'Not recorded',
          },
        },
      ],
      ownedItems: [],
      relations: [],
      playlists: [],
    })

    const coverFile = new File(['cover-bytes'], 'front.png', {
      type: 'image/png',
    })

    await uploadReleaseCover('release-id', coverFile)

    const uploadedState = getInitialCatalogStateForTests()
    expect(uploadedState?.releases[0].coverImage).toMatchObject({
      url: '/api/releases/release-id/cover-image',
      originalFileName: 'front.png',
      sourceType: 'localUpload',
    })
    expect(
      uploadedState?.tracks[0].releaseAppearances[0].coverImage,
    ).toMatchObject({
      url: '/api/releases/release-id/cover-image',
      originalFileName: 'front.png',
      sourceType: 'localUpload',
    })

    await removeReleaseCover('release-id')

    const removedState = getInitialCatalogStateForTests()
    expect(removedState?.releases[0].coverImage).toBeUndefined()
    expect(
      removedState?.tracks[0].releaseAppearances[0].coverImage,
    ).toBeUndefined()
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
      .mockResolvedValueOnce(
        jsonResponse({ items: [], limit: 100, offset: 0, total: 0 }),
      )
      .mockResolvedValueOnce(defaultDictionaryListResponse())
      .mockResolvedValueOnce(defaultRatingCriteriaListResponse())
      .mockResolvedValueOnce(emptyListResponse())
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

  it('uses stable main artist credit codes when labels are renamed', async () => {
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
                name: 'Lead Artist',
              },
              {
                id: '00000000-0000-7000-8000-000000000002',
                type: 'person',
                name: 'Producer Artist',
              },
            ],
            limit: 100,
            offset: 0,
            total: 2,
          }),
        )
      }

      if (url.pathname === '/api/releases') {
        return Promise.resolve(
          jsonResponse({
            items: [
              {
                id: '00000000-0000-7000-8000-000000000010',
                title: 'Renamed Role Release',
                type: 'album',
                labelId: null,
                year: 2026,
                genres: [],
                tags: [],
                artistCredits: [
                  {
                    artistId: '00000000-0000-7000-8000-000000000001',
                    artistName: 'Lead Artist',
                    role: 'mainArtist',
                  },
                  {
                    artistId: '00000000-0000-7000-8000-000000000002',
                    artistName: 'Producer Artist',
                    role: 'producer',
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
                id: '00000000-0000-7000-8000-000000000020',
                title: 'Renamed Role Track',
                durationSeconds: 180,
                genres: [],
                tags: [],
                credits: [
                  {
                    artistId: '00000000-0000-7000-8000-000000000001',
                    artistName: 'Lead Artist',
                    role: 'mainArtist',
                  },
                  {
                    artistId: '00000000-0000-7000-8000-000000000002',
                    artistName: 'Producer Artist',
                    role: 'producer',
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

      if (url.pathname === '/api/settings/dictionaries') {
        return Promise.resolve(
          dictionaryListResponse((entry) =>
            entry.kind === 'creditRole' && entry.code === 'mainArtist'
              ? { ...entry, name: 'Lead artist' }
              : entry,
          ),
        )
      }

      return Promise.resolve(
        jsonResponse({ items: [], limit: 100, offset: 0, total: 0 }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const catalog = await loadCatalog()

    expect(catalog.releases[0]).toMatchObject({
      artist: 'Lead Artist',
      artistCredits: [
        { artist: 'Lead Artist', role: 'Lead artist' },
        { artist: 'Producer Artist', role: 'Producer' },
      ],
    })
    expect(catalog.tracks[0]).toMatchObject({
      artist: 'Lead Artist',
      credits: [
        { artist: 'Lead Artist', role: 'Lead artist' },
        { artist: 'Producer Artist', role: 'Producer' },
      ],
    })
  })

  it('preserves mp3 format hints for custom digital media dictionaries', async () => {
    const fetchMock = vi
      .fn<Window['fetch']>()
      .mockImplementation((input, init) => {
        const requestUrl =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url
        const url = new URL(requestUrl, 'http://localhost')

        if (url.pathname === '/api/settings/dictionaries') {
          return Promise.resolve(
            dictionaryListResponse((entry) =>
              entry.kind === 'mediaType' && entry.code === 'digital'
                ? {
                    ...entry,
                    code: 'mp3Digital',
                    name: 'MP3 digital',
                    mediaProfile: 'digital',
                  }
                : entry,
            ),
          )
        }

        if (url.pathname === '/api/owned-items' && init?.method === 'POST') {
          return Promise.resolve(jsonResponse({ id: 'owned-item-id' }, 201))
        }

        return Promise.resolve(
          jsonResponse({ items: [], limit: 100, offset: 0, total: 0 }),
        )
      })
    vi.stubGlobal('fetch', fetchMock)

    await loadCatalog()
    await createOwnedItem({
      id: 'owned-item-id',
      title: 'Owned MP3',
      releaseId: '00000000-0000-7000-8000-000000000010',
      releaseTitle: 'Digital Release',
      artist: 'Digital Artist',
      medium: 'MP3 digital',
      status: 'Owned',
      statusTone: 'green',
      storage: 'Digital library',
      condition: 'No condition recorded',
      acquisition: 'Manual entry',
      copyNotes: '',
      linkedType: 'Release',
      fileFormat: 'MP3',
      digitalState: 'Digital copy recorded',
      digitizationState: 'Digital copy recorded',
      tags: [],
    })

    const ownedItemPost = fetchMock.mock.calls.find(
      ([input, init]) =>
        input === '/api/owned-items' && init?.method === 'POST',
    )
    if (!ownedItemPost) {
      throw new Error('Expected an owned item POST request')
    }

    const payload = requestPayload<OwnedItemRequestPayload>(ownedItemPost[1])

    expect(payload.medium).toMatchObject({
      type: 'mp3Digital',
      format: 'mp3',
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
                coverImage: {
                  url: '/api/releases/00000000-0000-7000-8000-000000000002/cover-image',
                  contentType: 'image/webp',
                  originalFileName: 'this-is-real.webp',
                  sizeBytes: 2048,
                  sourceType: 'localUpload',
                },
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

      if (url.pathname === '/api/settings/dictionaries') {
        return Promise.resolve(defaultDictionaryListResponse())
      }

      return Promise.resolve(
        jsonResponse({ items: [], limit: 100, offset: 0, total: 0 }),
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
    expect(catalog.tracks[0].releaseAppearances[0].coverImage).toMatchObject({
      url: '/api/releases/00000000-0000-7000-8000-000000000002/cover-image',
      contentType: 'image/webp',
      originalFileName: 'this-is-real.webp',
      sizeBytes: 2048,
      sourceType: 'localUpload',
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

      if (url.pathname === '/api/settings/dictionaries') {
        return Promise.resolve(defaultDictionaryListResponse())
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

  it('saves persistent playlists through collection scoped routes', async () => {
    const playlistResponse = {
      id: '00000000-0000-7000-8000-000000000111',
      name: 'Physical gaps',
      description: 'Manual review list.',
      type: 'manual',
      rules: {
        tags: [],
        genres: [],
        media: [],
        ownershipStatuses: [],
        yearFrom: null,
        yearTo: null,
      },
      entries: [
        {
          kind: 'release',
          id: '00000000-0000-7000-8000-000000000222',
          title: 'Selected Ambient Works 85-92',
          subtitle: '1992',
        },
      ],
      results: [
        {
          kind: 'release',
          id: '00000000-0000-7000-8000-000000000222',
          title: 'Selected Ambient Works 85-92',
          subtitle: '1992',
        },
      ],
    }
    const fetchMock = vi.fn<Window['fetch']>()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(playlistResponse, 201))
      .mockResolvedValueOnce(
        jsonResponse({ ...playlistResponse, name: 'Physical gaps updated' }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    const playlist = await createPlaylist({
      id: '00000000-0000-7000-8000-000000000111',
      name: 'Physical gaps',
      type: 'Manual',
      description: 'Manual review list.',
      curator: 'Default collection',
      updatedAt: 'Manual entry',
      yearRange: 'Any year',
      ruleHints: ['manual selection'],
      tracks: [],
      linkedReleases: [
        {
          releaseId: '00000000-0000-7000-8000-000000000222',
          title: 'Selected Ambient Works 85-92',
          artist: 'Aphex Twin',
          year: '1992',
          media: ['CD'],
          ownershipStatus: ['Owned'],
          availability: 'CD shelf',
        },
      ],
      manualSelection: {
        source: 'Manual track selection',
        note: 'Check missing digital copy.',
      },
    })

    await updatePlaylist({ ...playlist, name: 'Physical gaps updated' })
    await deletePlaylist(playlist.id)

    expect(fetchMock.mock.calls[0][0]).toBe('/api/playlists')
    expect(
      requestPayload<Record<string, unknown>>(fetchMock.mock.calls[0][1]),
    ).toMatchObject({
      name: 'Physical gaps',
      type: 'manual',
      entries: [
        {
          kind: 'release',
          id: '00000000-0000-7000-8000-000000000222',
        },
      ],
    })
    expect(fetchMock.mock.calls[1][0]).toBe(
      '/api/playlists/00000000-0000-7000-8000-000000000111',
    )
    expect(fetchMock.mock.calls[2]).toMatchObject([
      '/api/playlists/00000000-0000-7000-8000-000000000111',
      {
        headers: {
          'X-Cratebase-Confirm-Delete':
            'playlist:00000000-0000-7000-8000-000000000111',
        },
        method: 'DELETE',
      },
    ])
  })

  it('loads compact catalog links for async selectors', async () => {
    const fetchMock = vi.fn<Window['fetch']>().mockResolvedValue(
      jsonResponse({
        items: [
          {
            kind: 'playlist',
            id: '00000000-0000-7000-8000-000000000333',
            title: 'Physical gaps',
            subtitle: 'playlist',
          },
        ],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const links = await loadCatalogLinks({
      query: 'physical',
      kinds: ['playlist', 'label'],
      limit: 5,
    })

    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/catalog-links?query=physical&kinds=playlist%2Clabel&limit=5',
    )
    expect(links.items).toEqual([
      expect.objectContaining({ kind: 'playlist', title: 'Physical gaps' }),
    ])
  })

  it('creates desktop folder import scans', async () => {
    const fetchMock = vi.fn<Window['fetch']>()
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 'import-session-1',
        sourceRoot: '/Users/example/Music',
        status: 'readyForReview',
        draftCount: 1,
        trackCount: 1,
        ignoredFileCount: 0,
        createdAt: '2026-05-16T12:00:00Z',
        updatedAt: '2026-05-16T12:00:00Z',
        drafts: [],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      createDesktopFolderScan({
        sourceRoot: '/Users/example/Music',
        ignoredFileCount: 0,
        files: [
          {
            filePath: '/Users/example/Music/Release/01 Track.flac',
            relativePath: 'Release/01 Track.flac',
            format: 'flac',
            sizeBytes: 12,
            lastModifiedAt: '2026-05-16T12:00:00Z',
            contentHash:
              '70bc8f4b72a86921468bf8e8441dce51d8c6cb7d792fa7bbcb0d4d9eba328b75',
            audioMetadata: null,
            coverArtifact: null,
          },
        ],
      }),
    ).resolves.toMatchObject({
      id: 'import-session-1',
      sourceRoot: '/Users/example/Music',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/imports/desktop-folder-scans',
      {
        body: JSON.stringify({
          sourceRoot: '/Users/example/Music',
          ignoredFileCount: 0,
          files: [
            {
              filePath: '/Users/example/Music/Release/01 Track.flac',
              relativePath: 'Release/01 Track.flac',
              format: 'flac',
              sizeBytes: 12,
              lastModifiedAt: '2026-05-16T12:00:00Z',
              contentHash:
                '70bc8f4b72a86921468bf8e8441dce51d8c6cb7d792fa7bbcb0d4d9eba328b75',
              audioMetadata: null,
              coverArtifact: null,
            },
          ],
        }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      },
    )
  })
})
