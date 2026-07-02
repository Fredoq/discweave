import { trackReleaseAppearances, trackSearchText } from './trackDisplayHelpers'
import type { TrackRecord } from './tracksData'

export type TrackReleaseLinkFilter = '' | 'Linked' | 'Unlinked'

export const trackReleaseLinkFilterValues: TrackReleaseLinkFilter[] = [
  'Linked',
  'Unlinked',
]

export type TrackFilters = {
  format: string
  creditRole: string
  relationType: string
  releaseLink: TrackReleaseLinkFilter
}

export function trackReleaseLinkFilter(value: string): TrackReleaseLinkFilter {
  return value === 'Linked' || value === 'Unlinked' ? value : ''
}

export function filterVisibleTracks(
  tracks: readonly TrackRecord[],
  query: string,
  filters: TrackFilters,
) {
  const terms = queryTerms(query)
  return tracks.filter((track) => isTrackVisible(track, terms, filters))
}

function isTrackVisible(
  track: TrackRecord,
  terms: readonly string[],
  filters: TrackFilters,
) {
  return (
    matchesSearchTerms(track, terms) &&
    matchesFormatFilter(track, filters.format) &&
    matchesCreditRoleFilter(track, filters.creditRole) &&
    matchesRelationTypeFilter(track, filters.relationType) &&
    matchesReleaseLinkFilter(track, filters.releaseLink)
  )
}

function matchesSearchTerms(track: TrackRecord, terms: readonly string[]) {
  const searchText = trackSearchText(track)
  return terms.every((term) => searchText.includes(term))
}

function matchesFormatFilter(track: TrackRecord, format: string) {
  return !format || track.digitalFiles.some((file) => file.format === format)
}

function matchesCreditRoleFilter(track: TrackRecord, creditRole: string) {
  return (
    !creditRole ||
    track.credits.some((credit) =>
      trackCreditRoles(credit).includes(creditRole),
    )
  )
}

function trackCreditRoles(credit: TrackRecord['credits'][number]) {
  return credit.roles && credit.roles.length > 0 ? credit.roles : [credit.role]
}

function matchesRelationTypeFilter(track: TrackRecord, relationType: string) {
  return (
    !relationType ||
    track.relations.some((relation) => relation.type === relationType)
  )
}

function matchesReleaseLinkFilter(
  track: TrackRecord,
  releaseLink: TrackReleaseLinkFilter,
) {
  if (!releaseLink) {
    return true
  }

  const hasLinkedRelease = trackReleaseAppearances(track).some(
    (appearance) => appearance.releaseId,
  )
  return releaseLink === 'Linked' ? hasLinkedRelease : !hasLinkedRelease
}

function queryTerms(query: string) {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean)
}
