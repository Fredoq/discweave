import { artworkPath, type ImportCoverArtwork } from './importCoverClient'
import { getList, sendJson } from './httpClient'
export type CoverSearchQuery = {
  artist: string
  title: string
  catalogNumber?: string
  barcode?: string
}
export type CoverEdition = {
  releaseId: string
  title: string
  artists: string[]
  date: string | null
  country: string | null
  formats: string[]
  labels: string[]
  catalogNumbers: string[]
  barcode: string | null
  sourceUrl: string
}
export type ExternalCoverCandidate = {
  imageId: string
  comment: string | null
  approved: boolean
  types: string[]
  sourceUrl: string
}
export function searchCoverEditions(
  sessionId: string,
  draftId: string,
  query: CoverSearchQuery,
  signal: AbortSignal,
) {
  return searchArtworkEditions(artworkPath(sessionId, draftId), query, signal)
}
export function searchArtworkEditions(
  basePath: string,
  query: CoverSearchQuery,
  signal: AbortSignal,
) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query))
    if (value?.trim()) params.set(key, value.trim())
  return getList<CoverEdition>(`${basePath}/search?${params}`, {
    signal,
    treatNotFoundAsEmpty: false,
  })
}
export function loadEditionCovers(
  sessionId: string,
  draftId: string,
  releaseId: string,
  signal: AbortSignal,
) {
  return loadArtworkEditionCovers(
    artworkPath(sessionId, draftId),
    releaseId,
    signal,
  )
}
export function loadArtworkEditionCovers(
  basePath: string,
  releaseId: string,
  signal: AbortSignal,
) {
  return getList<ExternalCoverCandidate>(
    `${basePath}/releases/${encodeURIComponent(releaseId)}`,
    { signal, treatNotFoundAsEmpty: false },
  )
}
export function externalCoverPreviewUrl(
  sessionId: string,
  draftId: string,
  releaseId: string,
  imageId: string,
) {
  return artworkPreviewUrl(artworkPath(sessionId, draftId), releaseId, imageId)
}
export function artworkPreviewUrl(
  basePath: string,
  releaseId: string,
  imageId: string,
) {
  return `${basePath}/releases/${encodeURIComponent(releaseId)}/images/${encodeURIComponent(imageId)}`
}
export function selectExternalCover(
  sessionId: string,
  draftId: string,
  releaseId: string,
  imageId: string,
) {
  return sendJson<ImportCoverArtwork>(
    `${artworkPath(sessionId, draftId)}/external-selection`,
    'POST',
    { releaseId, imageId },
  )
}
