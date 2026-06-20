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
            releaseTrackCount: 2,
            linkedFileCount: 1,
            missingFileCount: 1,
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
                codec: 'mp3',
                quality: 'lossy',
                sizeBytes: 8192,
                durationSeconds: 263,
                bitrateKbps: 320,
                sampleRateHz: 44100,
                channels: 2,
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
    expect(releaseItem).toMatchObject({
      mediumType: 'vinyl',
      physicalDetails: {
        formatDescription: '12-inch vinyl',
        storageLocation: 'Shelf A3',
        condition: 'Very Good',
      },
    })
    expect(digitalItem).toMatchObject({
      title: 'Movement',
      targetType: 'Release',
      targetId: 'release-movement',
      releaseId: 'release-movement',
      releaseTitle: 'Movement',
      medium: 'Digital',
      mediumType: 'digital',
      storage: '1 local file linked',
      condition: '1 / 2 files linked',
      fileFormat: 'MP3',
      digitalState: '1 / 2 files linked',
      inventorySignals: ['lossyWithoutLossless', 'owned'],
      digitalDetails: {
        releaseTrackCount: 2,
        linkedFileCount: 1,
        missingFileCount: 1,
        files: [
          {
            digitalTrackFileLinkId: 'link-ceremony-file',
            releaseTrackId: 'release-track-ceremony',
            trackId: 'track-ceremony',
            trackTitle: 'Ceremony',
            position: '1',
            localAudioFileId: 'local-ceremony-file',
            path: '/music/new-order/ceremony.mp3',
            format: 'MP3',
            codec: 'MP3',
            quality: 'Lossy',
            size: '8 KB',
            duration: '4:23',
            bitrate: '320 kbps',
            sampleRate: '44.1 kHz',
            channels: 'Stereo',
          },
        ],
      },
    })
    expect(digitalItem.storage).not.toBe('No storage recorded')
    expect(digitalItem.condition).not.toBe('No condition recorded')
  })
})
