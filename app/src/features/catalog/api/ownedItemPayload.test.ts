import { describe, expect, it, vi } from 'vitest'
import type { OwnedItemRecord } from '../../ownedItems/ownedItemsData'
import * as h from '../catalogApiTestHarness'
import { buildOwnedItemRecord } from '../../ownedItems/ownedItemFormModel'
import { releaseRecords } from '../../releases/releasesData'
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
  it('rejects unrecorded ownership before any HTTP write', async () => {
    const fetchMock = vi.fn<Window['fetch']>()
    vi.stubGlobal('fetch', fetchMock)
    await expect(
      createOwnedItem({ ...base, status: 'Not recorded' }),
    ).rejects.toThrow('Select an ownership status')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('preserves a multi-disc count through a form label change and serialization', async () => {
    const fetchMock = vi
      .fn<Window['fetch']>()
      .mockResolvedValue(h.jsonResponse({ id: base.id }))
    vi.stubGlobal('fetch', fetchMock)
    const item = buildOwnedItemRecord(
      {
        ...base,
        medium: 'Archived 3xCD',
        physicalDetails: {
          discCount: 3,
          storageLocation: base.storage,
          condition: base.condition,
        },
      },
      { ...releaseRecords[0], id: base.releaseId! },
      {
        title: base.title,
        medium: 'CD',
        status: 'Owned',
        storage: base.storage,
        condition: base.condition,
        copyNote: '',
      },
      false,
      'cd',
    )
    await updateOwnedItem(item)
    expect(h.requestPayload(fetchMock.mock.calls[0][1])).toMatchObject({
      medium: { type: 'cd', discCount: 3 },
      status: 'owned',
    })
  })

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
      expect(await createOwnedItem(item)).toBe(base.id)
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
