import type {
  OriginalCandidateEvidenceChannel,
  OriginalCandidateEvidenceCode,
} from '../catalog/api/catalogDtoTypes'

export function evidenceChannelLabel(
  channel: OriginalCandidateEvidenceChannel,
): string {
  switch (channel) {
    case 'localCatalog':
      return 'Local catalog'
    case 'musicBrainz':
      return 'MusicBrainz'
    case 'discogs':
      return 'Discogs'
  }
}

export function evidenceKindLabel(code: OriginalCandidateEvidenceCode): string {
  return evidenceLabels[code] ?? humanize(code)
}

export function discoveryPathLabel(path: string): string {
  switch (path) {
    case 'directedRecordingRelation':
      return 'Direct recording relation'
    case 'sharedWorkPerformance':
      return 'Shared Work performances'
    case 'sourceReleaseSibling':
      return 'Source release sibling'
    case 'sourceReleaseGroup':
      return 'Source release group'
    case 'releaseGroupSearch':
      return 'Release-group title search'
    default:
      return humanize(path)
  }
}

export function candidateRoleLabel(role: string): string {
  switch (role) {
    case 'historicalRoot':
      return 'Historical root'
    case 'immediateParent':
      return 'Immediate parent'
    case 'diagnostic':
      return 'Diagnostic lead'
    default:
      return humanize(role)
  }
}

export function candidateInferenceLabel(role: string): string {
  switch (role) {
    case 'historicalRoot':
      return 'Likely historical original, based on identity and release evidence.'
    case 'immediateParent':
      return 'Likely source version parent; review the relationship before confirming.'
    case 'diagnostic':
      return 'Useful lead, but the available structure is not strong enough to call it an original.'
    default:
      return 'MusicBrainz evidence was mapped as a lead for manual review.'
  }
}

export function inferenceCompletionLabel(complete: boolean): string {
  return complete
    ? 'MusicBrainz structural context is complete for this inference.'
    : 'Some MusicBrainz structural context is incomplete; confidence is capped.'
}

export function providerWarningLabel(warning: string): string {
  switch (warning) {
    case 'musicbrainz.work_context_incomplete':
      return 'the Work performance list was incomplete'
    case 'musicbrainz.work_candidate_limit_reached':
      return 'the Work candidates were capped before detail loading'
    case 'musicbrainz.source_release_context_incomplete':
      return 'the source release context was incomplete'
    case 'musicbrainz.source_release_limit_reached':
      return 'the source release list was capped'
    case 'musicbrainz.release_chronology_incomplete':
      return 'release chronology was incomplete'
    case 'musicbrainz.release_page_limit_reached':
      return 'the release page limit was reached'
    case 'musicbrainz.release_group_context_incomplete':
      return 'release-group context was incomplete'
    case 'musicbrainz.candidate_detail_failed':
      return 'a candidate recording detail could not be loaded'
    case 'musicbrainz.operation_budget_exhausted':
      return 'the MusicBrainz request budget was exhausted'
    default:
      return warning.replace(/^musicbrainz\./, '').replace(/_/g, ' ')
  }
}

const evidenceLabels: Partial<Record<OriginalCandidateEvidenceCode, string>> = {
  directedLineage: 'Directed lineage',
  knownLocalRoot: 'Known local original root',
  identityMatch: 'Identity match',
  versionMarker: 'Version marker',
  earlierChronology: 'Earlier chronology',
  closeDuration: 'Close duration',
  creditsSupport: 'Credits support',
  laterChronology: 'Later chronology',
  artistMismatch: 'Artist mismatch',
  materialDurationMismatch: 'Material duration mismatch',
  incompatibleVersionMarker: 'Incompatible version marker',
  incompleteChronology: 'Incomplete chronology',
  uncertainWorkMapping: 'Uncertain Work mapping',
  missingArtist: 'Missing artist',
  missingChronology: 'Missing chronology',
  missingDuration: 'Missing duration',
  missingVersionMarker: 'Missing version marker',
  sharedWork: 'Shared MusicBrainz Work',
  matchingArtist: 'Matching primary artist',
  explicitOriginalVersion: 'Explicit original-version label',
  bareBaseTitle: 'Bare base title',
  compatibleVersionRole: 'Compatible version role',
  sameOfficialRelease: 'Same official release',
  sameReleaseGroup: 'Same release group',
  fullLengthCounterpart: 'Full-length counterpart',
  earliestOfficialArtistRelease: 'Earliest official artist release',
  officialArtistRelease: 'Official artist release',
  laterOfficialRelease: 'Later official release',
  incompatibleCandidateRole: 'Incompatible candidate role',
  compilationOnly: 'Compilation-only evidence',
  promotionOnly: 'Promotion-only evidence',
  bootlegOnly: 'Bootleg-only evidence',
  workMismatch: 'Work mismatch',
  incompleteStructuralEvidence: 'Incomplete structural evidence',
}

function humanize(value: string) {
  const words = value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
