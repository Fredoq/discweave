import type { ArtistRecord } from '../artists/artistsData'
import type { CatalogDictionaries } from '../catalog/catalogApi'
import { createManualRecordId } from '../manualEntry/manualEntryUtils'
import { discogsRoleLabels } from '../releases/discogsRoleUtils'

export type EditableTrackCredit = {
  artist: string
  artistId?: string
  id: string
  role: string
  roles: string[]
  scope: string
}

export function groupDiscogsTrackCredits(
  artistCredits: ReadonlyArray<{ name: string; role: string }>,
  artists: ArtistRecord[],
  dictionaries: CatalogDictionaries,
) {
  const grouped = new Map<string, EditableTrackCredit>()

  artistCredits.forEach((credit, index) => {
    const editableCredit = editableCreditFromDiscogsCredit(
      credit.name,
      credit.role,
      index,
      artists,
      dictionaries,
    )
    const key =
      editableCredit.artistId ||
      editableCredit.artist.trim().toLowerCase() ||
      editableCredit.id
    const existing = grouped.get(key)

    if (existing) {
      existing.roles = [
        ...new Set([...existing.roles, ...editableCredit.roles]),
      ]
      existing.role = existing.roles[0] ?? ''
    } else {
      grouped.set(key, editableCredit)
    }
  })

  return [...grouped.values()]
}

function editableCreditFromDiscogsCredit(
  artistName: string,
  role: string,
  index: number,
  artists: ArtistRecord[],
  dictionaries: CatalogDictionaries,
): EditableTrackCredit {
  const normalizedArtistName = artistName.trim()
  const existingArtist = artists.find(
    (record) =>
      record.name.toLowerCase() === normalizedArtistName.toLowerCase(),
  )
  const roles = discogsRoleLabels(role, dictionaries)

  return {
    id: createManualRecordId(
      'track-credit',
      `${normalizedArtistName}-${role}-${index}`,
    ),
    artistId: existingArtist?.id,
    artist: existingArtist?.name ?? normalizedArtistName,
    role: roles[0] ?? '',
    roles,
    scope: 'Suggested by Discogs track detail.',
  }
}
