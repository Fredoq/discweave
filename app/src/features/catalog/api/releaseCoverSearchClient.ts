import type { ReleaseCoverImage } from '../../releases/releasesData'
import { sendJson } from './httpClient'
export function releaseArtworkPath(releaseId: string) {
  return `/api/releases/${encodeURIComponent(releaseId)}/cover-artwork`
}
export function selectReleaseExternalCover(
  releaseId: string,
  externalReleaseId: string,
  imageId: string,
) {
  return sendJson<ReleaseCoverImage>(
    `${releaseArtworkPath(releaseId)}/external-selection`,
    'POST',
    { releaseId: externalReleaseId, imageId },
  )
}
