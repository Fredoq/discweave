import {
  CatalogApiError,
  assertNoCollectionIds,
  getAllPages,
  getJson,
  postEmpty,
  sendJson,
} from './httpClient'
import type {
  DesktopFolderScanRequest,
  ExportRestoreResponse,
  ImportPattern,
  ImportPatternKind,
  ImportPatternRequest,
  ImportPatternTestResult,
  ReleaseImportDraft,
  ReleaseImportSession,
} from './catalogTypes'

export async function loadImportSessions() {
  return getAllPages<ReleaseImportSession>('/api/imports')
}

export async function getImportSession(sessionId: string) {
  return getJson<ReleaseImportSession>(`/api/imports/${sessionId}`)
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

export async function updateImportDraft(
  sessionId: string,
  draft: ReleaseImportDraft,
) {
  return sendJson<ReleaseImportSession>(
    `/api/imports/${sessionId}/drafts/${draft.id}`,
    'PUT',
    {
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
        selectedArtistIds: track.selectedArtistIds,
        selectedTrackId: track.selectedTrackId,
        isSkipped: track.isSkipped,
      })),
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
