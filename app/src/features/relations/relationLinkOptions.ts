import type { CatalogLinkOption } from '../catalog/catalogLinks'
import type { TrackRecord } from '../tracks/tracksData'

type TrackOptionSource = Pick<TrackRecord, 'id' | 'title'> &
  Partial<Pick<TrackRecord, 'artist' | 'versionYear'>> & {
    release?: Partial<TrackRecord['release']>
  }

export function trackRelationLinkOptions(
  tracks: TrackOptionSource[],
): CatalogLinkOption[] {
  const labels = tracks.map((track) =>
    [track.title, track.artist, track.release?.title, track.versionYear]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(' · '),
  )
  const counts = new Map<string, number>()
  labels.forEach((label) => counts.set(label, (counts.get(label) ?? 0) + 1))
  return tracks.map((track, index) => {
    const label = labels[index]
    const needsIdentifier =
      label === track.title.trim() || (counts.get(label) ?? 0) > 1
    return {
      kind: 'track',
      id: track.id,
      value: `track:${track.id}`,
      name: track.title,
      label: needsIdentifier ? `${label} · ${track.id}` : label,
      typeLabel: 'Track',
    }
  })
}
