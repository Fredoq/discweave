import type { ArtistRecord } from '../artists/artistsData'
import {
  durationPartsToText,
  durationTextToParts,
} from '../catalog/durationFormat'
import { toCreditRole } from '../catalog/creditRoles'
import { createManualRecordId } from '../manualEntry/manualEntryUtils'
import type {
  ReleaseArtistCredit,
  ReleaseLabel,
  ReleaseRecord,
} from './releasesData'
import type { TrackRecord } from '../tracks/tracksData'
import {
  emptyVersionNote,
  type DraftTrackRow,
  type EditableArtistCredit,
} from './ReleaseEntryFormTypes'

export function isDraftTrackIncluded(track: DraftTrackRow) {
  return (
    Boolean(track.existingTrackId) ||
    [
      track.title,
      durationPartsToText(track.durationParts),
      track.versionNote,
    ].some((value) => value.trim().length > 0) ||
    track.artistCredits.some(
      (credit) => credit.artist.trim().length > 0 || credit.artistId.length > 0,
    )
  )
}

export function draftTracksFromRelease(
  release: ReleaseRecord,
  tracks: TrackRecord[],
): DraftTrackRow[] {
  const draftTracks: Array<{
    draftTrack: DraftTrackRow
    position: number
  }> = []

  tracks.forEach((track) => {
    const appearance =
      track.releaseAppearances.find(
        (candidate) => candidate.releaseId === release.id,
      ) ??
      (track.release.id === release.id
        ? {
            position: track.trackNumber,
            duration: track.duration,
            versionNote: track.versionHint,
          }
        : undefined)

    if (!appearance) {
      return
    }

    draftTracks.push({
      draftTrack: {
        id: createManualRecordId('draft-track', `${release.id}-${track.id}`),
        existingTrackId: track.id,
        existingTrackQuery: track.title,
        position: appearance.position,
        title: track.title,
        durationParts: durationTextToParts(appearance.duration),
        inheritReleaseArtistCredits: false,
        artistCredits: track.credits.map((credit, index) => ({
          id: createManualRecordId(
            'track-artist-credit',
            `${track.id}-${index + 1}`,
          ),
          artistId: credit.artistId ?? '',
          artist: credit.artistId ? '' : credit.artist,
          role: credit.role,
          roles:
            credit.roles && credit.roles.length > 0
              ? credit.roles
              : [credit.role],
        })),
        draftArtist: '',
        draftArtistId: '',
        versionNote: isDefaultVersionNote(appearance.versionNote)
          ? ''
          : appearance.versionNote,
      },
      position: parseDraftTrackPosition(appearance.position),
    })
  })

  return draftTracks
    .sort((first, second) => {
      return first.position - second.position
    })
    .map((track) => track.draftTrack)
}

export function draftTrackPosition(
  track: DraftTrackRow,
  index: number,
  preserveStoredPosition: boolean,
) {
  return preserveStoredPosition
    ? track.position.trim() || String(index + 1)
    : String(index + 1)
}

export function nextDraftTrackPosition(tracks: DraftTrackRow[]) {
  const numericPositions = tracks
    .map((track) => Number.parseInt(track.position, 10))
    .filter((position) => Number.isFinite(position) && position > 0)

  return numericPositions.length > 0
    ? Math.max(...numericPositions) + 1
    : tracks.length + 1
}

export function renumberDraftTrackPositions(tracks: DraftTrackRow[]) {
  return tracks.map((track, index) => ({
    ...track,
    position: String(index + 1),
  }))
}

export function duplicateDraftExistingTrackIds(tracks: DraftTrackRow[]) {
  const seenTrackIds = new Set<string>()
  const duplicateTrackIds = new Set<string>()

  tracks.forEach((track) => {
    if (!isDraftTrackIncluded(track) || !track.existingTrackId) {
      return
    }

    if (seenTrackIds.has(track.existingTrackId)) {
      duplicateTrackIds.add(track.existingTrackId)
    } else {
      seenTrackIds.add(track.existingTrackId)
    }
  })

  return duplicateTrackIds
}

