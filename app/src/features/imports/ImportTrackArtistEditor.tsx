import { type ChangeEvent, type KeyboardEvent } from 'react'
import type { ArtistRecord } from '../artists/artistsData'
import type {
  DictionaryEntry,
  EntitySuggestion,
  ReleaseImportArtistCredit,
  ReleaseImportDraftTrack,
} from '../catalog/catalogApi'
import { importArtistCreditName } from './importHelpers'
import { SuggestionRow } from './ImportSuggestionRow'
import { TrackSpecificCreditList } from './TrackSpecificCreditList'

type ImportTrackArtistEditorProps = Readonly<{
  artists: ArtistRecord[]
  canInheritReleaseMainArtists: boolean
  creditRoleOptions: DictionaryEntry[]
  draftArtist: string
  isVariousArtists: boolean
  releaseMainArtistCredits: ReleaseImportArtistCredit[]
  secondaryCreditRoleOptions: DictionaryEntry[]
  selectedTrack: ReleaseImportDraftTrack
  selectedTrackCredits: ReleaseImportArtistCredit[]
  onAddTrackArtist: (trackId: string, name?: string, artistId?: string) => void
  onDraftArtistChange: (name: string) => void
  onDraftArtistIdChange: (artistId: string) => void
  onTrackArtistCreditsChange: (
    trackId: string,
    credits: ReleaseImportArtistCredit[],
  ) => void
  onTrackPatch: (
    trackId: string,
    patch: Partial<ReleaseImportDraftTrack>,
  ) => void
}>

export function ImportTrackArtistEditor({
  artists,
  canInheritReleaseMainArtists,
  creditRoleOptions,
  draftArtist,
  isVariousArtists,
  releaseMainArtistCredits,
  secondaryCreditRoleOptions,
  selectedTrack,
  selectedTrackCredits,
  onAddTrackArtist,
  onDraftArtistChange,
  onDraftArtistIdChange,
  onTrackArtistCreditsChange,
  onTrackPatch,
}: ImportTrackArtistEditorProps) {
  function updateInheritReleaseArtists(event: ChangeEvent<HTMLInputElement>) {
    onTrackPatch(selectedTrack.id, {
      inheritReleaseArtistCredits: event.target.checked,
    })
  }

  function updateTrackSpecificCredits(
    nextCredits: ReleaseImportArtistCredit[],
  ) {
    onTrackArtistCreditsChange(selectedTrack.id, nextCredits)
  }

  function clearTrackSpecificCredits() {
    onTrackPatch(selectedTrack.id, {
      artistCredits: [],
      artistNames: [],
      selectedArtistIds: [],
    })
  }

  function addSuggestedArtist(suggestion: EntitySuggestion) {
    onAddTrackArtist(selectedTrack.id, suggestion.name, suggestion.id)
  }

  return (
    <div className="track-artist-editor imports-track-artist-editor">
      <div className="track-artist-editor-header">
        <span>Track artist credits</span>
        {canInheritReleaseMainArtists ? (
          <label className="compact-checkbox track-artist-inherit-control imports-inherit-release-artist">
            <input
              checked={Boolean(selectedTrack.inheritReleaseArtistCredits)}
              type="checkbox"
              onChange={updateInheritReleaseArtists}
            />
            <span>Inherit release main artists</span>
          </label>
        ) : null}
      </div>
      <TrackArtistInheritanceNote
        canInheritReleaseMainArtists={canInheritReleaseMainArtists}
        inheritReleaseArtistCredits={Boolean(
          selectedTrack.inheritReleaseArtistCredits,
        )}
      />
      {canInheritReleaseMainArtists ? (
        <InheritedReleaseCredits
          artists={artists}
          inheritReleaseArtistCredits={Boolean(
            selectedTrack.inheritReleaseArtistCredits,
          )}
          releaseMainArtistCredits={releaseMainArtistCredits}
        />
      ) : null}
      <div className="track-artist-custom-editor">
        <div className="track-artist-credit-group">
          <span>Track-specific credits</span>
          <div
            className="track-artist-custom-chip-list"
            aria-label="Track-specific credits"
          >
            <TrackSpecificCreditList
              artists={artists}
              creditRoleOptions={creditRoleOptions}
              credits={selectedTrackCredits}
              isVariousArtists={isVariousArtists}
              secondaryCreditRoleOptions={secondaryCreditRoleOptions}
              onChange={updateTrackSpecificCredits}
            />
          </div>
        </div>
        <TrackArtistComposer
          artists={artists}
          draftArtist={draftArtist}
          selectedTrackId={selectedTrack.id}
          onAddTrackArtist={onAddTrackArtist}
          onDraftArtistChange={onDraftArtistChange}
          onDraftArtistIdChange={onDraftArtistIdChange}
        />
        <SuggestionRow
          label="Artist matches"
          suggestions={selectedTrack.artistSuggestions}
          selectedIds={selectedTrackCredits
            .map((credit) => credit.artistId)
            .filter((artistId): artistId is string => Boolean(artistId))}
          onSelect={addSuggestedArtist}
          onClear={clearTrackSpecificCredits}
        />
      </div>
    </div>
  )
}

