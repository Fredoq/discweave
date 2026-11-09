import type { TrackDto } from '../catalog/api/catalogTypes'
import { sendJson } from '../catalog/api/httpClient'

export type TrackMergeSelection = {
  keeperTrackId: string
  duplicateTrackIds: string[]
}
export type TrackMergePreview = TrackMergeSelection & {
  records: TrackDto[]
  previewToken: string
  metadataPolicy: 'keepKeeper'
  canMerge: boolean
  conflicts: { code: string; message: string }[]
  counts: Record<
    | 'releaseAppearances'
    | 'linkedFiles'
    | 'playlistEntries'
    | 'credits'
    | 'ratings'
    | 'relations'
    | 'importReferences',
    number
  >
}
export function previewTrackMerge(selection: TrackMergeSelection) {
  return sendJson<TrackMergePreview>(
    '/api/tracks/merge/preview',
    'POST',
    selection,
  )
}
export function confirmTrackMerge(preview: TrackMergePreview) {
  return sendJson<{ keeperTrackId: string; mergedTrackIds: string[] }>(
    '/api/tracks/merge',
    'POST',
    {
      keeperTrackId: preview.keeperTrackId,
      duplicateTrackIds: preview.duplicateTrackIds,
      previewToken: preview.previewToken,
      confirmed: true,
    },
  )
}
