import type { Dispatch, SetStateAction } from 'react'
import type { ArtistRecord } from '../artists/artistsData'
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
                    <label className="release-artist-chip-role">
                      <span className="visually-hidden">
                        Role for {artistName || 'artist'}
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
                        aria-label={`Role for ${artistName || 'artist'}`}
                        value={credit.role}
                        onChange={(event) =>
                          setArtistCredits((credits) =>
                            credits.map((currentCredit) =>
                              currentCredit.id === credit.id
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
                        {creditRoleOptions.map((role) => (
                          <option key={role}>{role}</option>
                        ))}
                      </select>
                    </label>
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
