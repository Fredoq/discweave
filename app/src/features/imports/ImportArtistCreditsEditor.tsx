import { useState } from 'react'
import type { ArtistRecord } from '../artists/artistsData'
import type {
  DictionaryEntry,
  ReleaseImportArtistCredit,
} from '../catalog/catalogApi'
import { ImportEntitySuggestionRow } from './ImportEntitySuggestions'
import {
  UnknownImportCreditRoleOption,
  UnknownImportCreditRoleWarning,
} from './ImportCreditRoleOptions'
import { importCreditRoleIsKnown } from './importCreditRoleKnown'
import { useImportEntitySuggestions } from './importEntitySuggestionHooks'
import { dictionaryNameForCode, importArtistCreditName } from './importHelpers'

export function ImportArtistCreditsEditor({
  artists,
  creditRoleOptions,
  credits,
  isVariousArtists,
  onChange,
}: {
  artists: ArtistRecord[]
  creditRoleOptions: DictionaryEntry[]
  credits: ReleaseImportArtistCredit[]
  isVariousArtists: boolean
  onChange: (credits: ReleaseImportArtistCredit[]) => void
}) {
  const [draftArtist, setDraftArtist] = useState('')
  const [draftArtistId, setDraftArtistId] = useState('')
  const suggestions = useImportEntitySuggestions(draftArtist, 'artist')

  function addArtistCredit(name = draftArtist, artistId = draftArtistId) {
    const artistName = name.trim()

    if (!artistName && !artistId) {
      return
    }

    const existingArtist = artists.find((artist) => artist.id === artistId)
    onChange([
      ...credits,
      {
        artistId: artistId || null,
        name: existingArtist?.name ?? artistName,
        role: '',
      },
    ])
    setDraftArtist('')
    setDraftArtistId('')
  }

  if (isVariousArtists) {
    return (
      <p className="release-section-note">
        Track rows must include their own artists.
      </p>
    )
  }

  return (
    <div className="release-artist-editor">
      <div className="release-artist-composer">
        <label className="release-artist-composer-name">
          <span>Artist</span>
          <input
            aria-label="Release artist"
            placeholder="Search or type artist"
            value={draftArtist}
            onChange={(event) => {
              const nextName = event.target.value
              const existingArtist = [...artists, ...suggestions].find(
                (artist) =>
                  artist.name.toLowerCase() === nextName.toLowerCase(),
              )

              setDraftArtist(nextName)
              setDraftArtistId(existingArtist?.id ?? '')
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addArtistCredit()
              }
            }}
          />
        </label>
        <button
          className="button button-secondary button-compact"
          type="button"
          onClick={() => addArtistCredit()}
        >
          Add artist
        </button>
      </div>
      {draftArtist.trim().length >= 2 ? (
        <ImportEntitySuggestionRow
          emptyLabel="No matching artist found. Add will create a new artist."
          suggestions={suggestions}
          onSelect={(suggestion) =>
            addArtistCredit(suggestion.name, suggestion.id)
          }
        />
      ) : null}
      <div className="release-artist-chip-list" aria-label="Artists">
        {credits.length === 0 ? (
          <p className="release-section-note">
            Added artists will appear here.
          </p>
        ) : (
          credits.map((credit, index) => {
            const artistName = importArtistCreditName(credit, artists)
            const roleName = dictionaryNameForCode(
              credit.role,
              creditRoleOptions,
            )
            const roleIsKnown = importCreditRoleIsKnown(
              credit.role,
              creditRoleOptions,
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
                    Role for {artistName || 'artist'}
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
                    aria-label={`Role for ${artistName || 'artist'}`}
                    className="release-artist-chip-role-select"
                    value={credit.role}
                    onChange={(event) =>
                      onChange(
                        credits.map((currentCredit, currentIndex) =>
                          currentIndex === index
                            ? { ...currentCredit, role: event.target.value }
                            : currentCredit,
                        ),
                      )
                    }
                  >
                    <option value="">Set role</option>
                    {!roleIsKnown ? (
                      <UnknownImportCreditRoleOption roleName={credit.role} />
                    ) : null}
                    {creditRoleOptions.map((role) => (
                      <option key={role.id} value={role.code}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </label>
                {!roleIsKnown ? <UnknownImportCreditRoleWarning /> : null}
                <button
                  aria-label={`Remove ${artistName || 'artist'}`}
                  className="release-artist-chip-remove"
                  type="button"
                  onClick={() =>
                    onChange(
                      credits.filter(
                        (_, currentIndex) => currentIndex !== index,
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
  )
}
