import { describe, expect, it, vi } from 'vitest'
import * as api from './catalogApi'
import * as h from './catalogApiTestHarness'
import { parseYear } from './api/catalogRequestMappers'

h.setupCatalogApiAdapterTests()

describe('catalog API adapter dictionary and appearance mapping', () => {
  it('parses release years only when the full value is a four-digit year', () => {
    expect(parseYear(' 2024 ')).toBe(2024)
    expect(parseYear('2024abc')).toBeNull()
    expect(parseYear('24')).toBeNull()
    expect(parseYear('abcd')).toBeNull()
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
          h.jsonResponse({
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
          h.jsonResponse({
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
          h.jsonResponse({
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
          h.dictionaryListResponse((entry) =>
            entry.kind === 'creditRole' && entry.code === 'mainArtist'
              ? { ...entry, name: 'Lead artist' }
              : entry,
          ),
        )
      }

      return Promise.resolve(
        h.jsonResponse({ items: [], limit: 100, offset: 0, total: 0 }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const catalog = await api.loadCatalog()

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
            h.dictionaryListResponse((entry) =>
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
          return Promise.resolve(h.jsonResponse({ id: 'owned-item-id' }, 201))
        }

        return Promise.resolve(
          h.jsonResponse({ items: [], limit: 100, offset: 0, total: 0 }),
        )
      })
    vi.stubGlobal('fetch', fetchMock)

    await api.loadCatalog()
    await api.createOwnedItem({
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

    const payload = h.requestPayload<h.OwnedItemRequestPayload>(
      ownedItemPost[1],
    )

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
          h.jsonResponse({
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
          h.jsonResponse({
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
          h.jsonResponse({
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
        return Promise.resolve(h.defaultDictionaryListResponse())
      }

      return Promise.resolve(
        h.jsonResponse({ items: [], limit: 100, offset: 0, total: 0 }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const catalog = await api.loadCatalog()

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
})
