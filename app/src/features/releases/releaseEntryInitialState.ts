import { createManualRecordId } from '../manualEntry/manualEntryUtils'
import type {
  CollectionItemDraft,
  EditableArtistCredit,
  EditableReleaseLabel,
} from './ReleaseEntryFormTypes'
import type { ReleaseRecord } from './releasesData'

export function initialArtistCredits(
  initialRelease?: ReleaseRecord,
): EditableArtistCredit[] {
  const credits = initialRelease?.artistCredits
  if (credits && credits.length > 0) {
    return credits.map((credit, index) => ({
      id: createManualRecordId('release-artist-credit', `${index}`),
      artistId: credit.artistId ?? '',
      artist: credit.artistId ? '' : credit.artist,
      role: credit.role,
      roles:
        credit.roles && credit.roles.length > 0 ? credit.roles : [credit.role],
    }))
  }

  if (initialRelease) {
    return [
      {
        id: createManualRecordId('release-artist-credit', '1'),
        artistId: initialRelease.artistId ?? '',
        artist: initialRelease.artistId ? '' : initialRelease.artist,
        role: 'Main artist',
        roles: ['Main artist'],
      },
    ]
  }

  return []
}

export function initialReleaseLabels(
  initialRelease?: ReleaseRecord,
): EditableReleaseLabel[] {
  const releaseLabels = initialRelease?.labels
  if (releaseLabels && releaseLabels.length > 0) {
    return releaseLabels.map((label, index) => ({
      id: createManualRecordId('release-label', `${index}`),
      label: label.name,
      catalogNumber: label.catalogNumber ?? '',
      hasNoCatalogNumber: label.hasNoCatalogNumber,
    }))
  }

  if (initialRelease && initialRelease.label !== 'Unknown label') {
    return [
      {
        id: createManualRecordId('release-label', '1'),
        label: initialRelease.label,
        catalogNumber: '',
        hasNoCatalogNumber: false,
      },
    ]
  }

  return []
}

export function initialCollectionItems(
  initialRelease?: ReleaseRecord,
): CollectionItemDraft[] {
  return (
    initialRelease?.ownedCopies.map((copy, index) => ({
      id: copy.id || createManualRecordId('collection-item', `${index + 1}`),
      status: copy.status,
      medium: copy.medium,
      note: copy.note,
    })) ?? []
  )
}
