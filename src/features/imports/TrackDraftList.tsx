import { useState } from 'react'
import type { ArtistRecord } from '../artists/artistsData'
import type {
  DictionaryEntry,
  EntitySuggestion,
  ReleaseImportArtistCredit,
  ReleaseImportDraftTrack,
} from '../catalog/catalogApi'
import {
  dictionaryNameForCode,
  effectiveTrackArtistCredits,
  importArtistCreditName,
  withTrackArtistCredits,
} from './importHelpers'

export function TrackDraftList({
  artists,
  creditRoleOptions,
  tracks,
  onChange,
}: {
  artists: ArtistRecord[]
  creditRoleOptions: DictionaryEntry[]
  tracks: ReleaseImportDraftTrack[]
  onChange: (tracks: ReleaseImportDraftTrack[]) => void
}) {
  const [selectedTrackId, setSelectedTrackId] = useState('')
  const [draftArtist, setDraftArtist] = useState('')
  const [draftArtistId, setDraftArtistId] = useState('')
  const selectedTrack =
    tracks.find((track) => track.id === selectedTrackId) ??
    tracks.find((track) => !track.isSkipped) ??
    tracks[0] ??
    null
  const selectedTrackIndex = selectedTrack
    ? tracks.findIndex((track) => track.id === selectedTrack.id)
    : -1

  function updateTrack(
    trackId: string,
    patch: Partial<ReleaseImportDraftTrack>,
  ) {
    onChange(
      tracks.map((track) =>
        track.id === trackId ? { ...track, ...patch } : track,
      ),
    )
  }

  function updateTrackArtistCredits(
    trackId: string,
    credits: ReleaseImportArtistCredit[],
  ) {
    onChange(
      tracks.map((track) =>
        track.id === trackId ? withTrackArtistCredits(track, credits) : track,
      ),
    )
  }

  function addTrackArtist(
    trackId: string,
    name = draftArtist,
    artistId = draftArtistId,
  ) {
    const artistName = name.trim()
    if (!artistName && !artistId) {
      return
    }

    const track = tracks.find((item) => item.id === trackId)
    if (!track) {
      return
    }

    const existingArtist = artists.find((artist) => artist.id === artistId)
    updateTrackArtistCredits(trackId, [
      ...effectiveTrackArtistCredits(track),
      {
        artistId: artistId || null,
        name: existingArtist?.name ?? artistName,
        role: '',
      },
    ])
    setDraftArtist('')
    setDraftArtistId('')
  }

  if (!selectedTrack) {
    return (
      <div className="imports-tracklist-editor">
        <div className="release-tracklist-toolbar imports-tracklist-toolbar">
          <div>
            <strong>Tracklist</strong>
            <span>No tracks found.</span>
          </div>
        </div>
      </div>
    )
  }

  const selectedTrackMatch = selectedTrack.selectedTrackId
    ? selectedTrack.trackSuggestions.find(
        (suggestion) => suggestion.id === selectedTrack.selectedTrackId,
      )
    : null

  return (
    <div className="imports-tracklist-editor">
      <div className="release-tracklist-toolbar imports-tracklist-toolbar">
        <div>
          <strong>Tracklist</strong>
          <span>
            {tracks.length} tracks · selected track {selectedTrackIndex + 1}
          </span>
        </div>
      </div>
      <div className="release-tracklist-layout imports-tracklist-layout">
        <div
          className="release-tracklist-master imports-tracklist-master"
          role="list"
        >
          {tracks.map((track, index) => {
            const isSelected = track.id === selectedTrack.id
            return (
              <button
                className={
                  isSelected
                    ? 'release-tracklist-master-row is-selected'
                    : 'release-tracklist-master-row'
                }
                key={track.id}
                type="button"
                onClick={() => setSelectedTrackId(track.id)}
              >
                <span className="release-tracklist-master-number">
                  {track.position ?? index + 1}
                </span>
                <span className="release-tracklist-master-copy">
                  <strong>
                    {track.title || `Untitled track ${index + 1}`}
                  </strong>
                  <span>
                    {effectiveTrackArtistCredits(track)
                      .map((credit) => importArtistCreditName(credit, artists))
                      .filter(Boolean)
                      .join(', ') || track.relativePath}
                  </span>
                </span>
                <span className="release-tracklist-master-action">
                  {track.isSkipped
                    ? 'Skipped'
                    : track.selectedTrackId
                      ? 'Matched'
                      : track.issues.length > 0
                        ? 'Review'
                        : 'Edit'}
                </span>
              </button>
            )
          })}
        </div>
        <div className="release-tracklist-detail imports-tracklist-detail">
          <div className="release-tracklist-detail-header">
            <div>
              <h4>Track {selectedTrackIndex + 1} details</h4>
              <p>{selectedTrack.relativePath}</p>
            </div>
            <label className="compact-checkbox">
              <input
                checked={selectedTrack.isSkipped}
                type="checkbox"
                onChange={(event) =>
                  updateTrack(selectedTrack.id, {
                    isSkipped: event.target.checked,
                  })
                }
              />
              <span>Skip track</span>
            </label>
          </div>
          {selectedTrackMatch || selectedTrack.selectedTrackId ? (
            <p className="imports-match-note" role="status">
              Existing track selected:{' '}
              {selectedTrackMatch?.name ?? selectedTrack.selectedTrackId}
            </p>
          ) : null}
          {selectedTrack.issues.length > 0 ? (
            <div className="imports-issue-list" role="status">
              {selectedTrack.issues.map((issue, index) => (
                <p key={`${issue.code}:${issue.message}:${index}`}>
                  <strong>{issue.severity}</strong> {issue.message}
                </p>
              ))}
            </div>
          ) : null}
          <div className="imports-track-detail-grid">
            <label className="settings-control imports-position-field">
              <span>No.</span>
              <input
                value={selectedTrack.position ?? ''}
                onChange={(event) =>
                  updateTrack(selectedTrack.id, {
                    position: Number.parseInt(event.target.value, 10) || null,
                  })
                }
              />
            </label>
            <label className="settings-control release-track-title-field">
              <span>Track title</span>
              <input
                value={selectedTrack.title}
                onChange={(event) =>
                  updateTrack(selectedTrack.id, { title: event.target.value })
                }
              />
            </label>
          </div>
          <div className="track-artist-editor imports-track-artist-editor">
            <div className="track-artist-editor-header">
              <span>Artists</span>
            </div>
            <div className="track-artist-custom-editor">
              <div className="track-artist-composer">
                <label>
                  <span>Artist</span>
                  <input
                    aria-label="Track artist"
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
                        addTrackArtist(selectedTrack.id)
                      }
                    }}
                  />
                </label>
                <button
                  aria-label="Add track artist"
                  className="button button-secondary button-compact"
                  type="button"
                  onClick={() => addTrackArtist(selectedTrack.id)}
                >
                  Add artist
                </button>
              </div>
              <div
                className="track-artist-custom-chip-list"
                aria-label="Track artists"
              >
                {effectiveTrackArtistCredits(selectedTrack).length === 0 ? (
                  <p className="release-section-note">
                    Added track artists will appear here.
                  </p>
                ) : (
                  effectiveTrackArtistCredits(selectedTrack).map(
                    (credit, index) => {
                      const artistName = importArtistCreditName(credit, artists)
                      const roleName = dictionaryNameForCode(
                        credit.role,
                        creditRoleOptions,
                      )

                      return (
                        <div
                          className="release-artist-chip"
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
                                credit.role
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
                                updateTrackArtistCredits(
                                  selectedTrack.id,
                                  effectiveTrackArtistCredits(
                                    selectedTrack,
                                  ).map((currentCredit, currentIndex) =>
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
                              {creditRoleOptions.map((role) => (
                                <option key={role.id} value={role.code}>
                                  {role.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            aria-label={`Remove ${artistName || 'artist'} from track`}
                            className="release-artist-chip-remove"
                            type="button"
                            onClick={() =>
                              updateTrackArtistCredits(
                                selectedTrack.id,
                                effectiveTrackArtistCredits(
                                  selectedTrack,
                                ).filter(
                                  (_, currentIndex) => currentIndex !== index,
                                ),
                              )
                            }
                          >
                            ×
                          </button>
                        </div>
                      )
                    },
                  )
                )}
              </div>
            </div>
          </div>
          <SuggestionRow
            suggestions={[
              ...selectedTrack.artistSuggestions,
              ...selectedTrack.trackSuggestions,
            ]}
            selectedIds={[
              ...effectiveTrackArtistCredits(selectedTrack)
                .map((credit) => credit.artistId)
                .filter((artistId): artistId is string => Boolean(artistId)),
              ...(selectedTrack.selectedTrackId
                ? [selectedTrack.selectedTrackId]
                : []),
            ]}
            onSelect={(suggestion) => {
              const isTrackSuggestion = selectedTrack.trackSuggestions.some(
                (item) => item.id === suggestion.id,
              )
              if (isTrackSuggestion) {
                updateTrack(selectedTrack.id, {
                  selectedTrackId: suggestion.id,
                })
                return
              }

              addTrackArtist(selectedTrack.id, suggestion.name, suggestion.id)
            }}
            onClear={() =>
              updateTrack(selectedTrack.id, {
                artistCredits: [],
                artistNames: [],
                selectedArtistIds: [],
                selectedTrackId: null,
              })
            }
          />
        </div>
      </div>
    </div>
  )
}

function SuggestionRow({
  suggestions,
  selectedIds,
  onSelect,
  onClear,
}: {
  suggestions: EntitySuggestion[]
  selectedIds: string[]
  onSelect: (suggestion: EntitySuggestion) => void
  onClear: () => void
}) {
  if (suggestions.length === 0) {
    return <p className="imports-suggestions">New entity</p>
  }

  return (
    <div className="imports-suggestions">
      {suggestions.slice(0, 4).map((suggestion) => (
        <button
          className={
            selectedIds.includes(suggestion.id) ? 'is-selected' : undefined
          }
          key={suggestion.id}
          type="button"
          onClick={() => onSelect(suggestion)}
        >
          {suggestion.name}
        </button>
      ))}
      {selectedIds.length > 0 ? (
        <button type="button" onClick={onClear}>
          New
        </button>
      ) : null}
    </div>
  )
}
