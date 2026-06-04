import type { Dispatch, SetStateAction } from 'react'
import type { ArtistRecord } from '../artists/artistsData'
import { CreditRolePicker } from './CreditRolePicker'
import type { EditableArtistCredit } from './ReleaseEntryFormTypes'
import { artistCreditName } from './releaseFormHelpers'

type ReleaseArtistCreditsSectionProps = {
  addDraftArtistCredit: () => void
  artistCredits: EditableArtistCredit[]
  artists: ArtistRecord[]
  creditRoleOptions: string[]
  draftArtist: string
  isVariousArtists: boolean
  setArtistCredits: Dispatch<SetStateAction<EditableArtistCredit[]>>
  setDraftArtist: Dispatch<SetStateAction<string>>
  setDraftArtistId: Dispatch<SetStateAction<string>>
  setIsVariousArtists: Dispatch<SetStateAction<boolean>>
}

export function ReleaseArtistCreditsSection({
  addDraftArtistCredit,
  artistCredits,
  artists,
  creditRoleOptions,
  draftArtist,
  isVariousArtists,
  setArtistCredits,
  setDraftArtist,
  setDraftArtistId,
  setIsVariousArtists,
}: ReleaseArtistCreditsSectionProps) {
  return (
    <section className="manual-entry-wide release-form-section">
      <div className="release-form-section-header">
        <div>
          <h3>Artists</h3>
          <p>Release credits.</p>
        </div>
        <div className="release-section-actions">
          <label className="compact-checkbox">
            <input
              type="checkbox"
              checked={isVariousArtists}
              onChange={(event) => setIsVariousArtists(event.target.checked)}
            />
            <span>Various Artists</span>
          </label>
        </div>
      </div>
      {isVariousArtists ? (
        <p className="release-section-note">
          Track rows must include their own artists.
        </p>
      ) : (
        <div className="release-artist-editor">
          <div className="release-artist-composer">
            <label className="release-artist-composer-name">
              <span>Artist</span>
              <input
                aria-label="Release artist"
                list="release-artist-options"
                placeholder="Search or type artist"
                value={draftArtist}
                onChange={(event) => {
                  const nextName = event.target.value
                  const existingArtist = artists.find(
                    (artist) => artist.name === nextName,
                  )

                  setDraftArtist(nextName)
                  setDraftArtistId(existingArtist?.id ?? '')
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addDraftArtistCredit()
                  }
                }}
              />
            </label>
            <button
              className="button button-secondary button-compact"
              type="button"
              onClick={addDraftArtistCredit}
            >
              Add artist
            </button>
          </div>
          <div className="release-artist-chip-list" aria-label="Artists">
            {artistCredits.length === 0 ? (
              <p className="release-section-note">
                Added artists will appear here.
              </p>
            ) : (
              artistCredits.map((credit) => {
                const artistName = artistCreditName(credit, artists)

                return (
                  <div className="release-artist-chip" key={credit.id}>
                    <span className="release-artist-chip-name">
                      {artistName || 'Unnamed artist'}
                    </span>
                    <span className="release-artist-chip-roles">
                      {credit.roles.map((role, index) => (
                        <span
                          className="release-artist-role-pill"
                          key={`${credit.id}-${role}-${index}`}
                        >
                          <span>{role}</span>
                          <button
                            type="button"
                            aria-label={`Remove ${role} from ${artistName || 'artist'}`}
                            onClick={() =>
                              removeCreditRole(credit, role, setArtistCredits)
                            }
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <CreditRolePicker
                        addLabel={
                          credit.roles.length > 0 ? 'Add role' : 'Set role'
                        }
                        ariaLabel={`Role for ${artistName || 'artist'}`}
                        options={creditRoleOptions.filter(
                          (role) => !credit.roles.includes(role),
                        )}
                        onSelect={(role) =>
                          addCreditRole(credit, role, setArtistCredits)
                        }
                      />
                    </span>
                    <button
                      className="release-artist-chip-remove"
                      type="button"
                      aria-label={`Remove ${artistName || 'artist'}`}
                      onClick={() =>
                        setArtistCredits((credits) =>
                          credits.filter(
                            (currentCredit) => currentCredit.id !== credit.id,
                          ),
                        )
                      }
                    >
                      ×
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
      <datalist id="release-artist-options">
        {artists.map((artistRecord) => (
          <option key={artistRecord.id} value={artistRecord.name} />
        ))}
      </datalist>
    </section>
  )
}

function addCreditRole(
  credit: EditableArtistCredit,
  role: string,
  setArtistCredits: Dispatch<SetStateAction<EditableArtistCredit[]>>,
) {
  if (!role) {
    return
  }

  setArtistCredits((credits) =>
    credits.map((currentCredit) => {
      if (
        currentCredit.id !== credit.id ||
        currentCredit.roles.includes(role)
      ) {
        return currentCredit
      }

      return {
        ...currentCredit,
        role: currentCredit.role || role,
        roles: [...currentCredit.roles, role],
      }
    }),
  )
}

function removeCreditRole(
  credit: EditableArtistCredit,
  role: string,
  setArtistCredits: Dispatch<SetStateAction<EditableArtistCredit[]>>,
) {
  setArtistCredits((credits) =>
    credits.map((currentCredit) => {
      if (currentCredit.id !== credit.id) {
        return currentCredit
      }

      const nextRoles = currentCredit.roles.filter(
        (currentRole) => currentRole !== role,
      )
      return {
        ...currentCredit,
        role: nextRoles[0] ?? '',
        roles: nextRoles,
      }
    }),
  )
}
