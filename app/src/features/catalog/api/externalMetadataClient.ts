import { assertNoCollectionIds, CatalogApiError } from './httpClient'

export type ExternalMetadataSourceDto = {
  providerName: string
  resourceType: string
  externalId: string
  sourceUrl: string
  attribution: string
}

export type ExternalSourceReference = {
  providerName: string
  resourceType: string
  externalId: string
  sourceUrl: string
  appliedAt?: string
}

export type DiscogsReleaseSearchParams = {
  query?: string
  artist?: string
  title?: string
  year?: string
  barcode?: string
  catalogNumber?: string
  limit?: number
}

export type DiscogsArtistSearchParams = {
  query?: string
  limit?: number
}

export type DiscogsTrackSearchParams = {
  title?: string
  artist?: string
  releaseTitle?: string
  year?: string
  barcode?: string
  catalogNumber?: string
  limit?: number
}

export type DiscogsReleaseSearchResponse = {
  items: ExternalMetadataReleaseCandidateDto[]
  limit: number
  total: number
}

export type DiscogsArtistSearchResponse = {
  items: ExternalMetadataArtistCandidateDto[]
  limit: number
  total: number
}

export type DiscogsTrackSearchResponse = {
  items: ExternalMetadataTrackCandidateDto[]
  limit: number
  total: number
}

export type ExternalMetadataReleaseCandidateDto = {
  source: ExternalMetadataSourceDto
  title: string
  artists: string[]
  year?: number | null
  trackCount?: number | null
  labels: string[]
  formats: string[]
  catalogNumber?: string | null
  barcodes: string[]
}

export type ExternalMetadataReleaseDetailDto =
  ExternalMetadataReleaseCandidateDto & {
    tracklist: ExternalMetadataReleaseTrackDto[]
    identifiers: ExternalMetadataReleaseIdentifierDto[]
    credits: ExternalMetadataReleaseCreditDto[]
    draft: ExternalMetadataReleaseDraftDto
  }

export type ExternalMetadataArtistCandidateDto = {
  source: ExternalMetadataSourceDto
  name: string
  profile?: string | null
  nameVariations: string[]
}

export type ExternalMetadataArtistDetailDto =
  ExternalMetadataArtistCandidateDto & {
    aliases: string[]
    members: string[]
    draft: ExternalMetadataArtistDraftDto
  }

export type ExternalMetadataArtistDraftDto = {
  name: string
  externalSources: ExternalSourceReference[]
}

export type ExternalMetadataTrackCandidateDto = {
  source: ExternalMetadataSourceDto
  title: string
  position?: string | null
  durationSeconds?: number | null
  artists: string[]
  release: ExternalMetadataTrackReleaseContextDto
}

export type ExternalMetadataTrackDetailDto =
  ExternalMetadataTrackCandidateDto & {
    credits: ExternalMetadataTrackCreditDto[]
    draft: ExternalMetadataTrackDraftDto
  }

export type ExternalMetadataTrackReleaseContextDto = {
  source: ExternalMetadataSourceDto
  title: string
  year?: number | null
  artists: string[]
}

export type ExternalMetadataTrackCreditDto = {
  name: string
  role: string
}

export type ExternalMetadataTrackDraftDto = {
  title: string
  durationSeconds?: number | null
  artistCredits: ExternalMetadataReleaseDraftArtistCreditDto[]
  externalSources: ExternalSourceReference[]
}

export type ExternalMetadataReleaseTrackDto = {
  title: string
  position?: string | null
  disc?: string | null
  side?: string | null
  durationSeconds?: number | null
  artists: string[]
}

export type ExternalMetadataReleaseIdentifierDto = {
  type: string
  value: string
}

export type ExternalMetadataReleaseCreditDto = {
  name: string
  role: string
  trackTitle?: string | null
  trackPosition?: string | null
}

