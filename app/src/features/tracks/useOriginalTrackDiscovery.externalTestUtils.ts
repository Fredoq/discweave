import type {
  ExternalOriginalCandidateDto,
  ExternalOriginalCandidateListDto,
  LocalOriginalCandidateDto,
  LocalOriginalCandidateListDto,
} from '../catalog/api/catalogDtoTypes'
import { CatalogApiError } from '../catalog/api/httpClient'

export function localCandidate(
  overrides: Partial<LocalOriginalCandidateDto> = {},
): LocalOriginalCandidateDto {
  return {
    candidateKey: 'local-medium',
    localTrackId: 'local-medium-track',
    title: 'Local title',
    artistDisplay: 'Local Artist',
    durationSeconds: 245,
    versionYear: 1984,
    origins: ['local'],
    confidence: 'medium',
    selectable: true,
    isExistingRoot: false,
    memberCount: 0,
    requiresPromotion: true,
    suggestedRelationTypeCode: 'remixOf',
    earliestKnownDate: null,
    supportingEvidence: [{ code: 'identityMatch', channel: 'localCatalog' }],
    contradictions: [],
    missingEvidence: [],
    ...overrides,
  }
}

export function localResponse(
  items: LocalOriginalCandidateDto[] = [localCandidate()],
  hasReliableLocalCandidate = false,
): LocalOriginalCandidateListDto {
  return { sourceTrackId: 'source-track', hasReliableLocalCandidate, items }
}

export function externalResponse(
  overrides: Partial<ExternalOriginalCandidateListDto> = {},
): ExternalOriginalCandidateListDto {
  return {
    local: localResponse(),
    items: [],
    providerStatuses: [providerStatus('musicbrainz', 'succeeded')],
    warnings: [],
    ...overrides,
  }
}

export function externalCandidate(
  overrides: Partial<ExternalOriginalCandidateDto> = {},
): ExternalOriginalCandidateDto {
  return {
    candidateKey: 'musicbrainz:recording:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    localTrackId: null,
    recordingSource: recordingSource(),
    title: 'MusicBrainz Original',
    artists: ['External Artist'],
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

export function recordingSource() {
  return {
    providerCode: 'musicbrainz',
    resourceType: 'recording',
    externalId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    sourceUrl:
      'https://musicbrainz.org/recording/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    attribution: 'MusicBrainz',
  }
}

export function providerStatus(
  providerCode: string,
  outcome: 'succeeded' | 'unavailable',
) {
  return {
    providerCode,
    outcome,
    errorCode: outcome === 'succeeded' ? null : `${providerCode}.unavailable`,
    retryAfter: null,
  } as const
}

export function releaseRoute(
  externalId: string,
  providerCode: 'musicbrainz' | 'discogs' = 'musicbrainz',
) {
  return {
    releaseSource: {
      providerCode,
      resourceType: 'release',
      externalId,
      sourceUrl: `https://example.test/${providerCode}/release/${externalId}`,
      attribution: providerCode === 'musicbrainz' ? 'MusicBrainz' : 'Discogs',
    },
    releaseGroupSource: {
      providerCode,
      resourceType: 'release-group',
      externalId: `${externalId}-group`,
      sourceUrl: `https://example.test/${providerCode}/release-group/${externalId}-group`,
      attribution: providerCode === 'musicbrainz' ? 'MusicBrainz' : 'Discogs',
    },
    title: externalId,
    date: null,
    mediumPosition: '1',
    musicBrainzTrackMbid: `${externalId}-track`,
    releaseGroupRerecordingContext: false,
    relatedReleaseSources: [],
    artists: ['External Artist'],
    labels: [],
    formats: [],
    catalogNumber: null,
    trackTitle: externalId,
    trackPosition: 'A',
    trackDurationSeconds: null,
  }
}

export async function catalogError(status: number, code: string) {
  return CatalogApiError.fromResponse(
    new Response(JSON.stringify({ code, message: `Failure ${status}` }), {
      headers: { 'Content-Type': 'application/json' },
      status,
    }),
  )
}

export function deferred<Value>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}
