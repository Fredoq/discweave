import { describe, expect, it } from 'vitest'
import type {
  ExternalOriginalCandidateDiscogsBindingDto,
  ExternalOriginalCandidatePartialDateDto,
  ExternalOriginalCandidateReleaseRouteDto,
  ExternalOriginalCandidateSourceDto,
} from '../catalog/api/catalogDtoTypes'
import { originalTrackDiscoveryReleaseSummary } from './originalTrackDiscoveryReleaseSummary'

describe('originalTrackDiscoveryReleaseSummary', () => {
  it('selects the earliest dated route without changing source order', () => {
    const later = releaseRoute('Later Release', {
      year: 2001,
      month: 4,
      day: null,
    })
    const earliest = releaseRoute('First Release', {
      year: 1997,
      month: 8,
      day: 4,
    })
    const routes = [later, earliest]

    expect(originalTrackDiscoveryReleaseSummary(routes)).toMatchObject({
      title: 'First Release',
      dateLabel: '1997-08-04',
      authorityLabel: 'MusicBrainz',
      positionLabel: 'Track 1',
      sourceUrl: 'https://musicbrainz.example/release/First%20Release',
      additionalReleaseCount: 1,
    })
    expect(routes).toEqual([later, earliest])
  })

  it('prefers a dated route to an undated route and formats partial dates', () => {
    const summary = originalTrackDiscoveryReleaseSummary([
      releaseRoute('Unknown', null),
      releaseRoute('Known', { year: 1997, month: 8, day: null }),
    ])

    expect(summary?.dateLabel).toBe('1997-08')
  })

  it('keeps provider order when route dates are equal or missing', () => {
    expect(
      originalTrackDiscoveryReleaseSummary([
        releaseRoute('First Equal', { year: 1997, month: null, day: null }),
        releaseRoute('Second Equal', {
          year: 1997,
          month: null,
          day: null,
        }),
      ])?.title,
    ).toBe('First Equal')
    expect(
      originalTrackDiscoveryReleaseSummary([
        releaseRoute('First Unknown', null),
        releaseRoute('Second Unknown', null),
      ])?.title,
    ).toBe('First Unknown')
  })

  it('uses the Discogs binding as authority and source when available', () => {
    const route = releaseRoute(
      'Discogs Release',
      { year: 1997, month: null, day: null },
      {
        releaseSource: source('discogs', 'release', '42'),
        rowOrdinal: 1,
        position: 'A1',
        fingerprint: 'fingerprint',
      },
    )

    expect(originalTrackDiscoveryReleaseSummary([route])).toMatchObject({
      authorityLabel: 'Discogs',
      sourceUrl: 'https://discogs.example/release/42',
    })
  })

  it('omits an empty position and returns null without routes', () => {
    expect(
      originalTrackDiscoveryReleaseSummary([
        { ...releaseRoute('No Position', null), mediumPosition: '' },
      ]),
    ).toMatchObject({
      dateLabel: 'Unknown date',
      positionLabel: null,
      additionalReleaseCount: 0,
    })
    expect(originalTrackDiscoveryReleaseSummary([])).toBeNull()
  })
})

function source(
  providerCode: string,
  resourceType: string,
  externalId: string,
): ExternalOriginalCandidateSourceDto {
  return {
    providerCode,
    resourceType,
    externalId,
    sourceUrl: `https://${providerCode}.example/${resourceType}/${encodeURIComponent(externalId)}`,
    attribution: providerCode === 'discogs' ? 'Discogs' : 'MusicBrainz',
  }
}

function releaseRoute(
  title: string,
  date: ExternalOriginalCandidatePartialDateDto | null,
  discogsBinding: ExternalOriginalCandidateDiscogsBindingDto | null = null,
): ExternalOriginalCandidateReleaseRouteDto {
  return {
    releaseSource: source('musicbrainz', 'release', title),
    releaseGroupSource: source('musicbrainz', 'release-group', title),
    title,
    date,
    mediumPosition: '1',
    musicBrainzTrackMbid: `track-${title}`,
    releaseGroupRerecordingContext: false,
    relatedReleaseSources: [],
    discogsBinding,
  }
}
