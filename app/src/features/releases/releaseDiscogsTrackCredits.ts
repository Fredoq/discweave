import type { ExternalMetadataReleaseDraftArtistCreditDto } from '../catalog/catalogApi'

export function discogsTrackSpecificCredits(
  trackCredits: ExternalMetadataReleaseDraftArtistCreditDto[],
  releaseCredits: ExternalMetadataReleaseDraftArtistCreditDto[],
  inheritReleaseMainArtists: boolean,
) {
  if (!inheritReleaseMainArtists) {
    return trackCredits
  }

  const releaseMainArtists = new Set(
    releaseCredits
      .filter((credit) => isDiscogsMainArtistRole(credit.role))
      .map((credit) => normalizeDiscogsCreditValue(credit.name)),
  )

  return trackCredits.filter(
    (credit) =>
      !isDiscogsMainArtistRole(credit.role) ||
      !releaseMainArtists.has(normalizeDiscogsCreditValue(credit.name)),
  )
}

function isDiscogsMainArtistRole(role: string) {
  return normalizeDiscogsCreditValue(role) === 'mainartist'
}

function normalizeDiscogsCreditValue(value: string) {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase()
}
