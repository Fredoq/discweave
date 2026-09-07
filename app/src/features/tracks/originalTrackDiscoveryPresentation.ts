import type {
  ExternalOriginalCandidateDto,
  ExternalProviderOperationStatusDto,
  ExternalProviderSearchDiagnosticDto,
  LocalOriginalCandidateDto,
  OriginalCandidateConfidence,
  OriginalCandidateDateDto,
  OriginalCandidateEvidenceDto,
  OriginalCandidateOrigin,
} from '../catalog/api/catalogDtoTypes'

export type OriginalTrackDiscoveryCandidateKind =
  | 'local'
  | 'external'
  | 'combined'

export type ExternalOriginalTrackDiscoveryCandidate = Readonly<{
  candidateKey: string
  kind: Exclude<OriginalTrackDiscoveryCandidateKind, 'local'>
  localCandidate: LocalOriginalCandidateDto | null
  externalCandidate: ExternalOriginalCandidateDto | null
  title: string
  artistDisplay: string
  durationSeconds: number | null
  versionYear: number | null
  origins: OriginalCandidateOrigin[]
  confidence: OriginalCandidateConfidence
  selectable: boolean
  inferenceComplete: boolean
  candidateRole: string
  discoveryPaths: string[]
  suggestedRelationTypeCode: string | null
  earliestKnownDate: OriginalCandidateDateDto | null
  supportingEvidence: OriginalCandidateEvidenceDto[]
  contradictions: OriginalCandidateEvidenceDto[]
  missingEvidence: OriginalCandidateEvidenceDto[]
}>

export type OriginalTrackDiscoveryCandidate =
  | LocalOriginalCandidateDto
  | ExternalOriginalTrackDiscoveryCandidate

export function presentOriginalCandidates(
  localCandidates: readonly LocalOriginalCandidateDto[],
  externalCandidates: readonly ExternalOriginalCandidateDto[],
): OriginalTrackDiscoveryCandidate[] {
  const externalByLocalId = new Map<string, ExternalOriginalCandidateDto>()
  const unmatchedExternal: ExternalOriginalCandidateDto[] = []

  for (const candidate of externalCandidates) {
    const localId = candidate.localTrackId?.toLowerCase() ?? null
    const canCombine =
      localId !== null &&
      normalizedRecordingMbid(candidate) !== null &&
      localCandidates.some(
        (local) =>
          local.confidence === 'medium' &&
          local.localTrackId.toLowerCase() === localId,
      )
    if (canCombine) {
      externalByLocalId.set(localId, candidate)
    } else {
      unmatchedExternal.push(candidate)
    }
  }

  return [
    ...localCandidates.map((local) => {
      const external = externalByLocalId.get(local.localTrackId.toLowerCase())
      return external ? combinedCandidate(local, external) : local
    }),
    ...unmatchedExternal.map(externalCandidate),
  ]
}

export function replaceProviderItems(
  current: readonly ExternalOriginalCandidateDto[],
  replacement: readonly ExternalOriginalCandidateDto[],
  providerCode: string,
): ExternalOriginalCandidateDto[] {
  const normalizedCode = providerCode.toLowerCase()
  const retained = current.filter(
    (candidate) =>
      (
        candidate.recordingSource?.providerCode ?? candidate.origins[0]
      )?.toLowerCase() !== normalizedCode,
  )
  return mergeExactRecordingCandidates([...retained, ...replacement])
}

export function mergeExternalCandidates(
  candidates: readonly ExternalOriginalCandidateDto[],
): ExternalOriginalCandidateDto[] {
  return mergeExactRecordingCandidates(candidates)
}

export function replaceProviderStatuses(
  current: readonly ExternalProviderOperationStatusDto[],
  replacement: readonly ExternalProviderOperationStatusDto[],
  providerCode: string,
): ExternalProviderOperationStatusDto[] {
  const normalizedCode = providerCode.toLowerCase()
  return [
    ...current.filter(
      (status) => status.providerCode.toLowerCase() !== normalizedCode,
    ),
    ...replacement.filter(
      (status) => status.providerCode.toLowerCase() === normalizedCode,
    ),
  ].sort((left, right) => compareOrdinal(left.providerCode, right.providerCode))
}

export function replaceProviderWarnings(
  current: readonly string[],
  incoming: readonly string[],
  providerCode: string,
): string[] {
  const providerPrefix = `${providerCode.toLowerCase()}.`
  const retained = current.filter(
    (warning) => !warning.toLowerCase().startsWith(providerPrefix),
  )
  return [...new Set([...retained, ...incoming])].sort(compareOrdinal)
}

export function replaceSearchDiagnostics(
  current: readonly ExternalProviderSearchDiagnosticDto[],
  replacement: readonly ExternalProviderSearchDiagnosticDto[],
  providerCode: string,
) {
  const normalized = providerCode.toLowerCase()
  return [
    ...current.filter(
      (diagnostic) => diagnostic.providerCode.toLowerCase() !== normalized,
    ),
    ...replacement,
  ]
}

