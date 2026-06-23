import {
  CatalogApiError,
  assertNoCollectionIds,
  getAllPages,
  getJson,
  postEmpty,
  sendDelete,
  sendJson,
} from './httpClient'
import type {
  DesktopFolderScanRequest,
  ExportRestoreResponse,
  ImportRelationSuggestionDecision,
  ImportRelationSuggestionPayload,
  ImportPattern,
  ImportPatternKind,
  ImportPatternRequest,
  ImportPatternTestResult,
  ImportSessionFilter,
  ReleaseDto,
  ReleaseImportConfirmationPreflight,
  ReleaseImportDraft,
  ReleaseImportSession,
} from './catalogTypes'

export async function loadImportSessions(
  options: {
    filter?: ImportSessionFilter
    includeArchived?: boolean
  } = {},
) {
  const params: Record<string, string> = {}
  if (options.filter && options.filter !== 'all') {
    params.filter = options.filter
  }
  if (options.includeArchived) {
    params.includeArchived = 'true'
  }
  return getAllPages<ReleaseImportSession>('/api/imports', params)
}

export async function getImportSession(sessionId: string) {
  return getJson<ReleaseImportSession>(`/api/imports/${sessionId}`)
}

export async function archiveImportSession(sessionId: string) {
  return postEmpty<ReleaseImportSession>(`/api/imports/${sessionId}/archive`)
}

export async function deleteImportSession(sessionId: string) {
  return sendDelete(
    `/api/imports/${sessionId}`,
    'delete-abandoned-import-session',
  )
}

export async function createDesktopFolderScan(
  request: DesktopFolderScanRequest,
) {
  return sendJson<ReleaseImportSession>(
    '/api/imports/desktop-folder-scans',
    'POST',
    request,
  )
}

export async function createImportDraftFromLooseFiles(
  sessionId: string,
  candidateIds: string[],
) {
  return sendJson<ReleaseImportSession>(
    `/api/imports/${sessionId}/loose-file-drafts`,
    'POST',
    { candidateIds },
  )
}

export async function searchImportAttachmentReleases(search: string) {
  const term = search.trim()
  if (!term) {
    return { items: [], limit: 0, offset: 0, total: 0 }
  }

  return getAllPages<ReleaseDto>('/api/releases', { search: term })
}

export async function attachLooseFilesToRelease(
  sessionId: string,
  request: {
    releaseId: string
    mappings: Array<{
      candidateId: string
      releaseTrackId: string
      confirmRelink: boolean
    }>
  },
) {
  return sendJson<ReleaseImportSession>(
    `/api/imports/${sessionId}/loose-file-attachments`,
    'POST',
    request,
  )
}

function importDraftUpdatePayload(draft: ReleaseImportDraft) {
  return {
    title: draft.title,
    type: draft.type,
    catalogNumber: draft.catalogNumber,
    labelName: draft.labelName,
    releaseDate: draft.releaseDate,
    year: draft.year,
    isVariousArtists: draft.isVariousArtists,
    notOnLabel: draft.notOnLabel,
    artistNames: draft.artistNames,
    artistCredits: draft.artistCredits ?? [],
    labels: draft.labels ?? [],
    selectedArtistIds: draft.selectedArtistIds,
    genres: draft.genres,
    tags: draft.tags,
    externalSources: draft.externalSources ?? [],
    coverPath: draft.coverPath,
    tracks: draft.tracks.map((track) => ({
      id: track.id,
      position: track.position,
      disc: track.disc,
      side: track.side,
      title: track.title,
      durationSeconds: track.durationSeconds,
      artistNames: track.artistNames,
      artistCredits: track.artistCredits ?? [],
      inheritReleaseArtistCredits: Boolean(track.inheritReleaseArtistCredits),
      selectedArtistIds: track.selectedArtistIds,
      selectedTrackId: track.selectedTrackId,
      isSkipped: track.isSkipped,
    })),
  }
}

export async function updateImportDraft(
  sessionId: string,
  draft: ReleaseImportDraft,
) {
  return sendJson<ReleaseImportSession>(
    `/api/imports/${sessionId}/drafts/${draft.id}`,
    'PUT',
    importDraftUpdatePayload(draft),
  )
}

export async function preflightImportDraftConfirmation(
  sessionId: string,
  draft: ReleaseImportDraft,
) {
  return sendJson<ReleaseImportConfirmationPreflight>(
    `/api/imports/${sessionId}/drafts/${draft.id}/confirmation-preflight`,
    'POST',
    importDraftUpdatePayload(draft),
  )
}

export async function updateImportRelationSuggestion(
  sessionId: string,
  suggestionId: string,
  request: {
    decision: ImportRelationSuggestionDecision
    reviewed: ImportRelationSuggestionPayload
  },
) {
  return sendJson<ReleaseImportSession>(
    `/api/imports/${sessionId}/relation-suggestions/${suggestionId}`,
    'PUT',
    {
      decision: request.decision,
      reviewed: {
        source: {
          kind: request.reviewed.source.kind,
          id: request.reviewed.source.id,
        },
        target: request.reviewed.target
          ? {
              kind: request.reviewed.target.kind,
              id: request.reviewed.target.id,
            }
          : null,
        relationTypeCode: request.reviewed.relationTypeCode ?? null,
      },
    },
  )
}

export async function confirmImportDraft(sessionId: string, draftId: string) {
  return postEmpty<ReleaseImportSession>(
    `/api/imports/${sessionId}/drafts/${draftId}/confirm`,
  )
}

export async function skipImportDraft(sessionId: string, draftId: string) {
  return postEmpty<ReleaseImportSession>(
    `/api/imports/${sessionId}/drafts/${draftId}/skip`,
  )
}

export async function loadImportPatterns() {
  return getAllPages<ImportPattern>('/api/settings/import-patterns')
}

export async function createImportPattern(request: ImportPatternRequest) {
  return sendJson<ImportPattern>(
    '/api/settings/import-patterns',
    'POST',
    request,
  )
}

export async function updateImportPattern(
  patternId: string,
  request: ImportPatternRequest,
) {
  return sendJson<ImportPattern>(
    `/api/settings/import-patterns/${patternId}`,
    'PUT',
    request,
  )
}

export async function deleteImportPattern(patternId: string) {
  const response = await fetch(`/api/settings/import-patterns/${patternId}`, {
    credentials: 'include',
    method: 'DELETE',
  })

  if (!response.ok) {
    throw await CatalogApiError.fromResponse(response)
  }
}

export async function testImportPattern(
  kind: ImportPatternKind,
  template: string,
  input: string,
) {
  return sendJson<ImportPatternTestResult>(
    '/api/settings/import-patterns/test',
    'POST',
    { kind, template, input },
  )
}

export async function restoreJsonSnapshot(snapshot: unknown) {
  const response = await fetch('/api/exports/json/restore', {
    body: JSON.stringify(snapshot),
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-DiscWeave-Confirm-Restore': 'restore-empty-collection',
    },
    method: 'POST',
  })

  if (!response.ok) {
    throw await CatalogApiError.fromResponse(response)
  }

  const restored = (await response.json()) as ExportRestoreResponse
  assertNoCollectionIds(restored)

  return restored
}
