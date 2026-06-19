import { describe, expect, it } from 'vitest'
import { defaultCatalogDictionaries } from './catalogApi'
import { toOwnedItemRecord } from './api/catalogEntityMappers'

describe('owned item inventory API mapping', () => {
  it('maps release summaries details and inventory signals without joins', () => {
    const releaseItem = toOwnedItemRecord(
      {
        id: 'owned-blue-monday-vinyl',
        releaseId: 'release-blue-monday',
        release: {
          id: 'release-blue-monday',
          title: 'Blue Monday',
        },
        status: 'needsDigitization',
        medium: {
          type: 'vinyl',
          description: '12-inch vinyl',
          discCount: null,
        },
        details: {
          vinyl: {
            formatDescription: '12-inch vinyl',
            condition: 'veryGood',
            storageLocation: 'Shelf A3',
          },
        },
        inventorySignals: ['physicalWithoutDigital', 'needsDigitization'],
      },
      new Map(),
      [],
      defaultCatalogDictionaries,
    )
    const digitalItem = toOwnedItemRecord(
      {
        id: 'owned-ceremony-file',
        releaseId: 'release-movement',
        release: {
          id: 'release-movement',
          title: 'Movement',
        },
        status: 'owned',
        medium: {
          type: 'digital',
          description: 'Digital',
          discCount: null,
        },
        details: {
          digital: {
            releaseTrackCount: 1,
            linkedFileCount: 1,
            missingFileCount: 0,
            files: [
              {
                digitalTrackFileLinkId: 'link-ceremony-file',
                releaseTrackId: 'release-track-ceremony',
                trackId: 'track-ceremony',
                trackTitle: 'Ceremony',
                position: 1,
                localAudioFileId: 'local-ceremony-file',
                path: '/music/new-order/ceremony.mp3',
                format: 'mp3',
              },
            ],
          },
        },
        inventorySignals: ['lossyWithoutLossless', 'owned'],
      },
      new Map(),
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
    expect(digitalItem).toMatchObject({
      title: 'Movement',
      targetType: 'Release',
      targetId: 'release-movement',
      releaseId: 'release-movement',
      releaseTitle: 'Movement',
      fileFormat: 'MP3',
      digitalState: '1 local file linked',
      inventorySignals: ['lossyWithoutLossless', 'owned'],
    })
  })
})
