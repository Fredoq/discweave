import { describe, expect, it, vi } from 'vitest'
import {
  createRelation,
  loadRelationDetail,
  updateRelation,
} from './ownedRelationsClient'
import { defaultCatalogDictionaries } from './catalogDefaults'
import {
  toArtistRelationRecord,
  toTrackRelationRecord,
} from './catalogEntityMappers'
import * as h from '../catalogApiTestHarness'

h.setupCatalogApiAdapterTests()

describe('Relation HTTP round trip', () => {
  it('retains an existing artist period across update and server reload', async () => {
    let dto = {
      id: 'rel',
      sourceArtistId: 'a',
      targetArtistId: 'b',
      type: 'memberOf',
      startYear: 1990,
      endYear: 1995,
      sourceArtistName: 'Person A',
      targetArtistName: 'Group B',
    }
    const fetchMock = vi.fn<Window['fetch']>((_url, init) => {
      if (init?.method === 'PUT')
        dto = {
          ...dto,
          ...(JSON.parse(
            typeof init.body === 'string' ? init.body : '{}',
          ) as Partial<typeof dto>),
        }
      return Promise.resolve(h.jsonResponse(dto))
    })
    vi.stubGlobal('fetch', fetchMock)
    const loaded = await loadRelationDetail('rel')
    expect(loaded?.startYear).toBe(1990)
    await updateRelation({ ...loaded!, relationType: 'Collaboration' })
    expect(h.requestPayload(fetchMock.mock.calls[1][1])).toMatchObject({
      startYear: 1990,
      endYear: 1995,
      type: 'collaboration',
    })
    const reloaded = await loadRelationDetail('rel')
    expect(reloaded).toMatchObject({
      startYear: 1990,
      endYear: 1995,
      relationType: 'Collaboration',
    })
  })
  it('creates artist periods and explicitly clears a period when requested', async () => {
    const fetchMock = vi
      .fn<Window['fetch']>()
      .mockResolvedValue(h.jsonResponse({ id: 'rel' }))
    vi.stubGlobal('fetch', fetchMock)
    const relation = toArtistRelationRecord(
      {
        id: 'rel',
        sourceArtistId: 'a',
        targetArtistId: 'b',
        type: 'memberOf',
        startYear: 2000,
        endYear: null,
      },
      new Map(),
      defaultCatalogDictionaries,
    )
    await createRelation(relation)
    expect(h.requestPayload(fetchMock.mock.calls[0][1])).toMatchObject({
      startYear: 2000,
      endYear: null,
    })
    fetchMock.mockResolvedValueOnce(h.jsonResponse({ id: 'rel' }))
    await updateRelation({ ...relation, startYear: null, endYear: null })
    expect(h.requestPayload(fetchMock.mock.calls[1][1])).toMatchObject({
      startYear: null,
      endYear: null,
    })
  })
  it('sends only the supported track contract and rejects unsupported endpoints', async () => {
    const fetchMock = vi
      .fn<Window['fetch']>()
      .mockResolvedValue(h.jsonResponse({ id: 'rel' }))
    vi.stubGlobal('fetch', fetchMock)
    const relation = toTrackRelationRecord(
      { id: 'rel', sourceTrackId: 'a', targetTrackId: 'b', type: 'remixOf' },
      new Map(),
      defaultCatalogDictionaries,
    )
    await updateRelation(relation)
    expect(h.requestPayload(fetchMock.mock.calls[0][1])).toEqual({
      sourceTrackId: 'a',
      targetTrackId: 'b',
      type: 'remixOf',
    })
    await expect(
      updateRelation({ ...relation, sourceLink: { kind: 'release', id: 'r' } }),
    ).rejects.toThrow(
      'Relations must link two existing artists or two existing tracks',
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
