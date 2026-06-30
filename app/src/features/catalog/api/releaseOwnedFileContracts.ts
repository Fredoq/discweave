export type TrackDigitalFileDto = {
  digitalTrackFileLinkId: string
  localAudioFileId: string
  digitalOwnedItemId: string
  releaseId: string
  releaseTitle: string
  releaseArtist?: string | null
  releaseYear?: number | null
  releaseDate?: string | null
  releaseLabel?: string | null
  releaseCatalogNumber?: string | null
  releaseTrackId: string
  position: number
  disc?: string | null
  side?: string | null
  path: string
  format?: string | null
  codec?: string | null
  quality?: string | null
  sizeBytes?: number | null
  modifiedAt?: string | null
  contentHash?: string | null
  durationSeconds?: number | null
  bitrateKbps?: number | null
  sampleRateHz?: number | null
  channels?: number | null
}

export type MediumDto = {
  type: string
  description?: string | null
  discCount?: number | null
}

export type OwnedItemTargetType = 'release'

export type OwnedItemTargetDto = {
  type: OwnedItemTargetType
  id: string
  title: string
  subtitle?: string | null
  releaseId?: string | null
  releaseTitle?: string | null
}

export type OwnedItemReleaseDto = {
  id: string
  title: string
}

export type OwnedItemDto = {
  id: string
  releaseId: string
  release: OwnedItemReleaseDto
  status: string
  medium: MediumDto
  details: OwnedItemDetailsDto
  inventorySignals?: string[]
}

export type OwnedItemDetailsDto = {
  digital?: DigitalOwnedItemDetailsDto | null
  vinyl?: VinylOwnedItemDetailsDto | null
  cd?: CdOwnedItemDetailsDto | null
  cassette?: CassetteOwnedItemDetailsDto | null
  other?: OtherOwnedItemDetailsDto | null
}

export type DigitalOwnedItemDetailsDto = {
  releaseTrackCount: number
  linkedFileCount: number
  missingFileCount: number
  files: DigitalFileCoverageDto[]
}

export type DigitalFileCoverageDto = {
  digitalTrackFileLinkId: string
  releaseTrackId: string
  trackId?: string | null
  trackTitle: string
  position: number
  disc?: string | null
  side?: string | null
  localAudioFileId: string
  path: string
  format?: string | null
  codec?: string | null
  quality?: string | null
  sizeBytes?: number | null
  modifiedAt?: string | null
  contentHash?: string | null
  durationSeconds?: number | null
  bitrateKbps?: number | null
  sampleRateHz?: number | null
  channels?: number | null
}

export type VinylOwnedItemDetailsDto = {
  formatDescription: string
  condition?: string | null
  storageLocation?: string | null
}

export type CdOwnedItemDetailsDto = {
  discCount: number
  condition?: string | null
  storageLocation?: string | null
}

export type CassetteOwnedItemDetailsDto = {
  tapeType: string
  condition?: string | null
  storageLocation?: string | null
}

export type OtherOwnedItemDetailsDto = {
  name: string
  condition?: string | null
  storageLocation?: string | null
}

export type LocalAudioFileUpdateRequest = {
  path?: string | null
  format?: string | null
  codec?: string | null
  quality?: string | null
  sizeBytes?: number | null
  lastModifiedAt?: string | null
  contentHash?: string | null
  durationSeconds?: number | null
  bitrateKbps?: number | null
  sampleRateHz?: number | null
  channels?: number | null
}

export type LocalAudioFileDto = {
  id: string
  path: string
  format?: string | null
  codec?: string | null
  quality?: string | null
  sizeBytes?: number | null
  modifiedAt?: string | null
  contentHash?: string | null
  durationSeconds?: number | null
  bitrateKbps?: number | null
  sampleRateHz?: number | null
  channels?: number | null
}
