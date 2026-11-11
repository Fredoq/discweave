import { getAllPages, sendDelete, sendJson } from '../catalog/api/httpClient'

export type LabelImportSession = {
  id: string
  sourceRoot: string
  status: string
  createdAt: string
  updatedAt: string
  archivedAt: string | null
  pendingDraftCount: number
  confirmedDraftCount: number
  skippedDraftCount: number
  pendingLooseFileCount: number
}

export async function loadLabelImports(labelId: string, linked = true) {
  return getAllPages<LabelImportSession>(
    `/api/labels/${encodeURIComponent(labelId)}/imports`,
    { linked: String(linked) },
  )
}

export async function linkLabelImport(labelId: string, sessionId: string) {
  await sendJson(
    `/api/labels/${encodeURIComponent(labelId)}/imports/${encodeURIComponent(sessionId)}`,
    'PUT',
    {},
  )
}

export async function unlinkLabelImport(labelId: string, sessionId: string) {
  await sendDelete(
    `/api/labels/${encodeURIComponent(labelId)}/imports/${encodeURIComponent(sessionId)}`,
    'unlink-label-import',
  )
}
