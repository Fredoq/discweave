import type { RefObject } from 'react'
import type { ArtistRecord } from '../artists/artistsData'
import type { DurationParts } from '../catalog/durationFormat'
import type { TrackRecord } from '../tracks/tracksData'
import type { ReleaseArtistCredit } from './releasesData'
import type {
  DraftTrackRow,
  EditableArtistCredit,
} from './ReleaseEntryFormTypes'
import { ReleaseTrackArtistCreditChip } from './ReleaseTrackArtistCreditChip'
import { artistCreditName, releaseArtistCreditKey } from './releaseFormHelpers'

export type ReleaseTrackDetailProps = {
  addTrackArtist: (trackId: string) => void
  artists: ArtistRecord[]
  clearExistingTrack: (trackId: string) => void
  creditRoleOptions: string[]
  handleDraftTrackChange: (
    trackId: string,
    field: 'title' | 'versionNote' | 'existingTrackQuery' | 'disc' | 'side',
    value: string,
  ) => void
  handleDraftTrackDurationChange: (
    trackId: string,
    field: keyof DurationParts,
    value: string,
    max: number,
  ) => void
  handleTrackArtistChange: (
    trackId: string,
    creditId: string,
    field: keyof Omit<EditableArtistCredit, 'id'>,
    value: string | string[],
  ) => void
  handleTrackDraftArtistChange: (trackId: string, nextName: string) => void
  isVariousArtists: boolean
  releaseMainArtistCredits: ReleaseArtistCredit[]
  removeDraftTrack: (trackId: string) => void
  removeTrackArtist: (trackId: string, creditId: string) => void
  selectExistingTrack: (trackId: string, linkedTrack: TrackRecord) => void
  selectedCustomTrackCredits: EditableArtistCredit[]
  selectedDraftTrack: DraftTrackRow
  selectedDraftTrackIndex: number
  selectedDraftTrackTitleRef: RefObject<HTMLInputElement | null>
  selectedExistingTrack?: TrackRecord
  selectedExistingTrackSuggestions: TrackRecord[]
  selectedReleaseArtistKeys: Set<string>
  setTrackArtistMode: (
    trackId: string,
    inheritReleaseArtistCredits: boolean,
  ) => void
  toggleReleaseTrackArtist: (
    trackId: string,
    credit: ReleaseArtistCredit,
    checked: boolean,
  ) => void
}

