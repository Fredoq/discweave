import type { ExternalOriginalCandidateReleaseRouteDto } from '../catalog/api/catalogDtoTypes'

export type OriginalTrackDiscoveryReleaseSummary = Readonly<{
  title: string
  dateLabel: string
  authorityLabel: string
  positionLabel: string | null
  sourceUrl: string
  additionalReleaseCount: number
}>

export function originalTrackDiscoveryReleaseSummary(
  routes: readonly ExternalOriginalCandidateReleaseRouteDto[],
): OriginalTrackDiscoveryReleaseSummary | null {
  const route = earliestRoute(routes)
  if (route === null) return null

  const authority = route.discogsBinding?.releaseSource ?? route.releaseSource
  return {
    title: route.title,
    dateLabel: partialDateLabel(route.date),
    authorityLabel: route.discogsBinding ? 'Discogs' : 'MusicBrainz',
    positionLabel: route.mediumPosition
      ? `Track ${route.mediumPosition}`
      : null,
    sourceUrl: authority.sourceUrl,
    additionalReleaseCount: routes.length - 1,
  }
}

function earliestRoute(
  routes: readonly ExternalOriginalCandidateReleaseRouteDto[],
) {
  return routes.reduce<ExternalOriginalCandidateReleaseRouteDto | null>(
    (earliest, route) => {
      if (earliest === null) return route
      if (earliest.date === null) {
        return route.date === null ? earliest : route
      }
      if (route.date === null) return earliest
      return dateValue(route.date) < dateValue(earliest.date) ? route : earliest
    },
    null,
  )
}

function dateValue(
  date: NonNullable<ExternalOriginalCandidateReleaseRouteDto['date']>,
) {
  return date.year * 10_000 + (date.month ?? 0) * 100 + (date.day ?? 0)
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
