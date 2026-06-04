import type { ArtistRecord } from '../artists/artistsData'
import { CreditRolePicker } from './CreditRolePicker'
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
    value: string | string[],
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
      <span className="release-artist-chip-roles">
        {credit.roles.map((role) => (
          <span className="release-artist-role-pill" key={role}>
            <span>{role}</span>
            <button
              type="button"
              aria-label={`Remove ${role} from ${artistName || 'artist'}`}
              onClick={() => {
                const roles = credit.roles.filter(
                  (currentRole) => currentRole !== role,
                )
                handleTrackArtistChange(trackId, credit.id, 'roles', roles)
                handleTrackArtistChange(
                  trackId,
                  credit.id,
                  'role',
                  roles[0] ?? '',
                )
              }}
            >
              ×
            </button>
          </span>
        ))}
        <CreditRolePicker
          addLabel={credit.roles.length > 0 ? 'Add role' : 'Set role'}
          ariaLabel={`Track role for ${artistName || 'artist'}`}
          options={creditRoleOptions.filter(
            (role) => !credit.roles.includes(role),
          )}
          onSelect={(role) => {
            if (!role || credit.roles.includes(role)) {
              return
            }

            const roles = [...credit.roles, role]
            handleTrackArtistChange(trackId, credit.id, 'roles', roles)
            handleTrackArtistChange(
              trackId,
              credit.id,
              'role',
              credit.role || role,
            )
          }}
        />
      </span>
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