export function ReleaseTrackDetail({
  addTrackArtist,
  artists,
  clearExistingTrack,
  creditRoleOptions,
  handleDraftTrackChange,
  handleDraftTrackDurationChange,
  handleTrackArtistChange,
  handleTrackDraftArtistChange,
  isVariousArtists,
  releaseMainArtistCredits,
  removeDraftTrack,
  removeTrackArtist,
  selectExistingTrack,
  selectedCustomTrackCredits,
  selectedDraftTrack,
  selectedDraftTrackIndex,
  selectedDraftTrackTitleRef,
  selectedExistingTrack,
  selectedExistingTrackSuggestions,
  selectedReleaseArtistKeys,
  setTrackArtistMode,
  toggleReleaseTrackArtist,
}: ReleaseTrackDetailProps) {
  return (
    <div className="release-tracklist-detail">
      <div className="release-tracklist-detail-header">
        <div>
          <h4>Track {selectedDraftTrackIndex} details</h4>
          <p>Changes update the selected track row.</p>
        </div>
        <div className="release-track-detail-actions">
          <span className="release-row-index">
            Track {selectedDraftTrackIndex}
          </span>
          <button
            className="button button-secondary button-compact"
            type="button"
            aria-label={`Remove track ${selectedDraftTrackIndex} from tracklist`}
            onClick={() => removeDraftTrack(selectedDraftTrack.id)}
          >
            Remove
          </button>
        </div>
      </div>
      <div className="existing-track-linker">
        <label>
          <span>Existing track</span>
          <input
            aria-label="Existing track"
            placeholder="Search title, artist or release"
            value={selectedDraftTrack.existingTrackQuery}
            onChange={(event) =>
              handleDraftTrackChange(
                selectedDraftTrack.id,
                'existingTrackQuery',
                event.target.value,
              )
            }
          />
        </label>
        {selectedExistingTrack ? (
          <div className="existing-track-summary">
            <span className="badge badge-tag">Linked to existing track</span>
            <strong>{selectedExistingTrack.title}</strong>
            <span>
              {selectedExistingTrack.artist} · {selectedExistingTrack.duration}
            </span>
            <button
              className="button button-secondary button-compact"
              type="button"
              onClick={() => clearExistingTrack(selectedDraftTrack.id)}
            >
              Clear linked track
            </button>
          </div>
        ) : selectedExistingTrackSuggestions.length > 0 ? (
          <div
            className="existing-track-results"
            aria-label="Existing track suggestions"
          >
            {selectedExistingTrackSuggestions.map((track) => (
              <button
                key={track.id}
                type="button"
                aria-label={`Use existing track ${track.title}`}
                onClick={() =>
                  selectExistingTrack(selectedDraftTrack.id, track)
                }
              >
                <strong>{track.title}</strong>
                <span>
                  {track.artist} · {track.release.title}
                </span>
              </button>
            ))}
          </div>
        ) : selectedDraftTrack.existingTrackQuery.trim().length > 0 ? (
          <p className="release-section-note">No matching existing tracks.</p>
        ) : null}
      </div>
      <div className="release-track-detail-grid">
        <label className="release-track-title-field">
          <span>Track title</span>
          <input
            aria-label="Track title"
            ref={selectedDraftTrackTitleRef}
            disabled={Boolean(selectedDraftTrack.existingTrackId)}
            value={selectedDraftTrack.title}
            onChange={(event) =>
              handleDraftTrackChange(
                selectedDraftTrack.id,
                'title',
                event.target.value,
              )
            }
          />
        </label>
        <TrackDurationFields
          disabled={Boolean(selectedDraftTrack.existingTrackId)}
          durationParts={selectedDraftTrack.durationParts}
          onChange={(field, value, max) =>
            handleDraftTrackDurationChange(
              selectedDraftTrack.id,
              field,
              value,
              max,
            )
          }
        />
        <label>
          <span>Disc</span>
          <input
            aria-label="Disc"
            value={selectedDraftTrack.disc}
            onChange={(event) =>
              handleDraftTrackChange(
                selectedDraftTrack.id,
                'disc',
                event.target.value,
              )
            }
          />
        </label>
        <label>
          <span>Side</span>
          <input
            aria-label="Side"
            value={selectedDraftTrack.side}
            onChange={(event) =>
              handleDraftTrackChange(
                selectedDraftTrack.id,
                'side',
                event.target.value,
              )
            }
          />
        </label>
        <label className="release-track-version-field">
          <span>Version note</span>
          <input
            aria-label="Version note"
            value={selectedDraftTrack.versionNote}
            onChange={(event) =>
              handleDraftTrackChange(
                selectedDraftTrack.id,
                'versionNote',
                event.target.value,
              )
            }
          />
        </label>
      </div>
      <TrackArtistEditor
        addTrackArtist={addTrackArtist}
        artists={artists}
        creditRoleOptions={creditRoleOptions}
        handleTrackArtistChange={handleTrackArtistChange}
        handleTrackDraftArtistChange={handleTrackDraftArtistChange}
        isVariousArtists={isVariousArtists}
        releaseMainArtistCredits={releaseMainArtistCredits}
        removeTrackArtist={removeTrackArtist}
        selectedCustomTrackCredits={selectedCustomTrackCredits}
        selectedDraftTrack={selectedDraftTrack}
        selectedExistingTrack={selectedExistingTrack}
        selectedReleaseArtistKeys={selectedReleaseArtistKeys}
        setTrackArtistMode={setTrackArtistMode}
        toggleReleaseTrackArtist={toggleReleaseTrackArtist}
      />
    </div>
  )
}

