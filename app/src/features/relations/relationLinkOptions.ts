import type { CatalogLinkOption } from '../catalog/catalogLinks'

export function trackRelationLinkOptions(
  tracks: { id: string; title: string }[],
): CatalogLinkOption[] {
  return tracks.map((track) => ({
    kind: 'track',
    id: track.id,
    value: `track:${track.id}`,
    name: track.title,
    label: track.title,
    typeLabel: 'Track',
  }))
}
