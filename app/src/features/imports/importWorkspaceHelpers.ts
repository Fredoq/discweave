import type {
  ExportRestoreResponse,
  ImportRelationSuggestion,
  ImportRelationSuggestionEndpoint,
  ImportRelationSuggestionPayload,
  ReleaseDto,
  ReleaseImportLooseFileCandidate,
  ReleaseImportSession,
} from '../catalog/catalogApi'

export function pendingRelationSuggestionId(pendingAction: string | null) {
  const prefix = 'relation-suggestion:'
  return pendingAction?.startsWith(prefix)
    ? pendingAction.slice(prefix.length)
    : null
}

export function enrichRelationSuggestionTitles(
  session: ReleaseImportSession | null,
  selectedDraftId: string,
): ImportRelationSuggestion[] {
  if (!session?.relationSuggestions?.length || !selectedDraftId) {
    return []
  }

  const draftTrackTitles = new Map<string, string>()
  for (const draft of session.drafts ?? []) {
    for (const track of draft.tracks) {
      draftTrackTitles.set(track.id, track.title)
    }
  }

  return session.relationSuggestions
    .filter((suggestion) => suggestion.draftId === selectedDraftId)
    .map((suggestion) => ({
      ...suggestion,
      suggested: enrichPayloadTitles(suggestion.suggested, draftTrackTitles),
      reviewed: enrichPayloadTitles(suggestion.reviewed, draftTrackTitles),
      targetOptions: suggestion.targetOptions.map((endpoint) =>
        enrichEndpointTitle(endpoint, draftTrackTitles),
      ),
    }))
}

export function attachmentInitialSearch(
  candidates: ReleaseImportLooseFileCandidate[],
) {
  const albumTitle = singleDistinctValue(
    candidates.map((candidate) => candidate.albumTitleHint),
  )
  return albumTitle ?? candidates[0]?.titleHint ?? ''
}

export function suggestAttachmentMappings(
  candidates: ReleaseImportLooseFileCandidate[],
  release: ReleaseDto,
) {
  const mappings: Record<string, string> = {}
  for (const candidate of candidates) {
    const releaseTrackId = suggestReleaseTrackId(candidate, release)
    if (releaseTrackId) {
      mappings[candidate.id] = releaseTrackId
    }
  }

  return mappings
}

export function restoreSummary(result: ExportRestoreResponse) {
  return `JSON restore completed: ${result.artists} artists, ${result.releases} releases, ${result.tracks} tracks, ${result.ownedItems} owned items.`
}

export function readFileText(file: File) {
  return file.text()
}

function enrichPayloadTitles(
  payload: ImportRelationSuggestionPayload,
  draftTrackTitles: ReadonlyMap<string, string>,
): ImportRelationSuggestionPayload {
  return {
    ...payload,
    source: enrichEndpointTitle(payload.source, draftTrackTitles),
    target: payload.target
      ? enrichEndpointTitle(payload.target, draftTrackTitles)
      : payload.target,
  }
}

function enrichEndpointTitle(
  endpoint: ImportRelationSuggestionEndpoint,
  draftTrackTitles: ReadonlyMap<string, string>,
): ImportRelationSuggestionEndpoint {
  if (endpoint.title || endpoint.kind !== 'draftTrack') {
    return endpoint
  }

  return {
    ...endpoint,
    title: draftTrackTitles.get(endpoint.id) ?? null,
  }
}

function suggestReleaseTrackId(
  candidate: ReleaseImportLooseFileCandidate,
  release: ReleaseDto,
) {
  const tracks = (release.tracklist ?? []).filter(
    (track) => track.releaseTrackId,
  )
  const byHash = uniqueTrackId(
    tracks.filter((track) =>
      (track.linkedLocalFiles ?? []).some(
        (file) =>
          Boolean(candidate.contentHash) &&
          file.contentHash?.toLowerCase() ===
            candidate.contentHash?.toLowerCase(),
      ),
    ),
  )
  if (byHash) {
    return byHash
  }

  if (candidate.trackNumber) {
    const byTrackNumber = uniqueTrackId(
      tracks.filter((track) => track.position === candidate.trackNumber),
    )
    if (byTrackNumber) {
      return byTrackNumber
    }
  }

  const candidateTitle = normalizeTitle(
    candidate.titleHint ?? candidate.relativePath.split('/').at(-1) ?? '',
  )
  return uniqueTrackId(
    tracks.filter((track) => normalizeTitle(track.title) === candidateTitle),
  )
}

function uniqueTrackId(tracks: NonNullable<ReleaseDto['tracklist']>) {
  const ids = tracks
    .map((track) => track.releaseTrackId)
    .filter((id): id is string => Boolean(id))
  return ids.length === 1 ? ids[0] : null
}

function singleDistinctValue(values: Array<string | null | undefined>) {
  const distinctValues = [
    ...new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ]
  return distinctValues.length === 1 ? distinctValues[0] : null
}

function normalizeTitle(value: string) {
  return value
    .replace(/\.[^.]+$/, '')
    .replace(/^[\d\s._-]+/, '')
    .trim()
    .toLowerCase()
}
