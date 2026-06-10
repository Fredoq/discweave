import type { ArtistRecord } from '../artists/artistsData'
import type { CatalogDictionaries } from '../catalog/catalogApi'
import { createManualRecordId } from '../manualEntry/manualEntryUtils'
import type { EditableArtistCredit } from './ReleaseEntryFormTypes'
import { discogsRoleLabels } from './discogsRoleUtils'

export function groupDiscogsCredits(
  credits: ReadonlyArray<{ name: string; role: string }>,
  prefix: string,
  artists: ArtistRecord[],
  dictionaries: CatalogDictionaries,
): EditableArtistCredit[] {
  const grouped = new Map<string, EditableArtistCredit>()

  credits.forEach((credit, index) => {
    const editableCredit = editableCreditFromDiscogsCredit(
      credit.name,
      credit.role,
      index,
      prefix,
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
  name: string,
  role: string,
  index: number,
  prefix: string,
  artists: ArtistRecord[],
  dictionaries: CatalogDictionaries,
): EditableArtistCredit {
  const trimmedName = name.trim()
  const existingArtist = artists.find(
    (artist) => artist.name.toLowerCase() === trimmedName.toLowerCase(),
  )
  const roles = discogsRoleLabels(role, dictionaries)

  return {
    id: createManualRecordId(`${prefix}-artist-credit`, `discogs-${index + 1}`),
    artistId: existingArtist?.id ?? '',
    artist: existingArtist ? '' : trimmedName,
    role: roles[0] ?? '',
    roles,
  }
}