function TrackDurationFields({
  disabled,
  durationParts,
  onChange,
}: {
  disabled: boolean
  durationParts: DurationParts
  onChange: (field: keyof DurationParts, value: string, max: number) => void
}) {
  return (
    <div className="track-duration-field">
      <span>Duration</span>
      <div
        className="track-duration-control"
        role="group"
        aria-label="Track duration"
      >
        {(
          [
            ['hours', 'Hours', 99],
            ['minutes', 'Minutes', 59],
            ['seconds', 'Seconds', 59],
          ] as const
        ).map(([field, label, max]) => (
          <label key={field}>
            <span>{label}</span>
            <input
              aria-label={`Track duration ${String(label).toLowerCase()}`}
              inputMode="numeric"
              min="0"
              max={max}
              type="number"
              disabled={disabled}
              value={durationParts[field]}
              onChange={(event) => onChange(field, event.target.value, max)}
            />
          </label>
        ))}
      </div>
    </div>
  )
}

function TrackArtistEditor({
  addTrackArtist,
  artists,
  creditRoleOptions,
  handleTrackArtistChange,
  handleTrackDraftArtistChange,
  isVariousArtists,
  releaseMainArtistCredits,
  removeTrackArtist,
  selectedCustomTrackCredits,
  selectedDraftTrack,
  selectedExistingTrack,
  selectedReleaseArtistKeys,
  setTrackArtistMode,
  toggleReleaseTrackArtist,
}: Pick<
  ReleaseTrackDetailProps,
  | 'addTrackArtist'
  | 'artists'
  | 'creditRoleOptions'
  | 'handleTrackArtistChange'
  | 'handleTrackDraftArtistChange'
  | 'isVariousArtists'
  | 'releaseMainArtistCredits'
  | 'removeTrackArtist'
  | 'selectedCustomTrackCredits'
  | 'selectedDraftTrack'
  | 'selectedExistingTrack'
  | 'selectedReleaseArtistKeys'
  | 'setTrackArtistMode'
  | 'toggleReleaseTrackArtist'
>) {
  return (
    <div className="track-artist-editor">
      <div className="track-artist-editor-header">
        <span>Artists</span>
        {!selectedDraftTrack.existingTrackId && !isVariousArtists ? (
          <button
            className="button button-secondary button-compact"
            type="button"
            onClick={() =>
              setTrackArtistMode(
                selectedDraftTrack.id,
                !selectedDraftTrack.inheritReleaseArtistCredits,
              )
            }
          >
            {selectedDraftTrack.inheritReleaseArtistCredits
              ? 'Use custom artists'
              : 'Inherit release artists'}
          </button>
        ) : null}
      </div>
      {selectedDraftTrack.existingTrackId ? (
        <ExistingTrackArtistChips
          artists={artists}
          selectedDraftTrack={selectedDraftTrack}
          selectedExistingTrack={selectedExistingTrack}
        />
      ) : selectedDraftTrack.inheritReleaseArtistCredits &&
        !isVariousArtists ? (
        <ReleaseArtistChips
          releaseMainArtistCredits={releaseMainArtistCredits}
        />
      ) : (
        <CustomTrackArtistEditor
          addTrackArtist={addTrackArtist}
          artists={artists}
          creditRoleOptions={creditRoleOptions}
          handleTrackArtistChange={handleTrackArtistChange}
          handleTrackDraftArtistChange={handleTrackDraftArtistChange}
          releaseMainArtistCredits={releaseMainArtistCredits}
          removeTrackArtist={removeTrackArtist}
          selectedCustomTrackCredits={selectedCustomTrackCredits}
          selectedDraftTrack={selectedDraftTrack}
          selectedReleaseArtistKeys={selectedReleaseArtistKeys}
          toggleReleaseTrackArtist={toggleReleaseTrackArtist}
        />
      )}
    </div>
  )
}

function ExistingTrackArtistChips({
  artists,
  selectedDraftTrack,
  selectedExistingTrack,
}: Pick<
  ReleaseTrackDetailProps,
  'artists' | 'selectedDraftTrack' | 'selectedExistingTrack'
>) {
  return (
    <div className="track-artist-chip-list">
      {(
        selectedExistingTrack?.credits.map((credit) => credit.artist) ??
        selectedDraftTrack.artistCredits.map((credit) =>
          artistCreditName(credit, artists),
        )
      )
        .filter(Boolean)
        .filter(
          (artistName, index, artistNames) =>
            artistNames.indexOf(artistName) === index,
        )
        .map((artistName) => (
          <span className="track-artist-chip is-selected" key={artistName}>
            {artistName}
          </span>
        ))}
    </div>
  )
}

