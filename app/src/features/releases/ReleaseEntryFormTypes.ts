import type { ArtistRecord } from '../artists/artistsData'
import type { CatalogDictionaries } from '../catalog/catalogApi'
import type { DurationParts } from '../catalog/durationFormat'
import type {
  OwnedCopy,
  ReleaseRecord,
  ReleaseTracklistSubmissionRow,
} from './releasesData'
import type { TrackRecord } from '../tracks/tracksData'

export type ReleaseEntryFormProps = {
  artists: ArtistRecord[]
  dictionaries: CatalogDictionaries
  initialRelease?: ReleaseRecord
  initialShowDiscogsLookup?: boolean
  releases: ReleaseRecord[]
  tracks: TrackRecord[]
  onCancel: () => void
  onSubmit: (
    release: ReleaseRecord,
    tracks: TrackRecord[],
    tracklist: ReleaseTracklistSubmissionRow[],
  ) => void
}

export type DraftTrackRow = {
  id: string
  existingTrackId?: string
  releaseTrackId?: string
  releaseOnly?: boolean
  existingTrackQuery: string
  position: string
  disc: string
  side: string
  title: string
  durationParts: DurationParts
  versionYear: string
  versionYearInheritedFromRelease?: boolean
  inheritReleaseArtistCredits: boolean
  artistCredits: EditableArtistCredit[]
  draftArtist: string
  draftArtistId: string
}

export type DraftTrackMode = 'create' | 'releaseOnly' | 'link'

export type CollectionItemDraft = {
  id: string
  status: OwnedCopy['status'] | ''
  medium: string
  note: string
}

export type EditableArtistCredit = {
  id: string
  artistId: string
  artist: string
  role: string
  roles: string[]
}

export type EditableReleaseLabel = {
  id: string
  label: string
  catalogNumber: string
  hasNoCatalogNumber: boolean
}

export const releaseYearOptions = Array.from(
  { length: new Date().getFullYear() - 1899 },
  (_, index) => String(new Date().getFullYear() - index),
)
