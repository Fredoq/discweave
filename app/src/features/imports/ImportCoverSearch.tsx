import { artworkPath } from '../catalog/api/importCoverClient'
import type { CoverSearchQuery } from '../catalog/api/importCoverSearchClient'
import { ExternalCoverSearchPanel } from '../releases/ExternalCoverSearchPanel'
export function ImportCoverSearch({
  sessionId,
  draftId,
  ...props
}: Readonly<{
  sessionId: string
  draftId: string
  seed?: CoverSearchQuery
  disabled: boolean
  onSelect: (releaseId: string, imageId: string) => Promise<void>
  onClose: () => void
}>) {
  const basePath = artworkPath(sessionId, draftId)
  return (
    <ExternalCoverSearchPanel key={basePath} basePath={basePath} {...props} />
  )
}
