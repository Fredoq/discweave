import { describe, expect, it, vi } from 'vitest'
import type { OwnedItemRecord } from '../../ownedItems/ownedItemsData'
import * as h from '../catalogApiTestHarness'
import { createOwnedItem, updateOwnedItem } from './ownedRelationsClient'

h.setupCatalogApiAdapterTests()

const base: OwnedItemRecord = {
  id: 'copy-one',
  title: 'Collection copy',
  releaseId: 'release-one',
  releaseTitle: 'Release',
  artist: 'Artist',
  medium: 'CD',
  mediumType: 'cd',
  status: 'Owned',
  statusTone: 'green',
  storage: 'Shelf A',
  condition: 'Near Mint',
  acquisition: 'A gift',
  copyNotes: '  Personal copy note  ',
  linkedType: 'Release',
  fileFormat: 'None recorded',
  digitalState: 'No digital file recorded',
  digitizationState: 'Not the copy note',
  tags: ['gift'],
}

describe('Owned item request payload', () => {
  it.each([
    {
      medium: 'CD',
      mediumType: 'cd',
      details: { discCount: 3 },
      expected: { type: 'cd', discCount: 3 },
    },
    {
      medium: 'Vinyl',
      mediumType: 'vinyl',
      details: { formatDescription: '2 × 180g gatefold LP' },
      expected: { type: 'vinyl', description: '2 × 180g gatefold LP' },
    },
    {
      medium: 'Cassette',
      mediumType: 'cassette',
      details: { tapeType: 'Chrome Type II' },
      expected: { type: 'cassette', description: 'Chrome Type II' },
    },
    {
      medium: 'Other',
      mediumType: 'other',
      details: { name: 'MiniDisc box' },
      expected: { type: 'other', description: 'MiniDisc box' },
    },
  ] as const)(
    'preserves $medium physical details and copyNotes on create and update',
    async ({ medium, mediumType, details, expected }) => {
      const fetchMock = vi
        .fn<Window['fetch']>()
        .mockImplementation(() =>
          Promise.resolve(h.jsonResponse({ id: base.id })),
        )
      vi.stubGlobal('fetch', fetchMock)
      const item: OwnedItemRecord = {
        ...base,
        medium,
        mediumType,
        physicalDetails: {
          ...details,
          storageLocation: base.storage,
          condition: base.condition,
        },
      }
      await createOwnedItem(item)
      await updateOwnedItem({ ...item, status: 'Wanted' })
      for (const call of fetchMock.mock.calls) {
        expect(h.requestPayload(call[1])).toMatchObject({
          releaseId: base.releaseId,
          medium: expected,
          note: 'Personal copy note',
          storageLocation: 'Shelf A',
        })
        expect(Object.keys(h.requestPayload(call[1])).sort()).toEqual([
          'condition',
          'medium',
          'note',
          'releaseId',
          'status',
          'storageLocation',
        ])
      }
      expect(fetchMock.mock.calls[0][1]?.method).toBe('POST')
      expect(fetchMock.mock.calls[1][1]?.method).toBe('PUT')
    },
  )

  it('allows clearing a copy note without substituting the derived digitization state', async () => {
    const fetchMock = vi
      .fn<Window['fetch']>()
      .mockResolvedValue(h.jsonResponse({ id: base.id }))
    vi.stubGlobal('fetch', fetchMock)
    await updateOwnedItem({ ...base, copyNotes: '   ' })
    expect(h.requestPayload(fetchMock.mock.calls[0][1])).toMatchObject({
      note: '',
    })
  })

  it('does not apply stale physical details after changing the medium type', async () => {
    const fetchMock = vi
      .fn<Window['fetch']>()
      .mockResolvedValue(h.jsonResponse({ id: base.id }))
    vi.stubGlobal('fetch', fetchMock)
    await updateOwnedItem({
      ...base,
      medium: 'Vinyl',
      physicalDetails: {
        discCount: 3,
        formatDescription: 'Stale description',
        storageLocation: base.storage,
        condition: base.condition,
      },
    })
    expect(h.requestPayload(fetchMock.mock.calls[0][1])).toMatchObject({
      medium: { type: 'vinyl', description: 'Vinyl' },
    })
  })
})
