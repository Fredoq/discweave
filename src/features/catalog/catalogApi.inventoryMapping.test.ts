import { describe, expect, it } from 'vitest'
import { defaultCatalogDictionaries } from './catalogApi'
import { toOwnedItemRecord } from './api/catalogEntityMappers'

describe('owned item inventory API mapping', () => {
  it('maps target summaries and inventory signals without release or track joins', () => {
    const releaseItem = toOwnedItemRecord(
      {
        id: 'owned-blue-monday-vinyl',
        targetType: 'release',
        targetId: 'release-blue-monday',
        target: {
          type: 'release',
          id: 'release-blue-monday',
          title: 'Blue Monday',
          subtitle: 'Release',
          releaseId: 'release-blue-monday',
          releaseTitle: 'Blue Monday',
        },
        status: 'needsDigitization',
        medium: {
          type: 'vinyl',
          description: '12-inch vinyl',
          path: null,
          format: null,
          discCount: null,
        },
        condition: 'veryGood',
        storageLocation: 'Shelf A3',
        inventorySignals: ['physicalWithoutDigital', 'needsDigitization'],
      },
      new Map(),
      new Map(),
      [],
      [],
      defaultCatalogDictionaries,
    )
    const trackItem = toOwnedItemRecord(
      {
        id: 'owned-ceremony-file',
        targetType: 'track',
        targetId: 'track-ceremony',
        target: {
          type: 'track',
          id: 'track-ceremony',
          title: 'Ceremony',
          subtitle: 'Movement',
          releaseId: 'release-movement',
          releaseTitle: 'Movement',
        },
        status: 'owned',
        medium: {
          type: 'digital',
          path: '/music/new-order/ceremony.mp3',
          format: 'mp3',
        },
        condition: null,
        storageLocation: 'Digital library',
        inventorySignals: ['lossyWithoutLossless', 'owned'],
      },
      new Map(),
      new Map(),
      [],
      [],
      defaultCatalogDictionaries,
    )

    expect(releaseItem).toMatchObject({
      title: 'Blue Monday',
      targetType: 'Release',
      targetId: 'release-blue-monday',
      releaseId: 'release-blue-monday',
      releaseTitle: 'Blue Monday',
      status: 'Needs digitization',
      storage: 'Shelf A3',
      condition: 'Very Good',
      inventorySignals: ['physicalWithoutDigital', 'needsDigitization'],
    })
    expect(trackItem).toMatchObject({
      title: 'Ceremony',
      targetType: 'Track',
      targetId: 'track-ceremony',
      releaseId: 'release-movement',
      releaseTitle: 'Movement',
      fileFormat: 'MP3',
      inventorySignals: ['lossyWithoutLossless', 'owned'],
    })
  })
})
