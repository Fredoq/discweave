import type { RefObject } from 'react'
import { textOrFallback } from '../manualEntry/manualEntryUtils'
import type { ArtistRecord } from '../artists/artistsData'
import type { DurationParts } from '../catalog/durationFormat'
import type { TrackRecord } from '../tracks/tracksData'
import type { ReleaseArtistCredit } from './releasesData'
import type {
  DraftTrackMode,
  DraftTrackRow,
  EditableArtistCredit,
} from './ReleaseEntryFormTypes'
import { ReleaseTrackDetail } from './ReleaseTrackDetail'

type ReleaseTracklistSectionProps = {
  addDraftTrack: () => void
  addTrackArtist: (trackId: string) => void
  artists: ArtistRecord[]
  clearExistingTrack: (trackId: string) => void
  creditRoleOptions: string[]
  draftTrackMetaSummary: (track: DraftTrackRow) => string
  draftTracks: DraftTrackRow[]
  handleDraftTrackChange: (
    trackId: string,
    field: 'title' | 'existingTrackQuery' | 'disc' | 'side' | 'versionYear',
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
  selectedDraftTrack?: DraftTrackRow
  selectedDraftTrackIndex: number
  selectedDraftTrackTitleRef: RefObject<HTMLInputElement | null>
  selectedExistingTrack?: TrackRecord
  selectedExistingTrackSuggestions: TrackRecord[]
  setDraftTrackMode: (trackId: string, trackMode: DraftTrackMode) => void
  setSelectedDraftTrackId: (trackId: string) => void
  setTrackArtistMode: (
    trackId: string,
    inheritReleaseArtistCredits: boolean,
  ) => void
}

export function ReleaseTracklistSection({
  addDraftTrack,
  addTrackArtist,
  artists,
  clearExistingTrack,
  creditRoleOptions,
  draftTrackMetaSummary,
  draftTracks,
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
  setDraftTrackMode,
  setSelectedDraftTrackId,
  setTrackArtistMode,
}: ReleaseTracklistSectionProps) {
  return (
    <section
      className="manual-entry-wide release-form-section"
      aria-labelledby="draft-track-section-title"
    >
      <div className="release-form-section-header">
        <div>
          <h3 id="draft-track-section-title">Tracklist</h3>
          <p>Rows create tracks linked to this release.</p>
        </div>
      </div>
      <div className="release-tracklist-editor">
        <div className="release-tracklist-toolbar">
          <div>
            <strong>Tracklist</strong>
            <span>
              {draftTracks.length}{' '}
              {draftTracks.length === 1 ? 'track' : 'tracks'} · selected:{' '}
              {selectedDraftTrack ? `Track ${selectedDraftTrackIndex}` : 'none'}
            </span>
          </div>
          <button
            className="button button-secondary button-compact"
            type="button"
            onClick={addDraftTrack}
          >
            + Track
          </button>
        </div>
        <div
          className={
            selectedDraftTrack
              ? 'release-tracklist-layout'
              : 'release-tracklist-layout release-tracklist-layout-empty'
          }
        >
          <DraftTrackMasterList
            addDraftTrack={addDraftTrack}
            draftTrackMetaSummary={draftTrackMetaSummary}
            draftTracks={draftTracks}
            selectedDraftTrack={selectedDraftTrack}
            setSelectedDraftTrackId={setSelectedDraftTrackId}
          />
          {selectedDraftTrack ? (
            <ReleaseTrackDetail
              addTrackArtist={addTrackArtist}
              artists={artists}
              clearExistingTrack={clearExistingTrack}
              creditRoleOptions={creditRoleOptions}
              handleDraftTrackChange={handleDraftTrackChange}
              handleDraftTrackDurationChange={handleDraftTrackDurationChange}
              handleTrackArtistChange={handleTrackArtistChange}
              handleTrackDraftArtistChange={handleTrackDraftArtistChange}
              isVariousArtists={isVariousArtists}
              releaseMainArtistCredits={releaseMainArtistCredits}
              removeDraftTrack={removeDraftTrack}
              removeTrackArtist={removeTrackArtist}
              selectExistingTrack={selectExistingTrack}
              selectedCustomTrackCredits={selectedCustomTrackCredits}
              selectedDraftTrack={selectedDraftTrack}
              selectedDraftTrackIndex={selectedDraftTrackIndex}
              selectedDraftTrackTitleRef={selectedDraftTrackTitleRef}
              selectedExistingTrack={selectedExistingTrack}
              selectedExistingTrackSuggestions={
                selectedExistingTrackSuggestions
              }
              setDraftTrackMode={setDraftTrackMode}
              setTrackArtistMode={setTrackArtistMode}
            />
          ) : null}
        </div>
      </div>
    </section>
  )
}

function DraftTrackMasterList({
  addDraftTrack,
  draftTrackMetaSummary,
  draftTracks,
  selectedDraftTrack,
  setSelectedDraftTrackId,
}: Pick<
  ReleaseTracklistSectionProps,
  | 'addDraftTrack'
  | 'draftTrackMetaSummary'
  | 'draftTracks'
  | 'selectedDraftTrack'
  | 'setSelectedDraftTrackId'
>) {
  return (
    <div
      className="release-tracklist-master"
      role="list"
      aria-label="Draft tracklist"
    >
      {draftTracks.length === 0 ? (
        <p className="draft-track-empty">No tracklist rows added.</p>
      ) : (
        draftTracks.map((track, index) => {
          const rowNumber = index + 1
          const isSelected = track.id === selectedDraftTrack?.id
          const trackTitle = textOrFallback(
            track.title.trim(),
            `Untitled track ${rowNumber}`,
          )
          const trackMeta = draftTrackMetaSummary(track)

          return (
            <button
              aria-label={`Track ${rowNumber} ${trackTitle}${
                trackMeta ? ` ${trackMeta}` : ''
              }`}
              aria-pressed={isSelected}
              className={
                isSelected
                  ? 'release-tracklist-master-row is-selected'
                  : 'release-tracklist-master-row'
              }
              key={track.id}
              type="button"
              onClick={() => setSelectedDraftTrackId(track.id)}
            >
              <span className="release-tracklist-master-number">
                {rowNumber}
              </span>
              <span className="release-tracklist-master-copy">
                <strong>{trackTitle}</strong>
                <span>{trackMeta || 'No details recorded'}</span>
              </span>
              <span className="release-tracklist-master-action">Edit</span>
            </button>
          )
        })
      )}
      {draftTracks.length > 0 ? (
        <button
          className="release-tracklist-master-add"
          type="button"
          onClick={addDraftTrack}
        >
          + Add track
        </button>
      ) : null}
    </div>
  )
}
