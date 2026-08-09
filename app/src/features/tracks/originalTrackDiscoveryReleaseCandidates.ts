import type {
  ExternalOriginalCandidateDto,
  ExternalOriginalCandidateReleaseRouteDto,
  OriginalCandidateConfidence,
} from '../catalog/api/catalogDtoTypes'
import { externalReleaseRouteKey } from './originalTrackDiscoveryExternalDraft'

export type OriginalReleaseCandidate = Readonly<{
  releaseKey: string
  candidateKey: string
  routeKey: string
  title: string
  artists: readonly string[]
  dateLabel: string
  labels: readonly string[]
  formats: readonly string[]
  catalogNumber: string | null
  trackTitle: string | null
  trackPosition: string | null
  trackDurationSeconds: number | null
  confidence: OriginalCandidateConfidence
  releaseSourceUrl: string
  discogsSourceUrl: string | null
  preferred: boolean
}>

export function presentOriginalReleaseCandidates( // NOSONAR: candidate normalization deduplicates provider routes in one pass.
  candidates: readonly ExternalOriginalCandidateDto[],
): OriginalReleaseCandidate[] {
  const results: OriginalReleaseCandidate[] = []
  const aliases = new Map<string, number>()

  for (const candidate of candidates) {
    for (const route of candidate.releaseRoutes) {
      const item = toReleaseCandidate(candidate, route)
      const routeAliases = releaseAliases(route)
      const existingIndex = routeAliases
        .map((alias) => aliases.get(alias))
        .find((index) => index !== undefined)
      if (existingIndex === undefined) {
        const index = results.length
        results.push(item)
        for (const alias of routeAliases) aliases.set(alias, index)
        continue
      }

      if (isBetterCandidate(item, results[existingIndex])) {
        results[existingIndex] = item
      }
      for (const alias of routeAliases) aliases.set(alias, existingIndex)
    }
  }

  return results.toSorted(compareReleaseCandidates)
}

function toReleaseCandidate(
  candidate: ExternalOriginalCandidateDto,
  route: ExternalOriginalCandidateReleaseRouteDto,
): OriginalReleaseCandidate {
  const discogs = route.discogsBinding?.releaseSource ?? null
  return {
    releaseKey: discogs
      ? `discogs:${discogs.externalId}`
      : `musicbrainz:${route.releaseSource.externalId}`,
    candidateKey: candidate.candidateKey,
    routeKey: externalReleaseRouteKey(route),
    title: route.title,
    artists:
      (route.artists?.length ?? 0) > 0 ? route.artists! : candidate.artists,
    dateLabel: partialDateLabel(route.date),
    labels: route.labels ?? [],
    formats: route.formats ?? [],
    catalogNumber: route.catalogNumber ?? null,
    trackTitle: route.trackTitle ?? candidate.title,
    trackPosition: route.trackPosition ?? null,
    trackDurationSeconds: route.trackDurationSeconds ?? null,
    confidence: candidate.confidence,
    releaseSourceUrl: route.releaseSource.sourceUrl,
    discogsSourceUrl: discogs?.sourceUrl ?? null,
    preferred: route.isPreferred ?? false,
  }
}

function releaseAliases(route: ExternalOriginalCandidateReleaseRouteDto) {
  return [
    `musicbrainz:${route.releaseSource.externalId.toLowerCase()}`,
    ...(route.discogsBinding
      ? [
          `discogs:${route.discogsBinding.releaseSource.externalId.toLowerCase()}`,
        ]
      : []),
  ]
}

function isBetterCandidate(
  incoming: OriginalReleaseCandidate,
  current: OriginalReleaseCandidate,
) {
  if (incoming.preferred !== current.preferred) return incoming.preferred
  return metadataScore(incoming) > metadataScore(current)
}

function metadataScore(candidate: OriginalReleaseCandidate) {
  return (
    candidate.artists.length +
    candidate.labels.length +
    candidate.formats.length +
    Number(candidate.catalogNumber !== null) +
    Number(candidate.trackTitle !== null) +
    Number(candidate.trackPosition !== null) +
    Number(candidate.trackDurationSeconds !== null) +
    Number(candidate.discogsSourceUrl !== null)
  )
}

function compareReleaseCandidates(
  left: OriginalReleaseCandidate,
  right: OriginalReleaseCandidate,
) {
  if (left.preferred !== right.preferred) return left.preferred ? -1 : 1
  return (
    left.dateLabel.localeCompare(right.dateLabel) ||
    left.title.localeCompare(right.title)
  )
}

function partialDateLabel(
  date: ExternalOriginalCandidateReleaseRouteDto['date'],
) {
  if (date === null) return 'Unknown date'
  return [date.year, date.month, date.day]
    .filter((part) => part !== null)
    .map((part, index) =>
      index === 0 ? String(part) : String(part).padStart(2, '0'),
    )
    .join('-')
}