type TrackArtistInheritanceNoteProps = Readonly<{
  canInheritReleaseMainArtists: boolean
  inheritReleaseArtistCredits: boolean
}>

function TrackArtistInheritanceNote({
  canInheritReleaseMainArtists,
  inheritReleaseArtistCredits,
}: TrackArtistInheritanceNoteProps) {
  if (!canInheritReleaseMainArtists) {
    return (
      <p className="track-artist-editor-note">
        Various Artists releases use explicit track main artists.
      </p>
    )
  }

  return (
    <p className="track-artist-editor-note">
      {inheritReleaseArtistCredits
        ? 'Release main artists will be saved on this track.'
        : 'Only track-specific credits will be saved on this track.'}
    </p>
  )
}

type InheritedReleaseCreditsProps = Readonly<{
  artists: ArtistRecord[]
  inheritReleaseArtistCredits: boolean
  releaseMainArtistCredits: ReleaseImportArtistCredit[]
}>

function InheritedReleaseCredits({
  artists,
  inheritReleaseArtistCredits,
  releaseMainArtistCredits,
}: InheritedReleaseCreditsProps) {
  return (
    <div className="track-artist-credit-group">
      <span>Inherited from release</span>
      {inheritReleaseArtistCredits && releaseMainArtistCredits.length > 0 ? (
        <div className="track-artist-chip-list imports-inherited-artist-list">
          {releaseMainArtistCredits.map((credit) => (
            <span
              className="track-artist-readonly-credit"
              key={`${credit.artistId ?? credit.name}:${credit.role}`}
            >
              <span className="track-artist-readonly-credit-name">
                {importArtistCreditName(credit, artists)}
              </span>
              <span className="track-artist-readonly-credit-role">
                Main artist
              </span>
            </span>
          ))}
        </div>
      ) : (
        <p className="release-section-note">
          Release main artists are not inherited.
        </p>
      )}
    </div>
  )
}

type TrackArtistComposerProps = Readonly<{
  artists: ArtistRecord[]
  draftArtist: string
  selectedTrackId: string
  onAddTrackArtist: (trackId: string, name?: string, artistId?: string) => void
  onDraftArtistChange: (name: string) => void
  onDraftArtistIdChange: (artistId: string) => void
}>

function TrackArtistComposer({
  artists,
  draftArtist,
  selectedTrackId,
  onAddTrackArtist,
  onDraftArtistChange,
  onDraftArtistIdChange,
}: TrackArtistComposerProps) {
  function updateDraftArtist(event: ChangeEvent<HTMLInputElement>) {
    const nextName = event.target.value
    const existingArtist = artists.find((artist) => artist.name === nextName)

    onDraftArtistChange(nextName)
    onDraftArtistIdChange(existingArtist?.id ?? '')
  }

  function addDraftArtist() {
    onAddTrackArtist(selectedTrackId)
  }

  function addDraftArtistOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      addDraftArtist()
    }
  }

  return (
    <div className="track-artist-composer">
      <label>
        <span>Add track-specific artist</span>
        <input
          aria-label="Track-specific artist"
          placeholder="Search or type artist"
          value={draftArtist}
          onChange={updateDraftArtist}
          onKeyDown={addDraftArtistOnEnter}
        />
      </label>
      <button
        aria-label="Add track-specific credit"
        className="button button-secondary button-compact"
        type="button"
        onClick={addDraftArtist}
      >
        Add credit
      </button>
    </div>
  )
}
