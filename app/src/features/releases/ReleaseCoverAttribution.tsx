import { useEffect, useState } from 'react'
import { CatalogApiError } from '../catalog/api/httpClient'
import type { CoverArtworkProvenance } from '../catalog/api/importCoverClient'
export function ReleaseCoverAttribution({
  releaseId,
  coverUrl,
}: Readonly<{ releaseId: string; coverUrl: string }>) {
  return (
    <CoverAttribution key={`${releaseId}:${coverUrl}`} releaseId={releaseId} />
  )
}
function CoverAttribution({ releaseId }: Readonly<{ releaseId: string }>) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    void fetch(
      `/api/releases/${encodeURIComponent(releaseId)}/cover-image/provenance`,
      {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        if (!response.ok) throw await CatalogApiError.fromResponse(response)
        return (await response.json()) as {
          provenance: CoverArtworkProvenance | null
        }
      })
      .then(({ provenance }) => {
        if (controller.signal.aborted) return
        setSourceUrl(provenance?.sourceUrl ?? null)
        setUnavailable(!provenance?.sourceUrl)
      })
      .catch(() => {
        if (!controller.signal.aborted) setUnavailable(true)
      })
    return () => controller.abort()
  }, [releaseId])
  return (
    <p className="imports-cover-hint">
      {sourceUrl ? (
        <a href={sourceUrl} target="_blank" rel="noreferrer">
          Cover Art Archive
        </a>
      ) : (
        'Cover Art Archive'
      )}
      {
        ' · Image copyright remains with the rights holders. DiscWeave keeps its own image copy.'
      }
      {unavailable ? ' Source details are currently unavailable.' : null}
    </p>
  )
}
