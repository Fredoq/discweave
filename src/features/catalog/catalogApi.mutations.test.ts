import { describe, expect, it, vi } from 'vitest'
import * as api from './catalogApi'
import * as h from './catalogApiTestHarness'

h.setupCatalogApiAdapterTests()

describe('catalog API adapter mutations and covers', () => {
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
        headers: { 'X-Cratebase-Confirm-Delete': 'release-cover:release-id' },
        method: 'DELETE',
      },
    )
  })

  it('keeps test catalog track appearances in sync when release covers change', async () => {
    Reflect.deleteProperty(globalThis, '__cratebaseUseRealCatalogApi')
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
      digitalState: 'Digital copy recorded',
      fileFormat: 'None recorded',
      medium: 'Digital',
    })
  })

  it('creates owned items with an explicit track target through collection scoped routes', async () => {
    const fetchMock = vi
      .fn<Window['fetch']>()
      .mockResolvedValue(h.jsonResponse({ id: 'owned-item-id' }, 201))
    vi.stubGlobal('fetch', fetchMock)

    await api.createOwnedItem({
      id: 'owned-item-id',
      title: 'Track file reference',
      targetType: 'Track',
      targetId: '00000000-0000-7000-8000-000000000020',
      releaseTitle: 'Blue Monday',
      artist: 'New Order',
      medium: 'Digital',
      status: 'Owned',
      statusTone: 'green',
      storage: 'Digital library',
      condition: 'No condition recorded',
      acquisition: 'Manual entry',
      copyNotes: '',
      linkedType: 'Track',
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
      targetType: 'track',
      targetId: '00000000-0000-7000-8000-000000000020',
      status: 'owned',
      medium: { type: 'digital' },
      condition: null,
      storageLocation: 'Digital library',
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
      targetType: 'Track',
      targetId: '00000000-0000-7000-8000-000000000020',
      releaseTitle: 'Blue Monday',
      artist: 'New Order',
      medium: 'Cassette',
      status: 'Needs digitization',
      statusTone: 'amber',
      storage: 'Transfer shelf',
      condition: 'Very Good',
      acquisition: 'Manual entry',
      copyNotes: '',
      linkedType: 'Track',
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
      targetType: 'track',
      targetId: '00000000-0000-7000-8000-000000000020',
      status: 'needsDigitization',
      medium: { type: 'cassette' },
      condition: 'veryGood',
      storageLocation: 'Transfer shelf',
    })
  })
})
