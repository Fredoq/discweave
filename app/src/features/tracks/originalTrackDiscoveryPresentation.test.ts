import { describe, expect, it } from 'vitest'
import type {
  ExternalOriginalCandidateDto,
  ExternalOriginalCandidateSourceDto,
} from '../catalog/api/catalogDtoTypes'
import { replaceProviderItems } from './originalTrackDiscoveryPresentation'

describe('original track discovery provider batches', () => {
  it('removes a retried primary-provider candidate even when it has another origin', () => {
    const staleMusicBrainz = candidate({
      origins: ['local', 'musicbrainz', 'discogs'],
      releaseRoutes: [releaseRoute('stale-route')],
    })
    const independentDiscogs = candidate({
      candidateKey: 'discogs:recording:independent',
      recordingSource: source('discogs', 'recording', 'independent'),
      title: 'Independent Discogs candidate',
      origins: ['discogs'],
      releaseRoutes: [releaseRoute('independent-route', 'discogs')],
    })

    expect(
      replaceProviderItems(
        [staleMusicBrainz, independentDiscogs],
        [],
        'musicbrainz',
      ),
    ).toEqual([independentDiscogs])
  })

  it('replaces stale evidence and routes for a fresh same-MBID provider result', () => {
    const stale = candidate({
      origins: ['musicbrainz', 'discogs'],
      supportingEvidence: [
        { code: 'directedLineage', channel: 'musicBrainz' },
        { code: 'creditsSupport', channel: 'discogs' },
      ],
      releaseRoutes: [releaseRoute('stale-route')],
    })
    const fresh = candidate({
      title: 'Fresh provider title',
      origins: ['musicbrainz'],
      supportingEvidence: [
        { code: 'earlierChronology', channel: 'musicBrainz' },
      ],
      releaseRoutes: [releaseRoute('fresh-route')],
    })

    expect(replaceProviderItems([stale], [fresh], 'musicbrainz')).toEqual([
      fresh,
    ])
  })
})

function candidate(
  overrides: Partial<ExternalOriginalCandidateDto> = {},
): ExternalOriginalCandidateDto {
  return {
    candidateKey: 'musicbrainz:recording:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    localTrackId: 'local-track',
    recordingSource: source(
      'musicbrainz',
      'recording',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    ),
    title: 'MusicBrainz candidate',
    artists: ['Provider Artist'],
    origins: ['musicbrainz'],
    confidence: 'high',
    selectable: true,
    suggestedRelationTypeCode: 'remixOf',
    earliestKnownDate: null,
    supportingEvidence: [{ code: 'directedLineage', channel: 'musicBrainz' }],
    contradictions: [],
    missingEvidence: [],
    releaseRoutes: [],
    ...overrides,
  }
}

function releaseRoute(
  externalId: string,
  providerCode: 'musicbrainz' | 'discogs' = 'musicbrainz',
) {
  return {
    releaseSource: source(providerCode, 'release', externalId),
    releaseGroupSource: source(
      providerCode,
      'release-group',
      `${externalId}-group`,
    ),
    title: externalId,
    date: null,
    mediumPosition: '1',
    musicBrainzTrackMbid: `${externalId}-track`,
    releaseGroupRerecordingContext: false,
    relatedReleaseSources: [],
  }
}

function source(
  providerCode: string,
  resourceType: string,
  externalId: string,
): ExternalOriginalCandidateSourceDto {
  return {
    providerCode,
    resourceType,
    externalId,
    sourceUrl: `https://example.test/${providerCode}/${resourceType}/${externalId}`,
    attribution: providerCode === 'musicbrainz' ? 'MusicBrainz' : 'Discogs',
  }
}