export function existingTrackSuggestions(
  draftTrack: DraftTrackRow,
  tracks: TrackRecord[],
  releaseMainArtistCredits: ReleaseArtistCredit[],
) {
  const query = normalizeSearchText(draftTrack.existingTrackQuery)
  if (query.length === 0) {
    return []
  }

  const releaseArtistTerms = releaseMainArtistCredits
    .map((credit) => normalizeSearchText(credit.artist))
    .filter(Boolean)

  return tracks
    .filter((track) => existingTrackSearchText(track).includes(query))
    .map((track) => ({
      track,
      priority: releaseArtistTerms.some((artistTerm) =>
        existingTrackArtistText(track).includes(artistTerm),
      )
        ? 0
        : 1,
    }))
    .sort((first, second) => {
      if (first.priority !== second.priority) {
        return first.priority - second.priority
      }

      return first.track.title.localeCompare(second.track.title)
    })
    .slice(0, 5)
    .map(({ track }) => track)
}

export function existingTrackSearchText(track: TrackRecord) {
  return normalizeSearchText(
    [
      track.title,
      track.artist,
      track.release.title,
      track.release.artist,
      ...track.credits.map((credit) => credit.artist),
      ...track.releaseAppearances.flatMap((appearance) => [
        appearance.releaseTitle,
        appearance.releaseArtist,
      ]),
    ].join(' '),
  )
}

export function existingTrackArtistText(track: TrackRecord) {
  return normalizeSearchText(
    [
      track.artist,
      track.release.artist,
      ...track.credits.map((credit) => credit.artist),
      ...track.releaseAppearances.map((appearance) => appearance.releaseArtist),
    ].join(' '),
  )
}

export function normalizeSearchText(value: string) {
  return value.trim().toLowerCase()
}

export function parseDraftTrackPosition(value: string) {
  const parsed = Number.parseInt(value, 10)

  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER
}

export function isDefaultVersionNote(value: string) {
  return value.length === 0 || value === emptyVersionNote
}

export function editableArtistCreditFromReleaseCredit(
  credit: ReleaseArtistCredit,
  index: number,
): EditableArtistCredit {
  return {
    id: createManualRecordId('track-artist-credit', `${index + 1}`),
    artistId: credit.artistId ?? '',
    artist: credit.artistId ? '' : credit.artist,
    role: credit.role,
    roles:
      credit.roles && credit.roles.length > 0 ? credit.roles : [credit.role],
  }
}

export function releaseArtistCreditFromEditableCredit(
  credit: EditableArtistCredit,
  artists: ArtistRecord[],
): ReleaseArtistCredit {
  const existingArtist = artists.find((artist) => artist.id === credit.artistId)

  const roles = credit.roles.length > 0 ? credit.roles : [credit.role]

  return {
    artistId: existingArtist?.id,
    artist: existingArtist?.name ?? credit.artist.trim(),
    role: toCreditRole(roles[0]),
    roles: roles.map(toCreditRole),
  }
}

export function releaseArtistCreditKey(credit: ReleaseArtistCredit) {
  return `${credit.artistId ?? credit.artist.toLowerCase()}::${credit.role}`
}

export function editableArtistCreditKey(
  credit: EditableArtistCredit,
  artists: ArtistRecord[],
) {
  const artistName = artistCreditName(credit, artists).toLowerCase()

  return `${credit.artistId || artistName}::${credit.role}`
}

export function artistCreditName(
  credit: Pick<EditableArtistCredit, 'artist' | 'artistId'>,
  artists: ArtistRecord[],
) {
  if (!credit.artistId) {
    return credit.artist.trim()
  }

  return (
    artists.find((artist) => artist.id === credit.artistId)?.name.trim() ?? ''
  )
}

