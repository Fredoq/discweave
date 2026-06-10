import { describe, expect, it, vi } from 'vitest'
import * as api from './catalogApi'
import * as h from './catalogApiTestHarness'
import { postEmpty, sendJson } from './api/httpClient'
import type { DesktopFolderScanFileRequest } from './catalogApi'

h.setupCatalogApiAdapterTests()

describe('catalog API adapter protocol, playlists and imports', () => {
  it('rejects normal catalog responses that expose collection ids', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<Window['fetch']>().mockImplementation(() =>
        Promise.resolve(
          h.jsonResponse({
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

    await expect(api.loadCatalog()).rejects.toThrow(/collection ids/i)
  })

  it('handles empty successful mutation responses', async () => {
    const fetchMock = vi
      .fn<Window['fetch']>()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      sendJson('/api/test', 'POST', { name: 'Test' }),
    ).resolves.toEqual({})
    await expect(postEmpty('/api/test/action')).resolves.toEqual({})

    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      credentials: 'include',
      method: 'POST',
    })
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      credentials: 'include',
      method: 'POST',
    })
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
          h.jsonResponse({
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
        return Promise.resolve(h.defaultDictionaryListResponse())
      }

      return Promise.resolve(
        h.jsonResponse({ items: [], limit: 100, offset, total: 0 }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const catalog = await api.loadCatalog()

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
          Promise.resolve(h.jsonResponse({ code: 'catalog.not_found' }, 404)),
        ),
    )

    const catalog = await api.loadCatalog()

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
      .mockResolvedValueOnce(h.jsonResponse(playlistResponse, 201))
      .mockResolvedValueOnce(
        h.jsonResponse({ ...playlistResponse, name: 'Physical gaps updated' }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    const playlist = await api.createPlaylist({
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

    await api.updatePlaylist({ ...playlist, name: 'Physical gaps updated' })
    await api.deletePlaylist(playlist.id)

    expect(fetchMock.mock.calls[0][0]).toBe('/api/playlists')
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      credentials: 'include',
    })
    expect(
      h.requestPayload<Record<string, unknown>>(fetchMock.mock.calls[0][1]),
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
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      credentials: 'include',
    })
    expect(fetchMock.mock.calls[2]).toMatchObject([
      '/api/playlists/00000000-0000-7000-8000-000000000111',
      {
        credentials: 'include',
        headers: {
          'X-DiscWeave-Confirm-Delete':
            'playlist:00000000-0000-7000-8000-000000000111',
        },
        method: 'DELETE',
      },
    ])
  })

  it('loads compact catalog links for async selectors', async () => {
    const fetchMock = vi.fn<Window['fetch']>().mockResolvedValue(
      h.jsonResponse({
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

    const links = await api.loadCatalogLinks({
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
      h.jsonResponse({
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
      api.createDesktopFolderScan({
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

  it('keeps desktop scan DTOs typed as audio files with hashes or cover artifacts only', () => {
    const coverScanFile = {
      filePath: '/Users/example/Music/Release/cover.jpg',
      relativePath: 'Release/cover.jpg',
      format: null,
      sizeBytes: 11,
      lastModifiedAt: '2026-05-16T12:00:00Z',
      audioMetadata: null,
      coverArtifact: {
        fileName: 'cover.jpg',
        extension: '.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 11,
        contentBase64: 'Y292ZXIgYnl0ZXM=',
      },
    } satisfies DesktopFolderScanFileRequest

    // @ts-expect-error Audio scan files must include a SHA-256 contentHash.
    const audioScanFileWithoutHash: DesktopFolderScanFileRequest = {
      filePath: '/Users/example/Music/Release/01 Track.flac',
      relativePath: 'Release/01 Track.flac',
      format: 'flac',
      sizeBytes: 12,
      lastModifiedAt: '2026-05-16T12:00:00Z',
      audioMetadata: null,
      coverArtifact: null,
    }

    expect(coverScanFile.coverArtifact.contentBase64).toBe('Y292ZXIgYnl0ZXM=')
    expect(audioScanFileWithoutHash.format).toBe('flac')
  })
})
