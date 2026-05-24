import type { ArtistRecord } from '../artists/artistsData'
import type { EditableArtistCredit } from './ReleaseEntryFormTypes'
import { artistCreditName } from './releaseFormHelpers'

type ReleaseTrackArtistCreditChipProps = {
  artists: ArtistRecord[]
  credit: EditableArtistCredit
  creditRoleOptions: string[]
  handleTrackArtistChange: (
    trackId: string,
    creditId: string,
    field: keyof Omit<EditableArtistCredit, 'id'>,
    value: string,
  ) => void
  removeTrackArtist: (trackId: string, creditId: string) => void
  trackId: string
}

export function ReleaseTrackArtistCreditChip({
  artists,
  credit,
  creditRoleOptions,
  handleTrackArtistChange,
  removeTrackArtist,
  trackId,
}: ReleaseTrackArtistCreditChipProps) {
  const artistName = artistCreditName(credit, artists)

  return (
    <div className="release-artist-chip">
      <span className="release-artist-chip-name">
        {artistName || 'Unnamed artist'}
      </span>
      <label className="release-artist-chip-role">
        <span className="visually-hidden">
          Track role for {artistName || 'artist'}
        </span>
        <span
          className={
            credit.role
              ? 'release-artist-chip-role-face'
              : 'release-artist-chip-role-face release-artist-chip-role-face-unset'
          }
          aria-hidden="true"
        >
          <span>{credit.role || 'Set role'}</span>
          <span className="release-artist-chip-role-caret" />
        </span>
        <select
          className="release-artist-chip-role-select"
          aria-label={`Track role for ${artistName || 'artist'}`}
          value={credit.role}
          onChange={(event) =>
            handleTrackArtistChange(
              trackId,
              credit.id,
              'role',
              event.target.value,
            )
          }
        >
          <option value="">Set role</option>
          {creditRoleOptions.map((role) => (
            <option key={role}>{role}</option>
          ))}
        </select>
      </label>
      <button
        className="release-artist-chip-remove"
        type="button"
        aria-label={`Remove ${artistName || 'artist'} from track`}
        onClick={() => removeTrackArtist(trackId, credit.id)}
      >
        ×
      </button>
    </div>
  )
}