export function releaseLabelDisplay(label: ReleaseLabel) {
  if (label.catalogNumber) {
    return `${label.name} ${label.catalogNumber}`
  }

  if (label.hasNoCatalogNumber) {
    return `${label.name} (No catalog number)`
  }

  return label.name
}

export function objectUrlForFile(file: File) {
  return typeof URL.createObjectURL === 'function'
    ? URL.createObjectURL(file)
    : `/api/releases/local-cover/${encodeURIComponent(file.name)}`
}

export function queryTerms(query: string) {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean)
}

export function releaseSearchText(release: ReleaseRecord) {
  return [
    release.title,
    release.artist,
    release.type,
    release.year,
    release.label,
    release.releaseNotes,
    ...(release.artistCredits?.flatMap((credit) => [
      credit.artist,
      credit.role,
    ]) ?? []),
    ...(release.labels?.flatMap((label) => [
      label.name,
      label.catalogNumber ?? '',
      label.hasNoCatalogNumber ? 'no catalog number' : '',
    ]) ?? []),
    ...release.genres,
    ...release.tags,
    ...release.ownedCopies.flatMap((copy) => [
      copy.medium,
      copy.status,
      copy.storage,
      copy.condition,
      copy.note,
    ]),
  ]
    .join(' ')
    .toLowerCase()
}

export function releaseLabelNames(release: ReleaseRecord) {
  return releaseLabelEntries(release).map((label) => label.name)
}

export function releaseHasLabel(release: ReleaseRecord, label: string) {
  return releaseLabelNames(release).includes(label)
}

export function releaseLabelEntries(release: ReleaseRecord): ReleaseLabel[] {
  const labels =
    release.labels
      ?.map((label) => ({
        ...label,
        catalogNumber: label.catalogNumber?.trim() || undefined,
        name: label.name.trim(),
      }))
      .filter((label) => label.name.length > 0) ?? []

  if (labels.length > 0) {
    return labels
  }

  if (release.label === 'Unknown label') {
    return []
  }

  return [
    {
      name: release.label,
      catalogNumber: undefined,
      hasNoCatalogNumber: false,
    },
  ]
}

export function releaseCatalogNumberDisplay(label: ReleaseLabel) {
  if (label.catalogNumber) {
    return label.catalogNumber
  }

  return label.hasNoCatalogNumber ? 'No catalog number' : 'Not recorded'
}

const trackPositionCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
})

export function releaseTrackPosition(
  track: TrackRecord,
  release: ReleaseRecord,
) {
  const releaseAppearance = track.releaseAppearances.find(
    (appearance) => appearance.releaseId === release.id,
  )
  const appearancePosition = releaseAppearance?.position.trim()

  if (appearancePosition) {
    return appearancePosition
  }

  const primaryReleasePosition =
    track.release.id === release.id ? track.trackNumber.trim() : ''

  return primaryReleasePosition || track.trackNumber.trim()
}

export function sortReleaseDetailTracks(
  tracks: TrackRecord[],
  release: ReleaseRecord,
) {
  return [...tracks].sort((firstTrack, secondTrack) => {
    const firstPosition = releaseTrackPosition(firstTrack, release)
    const secondPosition = releaseTrackPosition(secondTrack, release)

    if (firstPosition && secondPosition) {
      const positionOrder = trackPositionCollator.compare(
        firstPosition,
        secondPosition,
      )

      if (positionOrder !== 0) {
        return positionOrder
      }
    } else if (firstPosition) {
      return -1
    } else if (secondPosition) {
      return 1
    }

    return trackPositionCollator.compare(firstTrack.title, secondTrack.title)
  })
}

export function releaseDetailSummary(release: ReleaseRecord) {
  const summary = release.releaseNotes.trim()

  return isTechnicalApiSummary(summary) ? '' : summary
}

export function isTechnicalApiSummary(summary: string) {
  const normalized = summary.toLowerCase()

  return (
    normalized.includes('loaded') &&
    normalized.includes('authenticated') &&
    normalized.includes('collection') &&
    normalized.includes('api')
  )
}