export function candidateOriginLabel(
  origins: readonly OriginalCandidateOrigin[],
): string {
  return origins.map(originLabel).join(' + ')
}

export function isLocalDiscoveryCandidate(
  candidate: OriginalTrackDiscoveryCandidate | null,
): candidate is LocalOriginalCandidateDto {
  return candidate !== null && !('kind' in candidate)
}

export function localCandidateForReview(
  candidate: OriginalTrackDiscoveryCandidate | null,
): LocalOriginalCandidateDto | null {
  if (candidate === null) return null
  return isLocalDiscoveryCandidate(candidate)
    ? candidate
    : candidate.localCandidate
}

function externalCandidate(
  candidate: ExternalOriginalCandidateDto,
): ExternalOriginalTrackDiscoveryCandidate {
  return {
    candidateKey: `external:${candidate.candidateKey}`,
    kind: 'external',
    localCandidate: null,
    externalCandidate: candidate,
    title: candidate.title,
    artistDisplay: candidate.artists.join(', ') || 'Unknown artist',
    durationSeconds: null,
    versionYear: null,
    origins: candidate.origins,
    confidence: candidate.confidence,
    selectable: candidate.selectable,
    inferenceComplete: candidate.inferenceComplete ?? false,
    candidateRole: candidate.candidateRole ?? 'diagnostic',
    discoveryPaths: candidate.discoveryPaths ?? [],
    suggestedRelationTypeCode: candidate.suggestedRelationTypeCode,
    earliestKnownDate: candidate.earliestKnownDate,
    supportingEvidence: candidate.supportingEvidence,
    contradictions: candidate.contradictions,
    missingEvidence: candidate.missingEvidence,
  }
}

function combinedCandidate(
  local: LocalOriginalCandidateDto,
  external: ExternalOriginalCandidateDto,
): ExternalOriginalTrackDiscoveryCandidate {
  return {
    ...externalCandidate(external),
    candidateKey: local.candidateKey,
    kind: 'combined',
    localCandidate: local,
    origins: unionOrigins(['local'], external.origins),
  }
}

function mergeExactRecordingCandidates(
  candidates: readonly ExternalOriginalCandidateDto[],
): ExternalOriginalCandidateDto[] {
  const merged = new Map<string, ExternalOriginalCandidateDto>()
  const invalid: ExternalOriginalCandidateDto[] = []
  for (const candidate of candidates) {
    const mbid = normalizedRecordingMbid(candidate)
    if (mbid === null) {
      invalid.push(candidate)
      continue
    }
    const previous = merged.get(mbid)
    merged.set(
      mbid,
      previous
        ? {
            ...candidate,
            origins: unionOrigins(previous.origins, candidate.origins),
            supportingEvidence: unionEvidence(
              previous.supportingEvidence,
              candidate.supportingEvidence,
            ),
            contradictions: unionEvidence(
              previous.contradictions,
              candidate.contradictions,
            ),
            missingEvidence: unionEvidence(
              previous.missingEvidence,
              candidate.missingEvidence,
            ),
            releaseRoutes: unionExact(
              previous.releaseRoutes,
              candidate.releaseRoutes,
            ),
          }
        : candidate,
    )
  }
  return [
    ...merged.values(),
    ...new Map(invalid.map((item) => [item.candidateKey, item])).values(),
  ]
}

function normalizedRecordingMbid(
  candidate: ExternalOriginalCandidateDto,
): string | null {
  if (
    candidate.recordingSource?.providerCode.toLowerCase() !== 'musicbrainz' ||
    candidate.recordingSource.resourceType.toLowerCase() !== 'recording'
  ) {
    return null
  }
  const value = candidate.recordingSource.externalId.toLowerCase()
  return uuidPattern.test(value) ? value : null
}

function unionOrigins(
  left: readonly OriginalCandidateOrigin[],
  right: readonly OriginalCandidateOrigin[],
): OriginalCandidateOrigin[] {
  return [...new Set([...left, ...right])]
}

function unionEvidence(
  left: readonly OriginalCandidateEvidenceDto[],
  right: readonly OriginalCandidateEvidenceDto[],
): OriginalCandidateEvidenceDto[] {
  return unionExact(left, right)
}

function unionExact<Value>(left: readonly Value[], right: readonly Value[]) {
  const keyed = new Map<string, Value>()
  for (const value of [...left, ...right]) {
    keyed.set(JSON.stringify(value), value)
  }
  return [...keyed.values()]
}

function originLabel(origin: OriginalCandidateOrigin) {
  switch (origin.toLowerCase()) {
    case 'local':
      return 'Local'
    case 'musicbrainz':
      return 'MusicBrainz'
    case 'discogs':
      return 'Discogs'
    default:
      return origin
  }
}

function compareOrdinal(left: string, right: string) {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
