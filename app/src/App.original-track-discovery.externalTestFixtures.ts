import type {
  ExternalOriginalCandidateListDto,
  LocalOriginalCandidateDto,
} from './features/catalog/api/catalogDtoTypes'

export function externalCandidateResponse(
  sourceTrackId: string,
  localCandidate: LocalOriginalCandidateDto,
): ExternalOriginalCandidateListDto {
  return {
    local: {
      sourceTrackId,
      hasReliableLocalCandidate: false,
      items: [localCandidate],
    },
    items: [
      {
        candidateKey:
          'musicbrainz:recording:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        localTrackId: null,
        recordingSource: {
          providerCode: 'musicbrainz',
          resourceType: 'recording',
          externalId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          sourceUrl:
            'https://musicbrainz.org/recording/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          attribution: 'MusicBrainz',
        },
        title: 'MusicBrainz Original',
        artists: ['External Artist'],
        origins: ['musicbrainz'],
        confidence: 'high',
        selectable: true,
        suggestedRelationTypeCode: 'remixOf',
        earliestKnownDate: null,
        supportingEvidence: [
          { code: 'directedLineage', channel: 'musicBrainz' },
        ],
        contradictions: [],
        missingEvidence: [],
        releaseRoutes: [],
      },
    ],
    providerStatuses: [
      {
        providerCode: 'musicbrainz',
        outcome: 'succeeded',
        errorCode: null,
        retryAfter: null,
      },
    ],
    warnings: [],
  }
}

export type AppOriginalCandidateKind =
  | 'existing-root'
  | 'standalone'
  | 'external'

export function appLocalOriginalCandidate(
  kind: AppOriginalCandidateKind,
  existingRootId: string,
  standaloneId: string,
): LocalOriginalCandidateDto {
  const existingRoot = kind === 'existing-root'
  return {
    candidateKey: `${kind}-candidate`,
    localTrackId: existingRoot ? existingRootId : standaloneId,
    title: 'Original Candidate',
    artistDisplay: 'Robin S.',
    durationSeconds: 240,
    versionYear: 1990,
    origins: ['local'],
    confidence: kind === 'external' ? 'medium' : 'high',
    selectable: true,
    isExistingRoot: existingRoot,
    memberCount: existingRoot ? 1 : 0,
    requiresPromotion: !existingRoot,
    suggestedRelationTypeCode: existingRoot ? 'remixOf' : 'versionOf',
    earliestKnownDate: {
      value: '1990',
      precision: 'year',
      complete: true,
    },
    supportingEvidence: [{ code: 'identityMatch', channel: 'localCatalog' }],
    contradictions: [],
    missingEvidence: [],
  }
}

export function deferred<Value>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}