export type ExternalMetadataReleaseDraftDto = {
  title: string
  type?: string | null
  genres: string[]
  year?: number | null
  releaseDate?: string | null
  artistCredits: ExternalMetadataReleaseDraftArtistCreditDto[]
  labels: ExternalMetadataReleaseDraftLabelDto[]
  tracklist: ExternalMetadataReleaseDraftTrackDto[]
  externalSources: ExternalSourceReference[]
}

export type ExternalMetadataReleaseDraftArtistCreditDto = {
  name: string
  role: string
}

export type ExternalMetadataReleaseDraftLabelDto = {
  name: string
  catalogNumber?: string | null
  hasNoCatalogNumber: boolean
}

export type ExternalMetadataReleaseDraftTrackDto = {
  title: string
  position: number
  disc?: string | null
  side?: string | null
  durationSeconds?: number | null
  artistCredits: ExternalMetadataReleaseDraftArtistCreditDto[]
}

export async function searchDiscogsReleases(
  params: DiscogsReleaseSearchParams,
) {
  const query = new URLSearchParams()
  appendTrimmed(query, 'query', params.query)
  appendTrimmed(query, 'artist', params.artist)
  appendTrimmed(query, 'title', params.title)
  appendTrimmed(query, 'year', params.year)
  appendTrimmed(query, 'barcode', params.barcode)
  appendTrimmed(query, 'catalogNumber', params.catalogNumber)
  query.set('limit', String(params.limit ?? 25))

  return getExternalMetadataJson<DiscogsReleaseSearchResponse>(
    `/api/external-metadata/discogs/releases?${query.toString()}`,
  )
}

export async function searchDiscogsArtists(params: DiscogsArtistSearchParams) {
  const query = new URLSearchParams()
  appendTrimmed(query, 'query', params.query)
  query.set('limit', String(params.limit ?? 25))

  return getExternalMetadataJson<DiscogsArtistSearchResponse>(
    `/api/external-metadata/discogs/artists?${query.toString()}`,
  )
}

export async function searchDiscogsTracks(params: DiscogsTrackSearchParams) {
  const query = new URLSearchParams()
  appendTrimmed(query, 'title', params.title)
  appendTrimmed(query, 'artist', params.artist)
  appendTrimmed(query, 'releaseTitle', params.releaseTitle)
  appendTrimmed(query, 'year', params.year)
  appendTrimmed(query, 'barcode', params.barcode)
  appendTrimmed(query, 'catalogNumber', params.catalogNumber)
  query.set('limit', String(params.limit ?? 25))

  return getExternalMetadataJson<DiscogsTrackSearchResponse>(
    `/api/external-metadata/discogs/tracks?${query.toString()}`,
  )
}

export async function getDiscogsRelease(externalId: string) {
  return getExternalMetadataJson<ExternalMetadataReleaseDetailDto>(
    `/api/external-metadata/discogs/releases/${encodeURIComponent(
      externalId.trim(),
    )}`,
  )
}

export async function getDiscogsArtist(externalId: string) {
  return getExternalMetadataJson<ExternalMetadataArtistDetailDto>(
    `/api/external-metadata/discogs/artists/${encodeURIComponent(
      externalId.trim(),
    )}`,
  )
}

export async function getDiscogsTrack(externalId: string) {
  return getExternalMetadataJson<ExternalMetadataTrackDetailDto>(
    `/api/external-metadata/discogs/tracks/${encodeURIComponent(
      externalId.trim(),
    )}`,
  )
}

async function getExternalMetadataJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    method: 'GET',
  })

  if (!response.ok) {
    throw await CatalogApiError.fromResponse(response)
  }

  const body = (await response.json()) as T
  assertNoCollectionIds(body)

  return body
}

function appendTrimmed(
  query: URLSearchParams,
  name: string,
  value: string | undefined,
) {
  const trimmed = value?.trim()
  if (trimmed) {
    query.set(name, trimmed)
  }
}
