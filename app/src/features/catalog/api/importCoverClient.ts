import { CatalogApiError, assertNoCollectionIds, sendJson } from './httpClient'

export type CoverArtworkProvenance = {
  provider: string
  releaseId: string
  imageId: string
  sourceUrl: string
  downloadedAt: string
  sha256: string
}
export type ImportCoverImage = {
  id: string | null
  fileName: string
  contentType: string
  sizeBytes: number
  url: string
  sourcePath: string | null
  provenance?: CoverArtworkProvenance | null
}
export type ImportCoverArtwork = {
  selected: ImportCoverImage | null
  candidates: (ImportCoverImage & { id: string })[]
  canEdit: boolean
  warnings: string[]
}
export function artworkPath(sessionId: string, draftId: string) {
  return `/api/imports/${encodeURIComponent(sessionId)}/drafts/${encodeURIComponent(draftId)}/cover-artwork`
}
export async function loadImportCoverArtwork(
  sessionId: string,
  draftId: string,
  signal?: AbortSignal,
): Promise<ImportCoverArtwork> {
  return readArtwork(
    await fetch(artworkPath(sessionId, draftId), {
      credentials: 'include',
      method: 'GET',
      cache: 'no-store',
      signal,
    }),
  )
}
export function selectImportCoverArtwork(
  sessionId: string,
  draftId: string,
  candidateId: string | null,
) {
  return sendJson<ImportCoverArtwork>(artworkPath(sessionId, draftId), 'PUT', {
    candidateId,
  })
}
export async function uploadImportCoverArtwork(
  sessionId: string,
  draftId: string,
  file: File,
) {
  const extension = file.name.split('.').at(-1)?.toLowerCase()
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  }
  if (!extension || !mimeTypes[extension] || file.type !== mimeTypes[extension])
    throw new Error('Choose a JPEG, PNG or WebP image.')
  if (file.size === 0 || file.size > 10 * 1024 * 1024)
    throw new Error('Choose a non-empty image no larger than 10 MiB.')
  const body = new FormData()
  body.append('file', file)
  return readArtwork(
    await fetch(artworkPath(sessionId, draftId), {
      credentials: 'include',
      method: 'POST',
      body,
    }),
  )
}
async function readArtwork(response: Response): Promise<ImportCoverArtwork> {
  if (!response.ok) throw await CatalogApiError.fromResponse(response)
  const artwork = (await response.json()) as ImportCoverArtwork
  assertNoCollectionIds(artwork)
  return artwork
}
