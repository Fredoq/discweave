import { describe, expect, it, vi } from 'vitest'
import * as api from './catalogApi'
import * as h from './catalogApiTestHarness'

h.setupCatalogApiAdapterTests()

describe('catalog API adapter load mapping', () => {
  it('loads collection catalog data from authenticated API routes', async () => {
    const fetchMock = vi.fn<Window['fetch']>()
    fetchMock
      .mockResolvedValueOnce(
        h.jsonResponse({
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
        h.jsonResponse({
          items: [{ id: '00000000-0000-7000-8000-000000000002', name: 'Warp' }],
          limit: 100,
          offset: 0,
          total: 1,
        }),
      )
      .mockResolvedValueOnce(
        h.jsonResponse({
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
        h.jsonResponse({
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
        h.jsonResponse({
          items: [
            {
              id: '00000000-0000-7000-8000-000000000005',
              releaseId: '00000000-0000-7000-8000-000000000003',
              release: {
                id: '00000000-0000-7000-8000-000000000003',
                title: 'Selected Ambient Works 85-92',
              },
              status: 'owned',
              medium: {
                type: 'cd',
                description: 'CD',
                discCount: 1,
              },
              details: {
                cd: {
                  discCount: 1,
                  condition: 'veryGood',
                  storageLocation: 'CD shelf',
                },
              },
            },
          ],
          limit: 100,
          offset: 0,
          total: 1,
        }),
      )
      .mockResolvedValueOnce(
        h.jsonResponse({
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
        h.jsonResponse({ items: [], limit: 100, offset: 0, total: 0 }),
      )
      .mockResolvedValueOnce(
        h.jsonResponse({
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
        h.jsonResponse({
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
      .mockResolvedValueOnce(h.defaultDictionaryListResponse())
      .mockResolvedValueOnce(h.defaultRatingCriteriaListResponse())
      .mockResolvedValueOnce(
        h.jsonResponse({
          items: [
            {
              id: '00000000-0000-7000-8000-000000000010',
              criterionId: api.defaultRatingCriteria[0].id,
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

    const catalog = await api.loadCatalog()

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
})