function ReleaseArtistChips({
  releaseMainArtistCredits,
}: {
  releaseMainArtistCredits: ReleaseArtistCredit[]
}) {
  return (
    <div className="track-artist-chip-list">
      {releaseMainArtistCredits.length > 0 ? (
        releaseMainArtistCredits.map((credit) => (
          <span
            className="track-artist-chip is-selected"
            key={releaseArtistCreditKey(credit)}
          >
            {credit.artist}
          </span>
        ))
      ) : (
        <span className="track-artist-chip">Release main artists</span>
      )}
    </div>
  )
}

function CustomTrackArtistEditor({
  addTrackArtist,
  artists,
  creditRoleOptions,
  handleTrackArtistChange,
  handleTrackDraftArtistChange,
  releaseMainArtistCredits,
  removeTrackArtist,
  selectedCustomTrackCredits,
  selectedDraftTrack,
  selectedReleaseArtistKeys,
  toggleReleaseTrackArtist,
}: Pick<
  ReleaseTrackDetailProps,
  | 'addTrackArtist'
  | 'artists'
  | 'creditRoleOptions'
  | 'handleTrackArtistChange'
  | 'handleTrackDraftArtistChange'
  | 'releaseMainArtistCredits'
  | 'removeTrackArtist'
  | 'selectedCustomTrackCredits'
  | 'selectedDraftTrack'
  | 'selectedReleaseArtistKeys'
  | 'toggleReleaseTrackArtist'
>) {
  return (
    <div className="track-artist-custom-editor">
      {releaseMainArtistCredits.length > 0 ? (
        <fieldset className="track-artist-chip-fieldset">
          <legend>Release artists</legend>
          <div className="track-artist-chip-list">
            {releaseMainArtistCredits.map((credit) => (
              <label
                className="track-artist-chip"
                key={releaseArtistCreditKey(credit)}
              >
                <input
                  aria-label={`Use ${credit.artist} on track`}
                  checked={selectedReleaseArtistKeys.has(
                    releaseArtistCreditKey(credit),
                  )}
                  type="checkbox"
                  onChange={(event) =>
                    toggleReleaseTrackArtist(
                      selectedDraftTrack.id,
                      credit,
                      event.target.checked,
                    )
                  }
                />
                <span>{credit.artist}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <TrackArtistComposer
        addTrackArtist={addTrackArtist}
        handleTrackDraftArtistChange={handleTrackDraftArtistChange}
        selectedDraftTrack={selectedDraftTrack}
      />
      <div className="track-artist-custom-chip-list" aria-label="Track artists">
        {selectedCustomTrackCredits.length === 0 ? (
          <p className="release-section-note">
            Added track artists will appear here.
          </p>
        ) : (
          selectedCustomTrackCredits.map((credit) => (
            <ReleaseTrackArtistCreditChip
              artists={artists}
              credit={credit}
              creditRoleOptions={creditRoleOptions}
              handleTrackArtistChange={handleTrackArtistChange}
              removeTrackArtist={removeTrackArtist}
              trackId={selectedDraftTrack.id}
              key={credit.id}
            />
          ))
        )}
      </div>
    </div>
  )
}

function TrackArtistComposer({
  addTrackArtist,
  handleTrackDraftArtistChange,
  selectedDraftTrack,
}: Pick<
  ReleaseTrackDetailProps,
  'addTrackArtist' | 'handleTrackDraftArtistChange' | 'selectedDraftTrack'
>) {
  return (
    <div className="track-artist-composer">
      <label>
        <span>Artist</span>
        <input
          aria-label="Track artist"
          list="release-artist-options"
          placeholder="Search or type artist"
          value={selectedDraftTrack.draftArtist}
          onChange={(event) =>
            handleTrackDraftArtistChange(
              selectedDraftTrack.id,
              event.target.value,
            )
          }
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addTrackArtist(selectedDraftTrack.id)
            }
          }}
        />
      </label>
      <button
        aria-label="Add track artist"
        className="button button-secondary button-compact"
        type="button"
        onClick={() => addTrackArtist(selectedDraftTrack.id)}
      >
        Add artist
      </button>
    </div>
  )
}
