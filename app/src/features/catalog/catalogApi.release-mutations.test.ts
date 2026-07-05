import { describe, expect, it, vi } from 'vitest'
import * as api from './catalogApi'
import * as h from './catalogApiTestHarness'
import type { ReleaseRecord } from '../releases/releasesData'

h.setupCatalogApiAdapterTests()

describe('catalog API adapter release mutations', () => {
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
          storage: '',
          condition: '',
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
          storage: '',
          condition: '',
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

  it('does not send release collection item placeholder storage as data', async () => {
    const fetchMock = vi
      .fn<Window['fetch']>()
      .mockResolvedValue(h.jsonResponse({ id: 'release-id' }))
    vi.stubGlobal('fetch', fetchMock)
    const release: ReleaseRecord = {
      id: 'release-id',
      title: 'Placeholder Target',
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
          id: '00000000-0000-7000-8000-000000000002',
          medium: '12-inch vinyl',
          status: 'Owned',
          storage: 'No storage recorded',
          condition: 'No condition recorded',
          note: '',
        },
      ],
    }

    await api.updateRelease(release, [])

    const payload = h.releaseRequestPayload(fetchMock.mock.calls[0][1])
    expect(payload.ownedCopies).toEqual([
      {
        id: '00000000-0000-7000-8000-000000000002',
        status: 'owned',
        medium: { type: 'vinyl', description: '12-inch vinyl' },
        condition: null,
        storageLocation: null,
        note: '',
      },
    ])
  })
})
