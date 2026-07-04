import { describe, expect, it, vi } from 'vitest'
import * as api from './catalogApi'
import * as h from './catalogApiTestHarness'
import type { ArtistRecord } from '../artists/artistsData'
import type { ReleaseRecord } from '../releases/releasesData'
import type { TrackRecord } from '../tracks/tracksData'

h.setupCatalogApiAdapterTests()

describe('catalog API adapter mutations and covers', () => {
  it('sends release-level external sources on create and update', async () => {
    const fetchMock = vi.fn<Window['fetch']>()
    fetchMock
      .mockResolvedValueOnce(h.jsonResponse({ id: 'release-id' }, 201))
      .mockResolvedValueOnce(h.jsonResponse({ id: 'release-id' }))
    vi.stubGlobal('fetch', fetchMock)
    const release: ReleaseRecord = {
      id: 'release-id',
      title: 'Discogs Sourced EP',
      artist: 'Source Artist',
      artistCredits: [{ artist: 'Source Artist', role: 'Main artist' }],
      type: 'EP',
      year: '2026',
      label: 'Source Label',
      labels: [
        {
          name: 'Source Label',
          catalogNumber: 'SRC-1',
          hasNoCatalogNumber: false,
        },
      ],
      genres: ['Electronic'],
      tags: [],
      releaseNotes: '',
      ownedCopies: [],
      externalSources: [
        {
          providerName: 'discogs',
          resourceType: 'release',
          externalId: '249504',
          sourceUrl: 'https://www.discogs.com/release/249504',
          appliedAt: '2026-05-31T19:00:00.000Z',
        },
      ],
    }

    await api.createRelease(release, [])
    await api.updateRelease(release, [])

    expect(fetchMock.mock.calls[0][0]).toBe('/api/releases')
    expect(fetchMock.mock.calls[1][0]).toBe('/api/releases/release-id')
    expect(
      h.requestPayload<Record<string, unknown>>(fetchMock.mock.calls[0][1]),
    ).toMatchObject({
      externalSources: release.externalSources,
    })
    expect(
      h.requestPayload<Record<string, unknown>>(fetchMock.mock.calls[1][1]),
    ).toMatchObject({
      externalSources: release.externalSources,
    })
  })

  it('sends release collection items with digital physical fields cleared', async () => {
    const fetchMock = vi
      .fn<Window['fetch']>()
      .mockResolvedValue(h.jsonResponse({ id: 'release-id' }, 201))
    vi.stubGlobal('fetch', fetchMock)
    const release: ReleaseRecord = {
      id: 'release-id',
      title: 'Wanted Digital Target',
      artist: 'Target Artist',
      artistCredits: [{ artist: 'Target Artist', role: 'Main artist' }],
      type: 'Maxisingle',
      year: '1996',
      label: 'Not On Label',
      labels: [],
      notOnLabel: true,
      genres: ['Electronic'],
      tags: [],
      releaseNotes: '',
      ownedCopies: [
        {
          id: 'wanted-digital',
          medium: 'Digital',
          status: 'Wanted',
          storage: 'No storage recorded',
          condition: 'No condition recorded',
          note: 'Find lossless digital version',
        },
        {
          id: 'owned-vinyl',
          medium: '12-inch vinyl',
          status: 'Owned',
          storage: 'Shelf A3',
          condition: 'Very Good',
          note: '',
        },
      ],
    }

    await api.createRelease(release, [])

    const payload = h.releaseRequestPayload(fetchMock.mock.calls[0][1])
    expect(payload.ownedCopies).toEqual([
      {
        status: 'wanted',
        medium: { type: 'digital' },
        condition: null,
        storageLocation: null,
        note: 'Find lossless digital version',
      },
      {
        status: 'owned',
        medium: { type: 'vinyl', description: '12-inch vinyl' },
        condition: 'veryGood',
        storageLocation: 'Shelf A3',
        note: '',
      },
    ])
    expect(payload.ownedCopy).toEqual(payload.ownedCopies?.[0])
  })

  it('sends release collection item ids and notes on update', async () => {
    const fetchMock = vi
      .fn<Window['fetch']>()
      .mockResolvedValue(h.jsonResponse({ id: 'release-id' }))
    vi.stubGlobal('fetch', fetchMock)
    const release: ReleaseRecord = {
      id: 'release-id',
      title: 'Wanted Digital Target',
      artist: 'Target Artist',
      artistCredits: [{ artist: 'Target Artist', role: 'Main artist' }],
      type: 'Maxisingle',
      year: '1996',
      label: 'Not On Label',
      labels: [],
      notOnLabel: true,
      genres: ['Electronic'],
      tags: [],
      releaseNotes: '',
      ownedCopies: [
        {
          id: '00000000-0000-7000-8000-000000000001',
          medium: 'Digital',
          status: 'Owned',
          storage: 'No storage recorded',
          condition: 'No condition recorded',
          note: 'Downloaded lossless version',
        },
        {
          id: 'manual-release-copy-new',
          medium: 'CD',
          status: 'Wanted',
          storage: '',
          condition: '',
          note: 'Find CD backup',
        },
      ],
    }

    await api.updateRelease(release, [])

    const payload = h.releaseRequestPayload(fetchMock.mock.calls[0][1])
    expect(payload.ownedCopies).toEqual([
      {
        id: '00000000-0000-7000-8000-000000000001',
        status: 'owned',
        medium: { type: 'digital' },
        condition: null,
        storageLocation: null,
        note: 'Downloaded lossless version',
      },
      {
        status: 'wanted',
        medium: { type: 'cd', discCount: 1 },
        condition: null,
        storageLocation: null,
        note: 'Find CD backup',
      },
    ])
  })

  it('sends artist external sources on create and update', async () => {
    const fetchMock = vi.fn<Window['fetch']>()
    fetchMock
      .mockResolvedValueOnce(h.jsonResponse({ id: 'artist-id' }, 201))
      .mockResolvedValueOnce(h.jsonResponse({ id: 'artist-id' }))
    vi.stubGlobal('fetch', fetchMock)
    const artist: ArtistRecord = {
      id: 'artist-id',
      name: 'Discogs Artist',
      type: 'Person',
      identityHint: null,
      aliases: [],
      members: [],
      relationHint: '',
      creditHint: '',
      relations: [],
      credits: [],
      tags: [],
      summary: '',
      externalSources: [
        {
          providerName: 'discogs',
          resourceType: 'artist',
          externalId: '5876',
          sourceUrl: 'https://www.discogs.com/artist/5876',
          appliedAt: '2026-05-31T19:00:00.000Z',
        },
      ],
    }

    await api.createArtist(artist)
    await api.updateArtist(artist)

    expect(
      h.requestPayload<Record<string, unknown>>(fetchMock.mock.calls[0][1]),
    ).toMatchObject({
      externalSources: artist.externalSources,
    })
    expect(
      h.requestPayload<Record<string, unknown>>(fetchMock.mock.calls[1][1]),
    ).toMatchObject({
      externalSources: artist.externalSources,
    })
  })

  it('sends track external sources on create and update', async () => {
    const fetchMock = vi.fn<Window['fetch']>()
    fetchMock
      .mockResolvedValueOnce(h.jsonResponse({ id: 'track-id' }, 201))
      .mockResolvedValueOnce(h.jsonResponse({ id: 'track-id' }))
    vi.stubGlobal('fetch', fetchMock)
    const track: TrackRecord = {
      id: 'track-id',
      title: 'Discogs Track',
      artist: 'Discogs Artist',
      release: {
        title: 'Discogs Release',
        artist: 'Discogs Artist',
        year: '2026',
        label: 'Source Label',
      },
      trackNumber: '1',
      duration: '04:29',
      relationHint: '',
      tags: [],
      credits: [],
      releaseAppearances: [],
      relations: [],
      digitalFiles: [],
      externalSources: [
        {
          providerName: 'discogs',
          resourceType: 'track',
          externalId: 'track-249504',
          sourceUrl: 'https://www.discogs.com/release/249504',
          appliedAt: '2026-05-31T19:00:00.000Z',
        },
      ],
    }

    await api.createTrack(track)
    await api.updateTrack(track)

    expect(
      h.requestPayload<Record<string, unknown>>(fetchMock.mock.calls[0][1]),
    ).toMatchObject({
      externalSources: track.externalSources,
    })
    expect(
      h.requestPayload<Record<string, unknown>>(fetchMock.mock.calls[1][1]),
    ).toMatchObject({
      externalSources: track.externalSources,
    })
  })

  it('rejects invalid rating values before sending a request', async () => {
    const fetchMock = vi.fn<Window['fetch']>()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      api.upsertRating('track', 'track-1', api.defaultRatingCriteria[0].id, 11),
    ).rejects.toThrow('Rating value must be an integer from 1 to 10')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uploads release covers with multipart form data', async () => {
    const fetchMock = vi.fn<Window['fetch']>().mockResolvedValue(
      h.jsonResponse({
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

    await api.uploadReleaseCover('release-id', file)

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

  it('accepts empty successful release cover upload responses', async () => {
    const fetchMock = vi
      .fn<Window['fetch']>()
      .mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const file = new File(['cover-bytes'], 'front.png', {
      type: 'image/png',
    })

    await api.uploadReleaseCover('release-id', file)

    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      credentials: 'include',
      method: 'PUT',
    })
  })

  it('removes release covers with explicit delete confirmation', async () => {
    const fetchMock = vi
      .fn<Window['fetch']>()
      .mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await api.removeReleaseCover('release-id')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/releases/release-id/cover-image',
      {
        credentials: 'include',
        headers: { 'X-DiscWeave-Confirm-Delete': 'release-cover:release-id' },
        method: 'DELETE',
      },
    )
  })

  it('keeps test catalog track appearances in sync when release covers change', async () => {
    Reflect.deleteProperty(globalThis, '__discweaveUseRealCatalogApi')
    api.seedCatalogForTests({
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
            },
          ],
          relations: [],
          digitalFiles: [],
        },
      ],
      ownedItems: [],
      relations: [],
      playlists: [],
    })

    const coverFile = new File(['cover-bytes'], 'front.png', {
      type: 'image/png',
    })

    await api.uploadReleaseCover('release-id', coverFile)

    const uploadedState = api.getInitialCatalogStateForTests()
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

    await api.removeReleaseCover('release-id')

    const removedState = api.getInitialCatalogStateForTests()
    expect(removedState?.releases[0].coverImage).toBeUndefined()
    expect(
      removedState?.tracks[0].releaseAppearances[0].coverImage,
    ).toBeUndefined()
  })

  it('keeps manual digital owned-copy placeholders from displaying an inferred file format', async () => {
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
          h.jsonResponse({
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
      }

      if (url.pathname === '/api/releases') {
        return Promise.resolve(
          h.jsonResponse({
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
      }

      if (url.pathname === '/api/owned-items') {
        return Promise.resolve(
          h.jsonResponse({
            items: [
              {
                id: '00000000-0000-7000-8000-000000000005',
                releaseId: '00000000-0000-7000-8000-000000000003',
                release: {
                  id: '00000000-0000-7000-8000-000000000003',
                  title: 'Digital Shell',
                },
                status: 'owned',
                medium: {
                  type: 'digital',
                  description: 'FLAC',
                  discCount: null,
                },
                details: {
                  digital: {
                    releaseTrackCount: 0,
                    linkedFileCount: 0,
                    missingFileCount: 0,
                    files: [],
                  },
                },
              },
            ],
            limit: 100,
            offset: 0,
            total: 1,
          }),
        )
      }

      if (url.pathname === '/api/settings/dictionaries') {
        return Promise.resolve(h.defaultDictionaryListResponse())
      }

      if (url.pathname === '/api/rating-criteria') {
        return Promise.resolve(h.defaultRatingCriteriaListResponse())
      }

      return Promise.resolve(h.emptyListResponse())
    })
    vi.stubGlobal('fetch', fetchMock)

    const catalog = await api.loadCatalog()

    expect(catalog.releases[0].ownedCopies[0]).toMatchObject({
      medium: 'Digital',
    })
    expect(catalog.ownedItems[0]).toMatchObject({
      digitalState: 'No local files linked',
      fileFormat: 'None recorded',
      medium: 'Digital',
    })
  })

  it('creates owned items with an explicit release through collection scoped routes', async () => {
    const fetchMock = vi
      .fn<Window['fetch']>()
      .mockResolvedValue(h.jsonResponse({ id: 'owned-item-id' }, 201))
    vi.stubGlobal('fetch', fetchMock)

    await api.createOwnedItem({
      id: 'owned-item-id',
      title: 'Release copy reference',
      targetType: 'Release',
      targetId: '00000000-0000-7000-8000-000000000010',
      releaseId: '00000000-0000-7000-8000-000000000010',
      releaseTitle: 'Blue Monday',
      artist: 'New Order',
      medium: 'Digital',
      status: 'Owned',
      statusTone: 'green',
      storage: 'Digital library',
      condition: 'No condition recorded',
      acquisition: 'Manual entry',
      copyNotes: '',
      linkedType: 'Release',
      fileFormat: 'None recorded',
      digitalState: 'Digital copy recorded',
      digitizationState: 'No digitization state recorded',
      tags: [],
    })

    expect(fetchMock.mock.calls[0][0]).toBe('/api/owned-items')
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      credentials: 'include',
      method: 'POST',
    })
    expect(
      h.requestPayload<h.OwnedItemRequestPayload>(fetchMock.mock.calls[0][1]),
    ).toMatchObject({
      releaseId: '00000000-0000-7000-8000-000000000010',
      status: 'owned',
      medium: { type: 'digital' },
      condition: null,
      storageLocation: null,
    })
  })

  it('updates owned item target medium status condition and storage', async () => {
    const fetchMock = vi
      .fn<Window['fetch']>()
      .mockResolvedValue(h.jsonResponse({ id: 'owned-item-id' }))
    vi.stubGlobal('fetch', fetchMock)

    await api.updateOwnedItem({
      id: 'owned-item-id',
      title: 'Transfer queue copy',
      targetType: 'Release',
      targetId: '00000000-0000-7000-8000-000000000010',
      releaseId: '00000000-0000-7000-8000-000000000010',
      releaseTitle: 'Blue Monday',
      artist: 'New Order',
      medium: 'Cassette',
      status: 'Needs digitization',
      statusTone: 'amber',
      storage: 'Transfer shelf',
      condition: 'Very Good',
      acquisition: 'Manual entry',
      copyNotes: '',
      linkedType: 'Release',
      fileFormat: 'None recorded',
      digitalState: 'No digital file recorded',
      digitizationState: 'Needs digitization',
      tags: [],
    })

    expect(fetchMock.mock.calls[0][0]).toBe('/api/owned-items/owned-item-id')
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      credentials: 'include',
      method: 'PUT',
    })
    expect(
      h.requestPayload<h.OwnedItemRequestPayload>(fetchMock.mock.calls[0][1]),
    ).toMatchObject({
      releaseId: '00000000-0000-7000-8000-000000000010',
      status: 'needsDigitization',
      medium: { type: 'cassette' },
      condition: 'veryGood',
      storageLocation: 'Transfer shelf',
    })
  })

  it('updates digital owned items without physical condition or storage payload fields', async () => {
    const fetchMock = vi
      .fn<Window['fetch']>()
      .mockResolvedValue(h.jsonResponse({ id: 'owned-item-id' }))
    vi.stubGlobal('fetch', fetchMock)

    await api.updateOwnedItem({
      id: 'owned-item-id',
      title: 'Digital copy reference',
      targetType: 'Release',
      targetId: '00000000-0000-7000-8000-000000000010',
      releaseId: '00000000-0000-7000-8000-000000000010',
      releaseTitle: 'Blue Monday',
      artist: 'New Order',
      medium: 'Digital',
      mediumType: 'digital',
      status: 'Owned',
      statusTone: 'green',
      storage: 'Digital copy',
      condition: '1 / 1 files linked',
      acquisition: 'Manual entry',
      copyNotes: '',
      linkedType: 'Release',
      fileFormat: 'FLAC',
      digitalState: '1 / 1 files linked',
      digitizationState: 'Digital source only',
      tags: [],
    })

    expect(fetchMock.mock.calls[0][0]).toBe('/api/owned-items/owned-item-id')
    expect(
      h.requestPayload<h.OwnedItemRequestPayload>(fetchMock.mock.calls[0][1]),
    ).toMatchObject({
      releaseId: '00000000-0000-7000-8000-000000000010',
      status: 'owned',
      medium: { type: 'digital' },
      condition: null,
      storageLocation: null,
    })
  })
})
