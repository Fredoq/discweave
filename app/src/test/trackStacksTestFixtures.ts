import * as h from './appTestHarness'

export function listResponse(items: unknown[]) {
  return h.jsonResponse({
    items,
    limit: 100,
    offset: 0,
    total: items.length,
  })
}

export function requestUrls(fetchMock: ReturnType<typeof h.mockFetch>) {
  return fetchMock.mock.calls.map(([input]) =>
    typeof input === 'string' ? input : (input as Request).url,
  )
}

export function createDataTransfer(): DataTransfer {
  const data = new Map<string, string>()

  return {
    dropEffect: 'none',
    effectAllowed: 'all',
    files: [] as unknown as FileList,
    items: [] as unknown as DataTransferItemList,
    get types() {
      return Array.from(data.keys())
    },
    clearData(format?: string) {
      if (format === undefined) {
        data.clear()
        return
      }

      data.delete(format)
    },
    getData(format: string) {
      return data.get(format) ?? ''
    },
    setData(format: string, value: string) {
      data.set(format, value)
    },
  } as unknown as DataTransfer
}

export function trackResponse(id: string, title: string, isOriginal = false) {
  return {
    id,
    title,
    durationSeconds: 240,
    versionYear: 1993,
    isOriginal,
    genres: [],
    tags: [],
    credits: [
      {
        artistId: 'artist-robin-s',
        artistName: 'Robin S.',
        role: 'mainArtist',
        roles: ['mainArtist'],
      },
    ],
    releaseAppearances: [
      {
        releaseId: 'release-show-me-love',
        releaseTitle: 'Show Me Love',
        releaseArtist: 'Robin S.',
        year: 1993,
        label: 'Champion',
        position: 1,
        durationSeconds: 240,
      },
    ],
    digitalFiles: [],
  }
}

export function trackRelationResponse(
  id: string,
  sourceTrackId: string,
  targetTrackId: string,
  type: string,
) {
  return {
    id,
    type,
    sourceTrackId,
    targetTrackId,
  }
}
