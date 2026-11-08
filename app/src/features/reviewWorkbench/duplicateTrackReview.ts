import type { TrackDto } from '../catalog/api/catalogTypes'
import { getJson } from '../catalog/api/httpClient'
import type { ReviewWorkbenchItem } from './reviewWorkbenchApi'

export function duplicateTrackIds(item: ReviewWorkbenchItem): string[] {
  if (item.subtype !== 'duplicateTracks') return []
  return [
    ...new Set(
      item.targets
        .filter((target) => target.kind === 'track' && target.id)
        .map((target) => target.id),
    ),
  ]
}

export async function loadDuplicateTrackRecords(ids: readonly string[]) {
  // Fetch each exact target, not a filtered or partially loaded catalog page.
  return Promise.all(
    ids.map(async (id) => {
      const track = await getJson<TrackDto>(
        `/api/tracks/${encodeURIComponent(id)}`,
      )
      if (track?.id !== id) {
        throw new Error(
          'A candidate is no longer available. Close this review and refresh the queue.',
        )
      }
      return track
    }),
  )
}

export function trackReviewArtist(track: TrackDto) {
  return (
    (track.credits ?? [])
      .filter((credit) =>
        (credit.roles ?? [credit.role]).includes('mainArtist'),
      )
      .map((credit) => credit.artistName)
      .join(', ') || 'Unknown artist'
  )
}

export function trackReviewDuration(seconds: number | null | undefined) {
  return seconds == null
    ? 'Unknown duration'
    : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
