import { describe, expect, it } from 'vitest'
import {
  externalCandidate,
  releaseRoute,
} from './useOriginalTrackDiscovery.externalTestUtils'
import { presentOriginalReleaseCandidates } from './originalTrackDiscoveryReleaseCandidates'

describe('original release candidate presentation', () => {
  it('keeps distinct matching Discogs rows available for explicit selection', () => {
    const source = {
      providerCode: 'discogs',
      resourceType: 'release',
      externalId: '12345',
      sourceUrl: 'https://www.discogs.com/release/12345',
      attribution: 'Discogs',
    }
    const candidates = [0, 1].map((rowOrdinal) =>
      externalCandidate({
        candidateKey: `discogs:12345:${rowOrdinal}`,
        recordingSource: null,
        releaseRoutes: [
          {
            ...releaseRoute('12345'),
            releaseSource: source,
            musicBrainzTrackMbid: null,
            releaseGroupSource: null,
            discogsBinding: {
              releaseSource: source,
              rowOrdinal,
              position: String(rowOrdinal + 1),
              fingerprint: 'a'.repeat(64),
            },
          },
        ],
      }),
    )
    expect(presentOriginalReleaseCandidates(candidates)).toHaveLength(2)
  })

  it('deduplicates concrete editions by Discogs release and keeps the preferred route', () => {
    const firstRoute = {
      ...releaseRoute('musicbrainz-release-a'),
      discogsBinding: {
        releaseSource: {
          providerCode: 'discogs',
          resourceType: 'release',
          externalId: '104110',
          sourceUrl: 'https://www.discogs.com/release/104110',
          attribution: 'Discogs',
        },
        rowOrdinal: 1,
        position: 'B',
        fingerprint: 'first',
      },
      isPreferred: false,
    }
    const preferredRoute = {
      ...releaseRoute('musicbrainz-release-b'),
      title: 'Earoica / Anomaly Calling Your Name',
      labels: ['Musicnow Records'],
      formats: ['12" Vinyl'],
      catalogNumber: 'MNR-008',
      trackTitle: 'Anomaly Calling Your Name',
      trackPosition: 'B',
      trackDurationSeconds: 594,
      discogsBinding: {
        ...firstRoute.discogsBinding,
        fingerprint: 'preferred',
      },
      isPreferred: true,
    }

    const result = presentOriginalReleaseCandidates([
      externalCandidate({
        candidateKey: 'recording-a',
        releaseRoutes: [firstRoute],
      }),
      externalCandidate({
        candidateKey: 'recording-b',
        releaseRoutes: [preferredRoute],
      }),
    ])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      candidateKey: 'recording-b',
      releaseKey: 'discogs:104110',
      title: 'Earoica / Anomaly Calling Your Name',
      labels: ['Musicnow Records'],
      formats: ['12" Vinyl'],
      catalogNumber: 'MNR-008',
      trackTitle: 'Anomaly Calling Your Name',
      trackPosition: 'B',
      trackDurationSeconds: 594,
    })
  })
})
