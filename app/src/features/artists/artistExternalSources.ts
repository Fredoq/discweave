import type { ArtistRecord } from './artistsData'

export function upsertExternalSources(
  currentSources: ArtistRecord['externalSources'],
  nextSources: ArtistRecord['externalSources'],
) {
  const appliedAt = new Date().toISOString()
  const appliedSources = (nextSources ?? []).map((source) => ({
    ...source,
    appliedAt,
  }))

  return [
    ...(currentSources ?? []).filter(
      (source) =>
        !appliedSources.some((appliedSource) =>
          hasSameExternalSourceIdentity(source, appliedSource),
        ),
    ),
    ...appliedSources,
  ]
}

function hasSameExternalSourceIdentity(
  source: NonNullable<ArtistRecord['externalSources']>[number],
  other: NonNullable<ArtistRecord['externalSources']>[number],
) {
  return (
    source.providerName.toLowerCase() === other.providerName.toLowerCase() &&
    source.resourceType.toLowerCase() === other.resourceType.toLowerCase() &&
    source.externalId === other.externalId
  )
}
