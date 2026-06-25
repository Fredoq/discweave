import type { ArtistRecord } from '../artists/artistsData'
import type {
  DictionaryEntry,
  ReleaseImportArtistCredit,
} from '../catalog/catalogApi'
import { dictionaryNameForCode, importArtistCreditName } from './importHelpers'

type TrackSpecificCreditListProps = Readonly<{
  artists: ArtistRecord[]
  creditRoleOptions: DictionaryEntry[]
  credits: ReleaseImportArtistCredit[]
  isVariousArtists: boolean
  secondaryCreditRoleOptions: DictionaryEntry[]
  onChange: (credits: ReleaseImportArtistCredit[]) => void
}>

export function TrackSpecificCreditList({
  artists,
  creditRoleOptions,
  credits,
  isVariousArtists,
  secondaryCreditRoleOptions,
  onChange,
}: TrackSpecificCreditListProps) {
  if (credits.length === 0) {
    return (
      <p className="release-section-note">
        Added track-specific credits will appear here.
      </p>
    )
  }

  return credits.map((credit, index) => {
    const artistName = importArtistCreditName(credit, artists)
    const roleName = dictionaryNameForCode(credit.role, creditRoleOptions)
    const roleIsKnown =
      !credit.role ||
      creditRoleOptions.some(
        (role) => role.code === credit.role || role.name === credit.role,
      )

    return (
      <div
        className={
          roleIsKnown
            ? 'release-artist-chip'
            : 'release-artist-chip release-artist-chip-invalid'
        }
        key={`${artistName}-${index}`}
      >
        <span className="release-artist-chip-name">
          {artistName || 'Unnamed artist'}
        </span>
        <label className="release-artist-chip-role">
          <span className="visually-hidden">
            Track role for {artistName || 'artist'}
          </span>
          <span
            className={
              !roleIsKnown
                ? 'release-artist-chip-role-face release-artist-chip-role-face-invalid'
                : credit.role
                ? 'release-artist-chip-role-face'
                : 'release-artist-chip-role-face release-artist-chip-role-face-unset'
            }
            aria-hidden="true"
          >
            <span>{roleName || 'Set role'}</span>
            <span className="release-artist-chip-role-caret" />
          </span>
          <select
            aria-label={`Track role for ${artistName || 'artist'}`}
            className="release-artist-chip-role-select"
            value={credit.role}
            onChange={(event) =>
              onChange(
                credits.map((currentCredit, currentIndex) =>
                  currentIndex === index
                    ? {
                        ...currentCredit,
                        role: event.target.value,
                      }
                    : currentCredit,
                ),
              )
            }
          >
            <option value="">Set role</option>
            {!roleIsKnown ? (
              <option value={credit.role}>
                {credit.role} (not in settings)
              </option>
            ) : null}
            {credit.role === 'mainArtist' || isVariousArtists ? (
              <option value="mainArtist">Main artist</option>
            ) : null}
            {secondaryCreditRoleOptions.map((role) => (
              <option key={role.id} value={role.code}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
        {!roleIsKnown ? (
          <span className="release-artist-chip-warning">
            Role is not in Settings &gt; Credit roles.
          </span>
        ) : null}
        <button
          aria-label={`Remove ${artistName || 'artist'} from track`}
          className="release-artist-chip-remove"
          type="button"
          onClick={() =>
            onChange(
              credits.filter((_, currentIndex) => currentIndex !== index),
            )
          }
        >
          ×
        </button>
      </div>
    )
  })
}
