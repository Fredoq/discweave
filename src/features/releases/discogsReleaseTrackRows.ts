import type { ExternalMetadataReleaseDraftTrackDto } from '../catalog/catalogApi'

export function discogsDraftTrackRows(
  tracks: ExternalMetadataReleaseDraftTrackDto[],
) {
  return tracks
    .filter((track) => !isDiscogsNonTrackHeadingRow(track))
    .map((track, index) => ({
      ...track,
      position: index + 1,
    }))
}

function isDiscogsNonTrackHeadingRow(
  track: ExternalMetadataReleaseDraftTrackDto,
) {
  const title = normalizeText(track.title)
  return (
    /^(disc|disk|cd|side|part)\s*[a-z0-9]*$/.test(title) ||
    /(?:compact\s+disc|bonus\s+disc|disc\s+\d|cd\s+\d)$/.test(title)
  )
}

function normalizeText(value: string) {
  return value.trim().toLowerCase()
}
