export function releaseRequiredMessage({
  hasDuplicateExistingTrack,
  hasInvalidVariousArtistTrack,
  hasReleaseArtist,
  hasReleaseGenre,
  hasReleaseLabel,
  hasReleaseTracklist,
  hasUnsetReleaseArtistRole,
  hasUnsetTrackArtistRole,
  hasTitle,
}: Readonly<{
  hasDuplicateExistingTrack: boolean
  hasInvalidVariousArtistTrack: boolean
  hasReleaseArtist: boolean
  hasReleaseGenre: boolean
  hasReleaseLabel: boolean
  hasReleaseTracklist: boolean
  hasUnsetReleaseArtistRole: boolean
  hasUnsetTrackArtistRole: boolean
  hasTitle: boolean
}>) {
  if (!hasTitle) return 'Title is required.'
  if (!hasReleaseArtist) {
    return 'Add at least one release artist or mark this as Various Artists.'
  }
  if (hasUnsetReleaseArtistRole) return 'Set a role for each release artist.'
  if (!hasReleaseLabel) return 'Add a label or mark this as Not On Label.'
  if (!hasReleaseGenre) return 'Select at least one genre.'
  if (!hasReleaseTracklist) return 'Add at least one tracklist row.'
  if (hasUnsetTrackArtistRole) return 'Set a role for each track artist.'
  if (hasInvalidVariousArtistTrack) {
    return 'Track artists are required for Various Artists releases.'
  }
  if (hasDuplicateExistingTrack) {
    return 'Use each existing track only once in this release tracklist.'
  }
  return 'Tracklist rows with metadata need a track title.'
}
