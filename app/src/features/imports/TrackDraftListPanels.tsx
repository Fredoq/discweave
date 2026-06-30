import type { ChangeEvent } from 'react'
import type { ArtistRecord } from '../artists/artistsData'
import type {
  DictionaryEntry,
  ReleaseImportArtistCredit,
  ReleaseImportDraftTrack,
  ReleaseImportFileMoveHint,
  ReleaseImportTrackMode,
} from '../catalog/catalogApi'
import {
  effectiveTrackArtistCredits,
  importArtistCreditName,
} from './importHelpers'
import { ImportTrackArtistEditor } from './ImportTrackArtistEditor'
import { SuggestionRow } from './ImportSuggestionRow'

type FileMoveHintNoteProps = Readonly<{
  hint: ReleaseImportFileMoveHint
}>

type TrackYearDraft = {
  trackId: string
  value: string
}

type TrackDraftMasterListProps = Readonly<{
  artists: ArtistRecord[]
  selectedTrackId: string
  tracks: ReleaseImportDraftTrack[]
  onSelectTrack: (trackId: string) => void
}>

export function TrackDraftMasterList({
  artists,
  selectedTrackId,
  tracks,
  onSelectTrack,
}: TrackDraftMasterListProps) {
  return (
    <div className="release-tracklist-master imports-tracklist-master">
      {tracks.map((track, index) => (
        <TrackDraftMasterRow
          artists={artists}
          index={index}
          isSelected={track.id === selectedTrackId}
          key={track.id}
          track={track}
          onSelectTrack={onSelectTrack}
        />
      ))}
    </div>
  )
}

type TrackDraftMasterRowProps = Readonly<{
  artists: ArtistRecord[]
  index: number
  isSelected: boolean
  track: ReleaseImportDraftTrack
  onSelectTrack: (trackId: string) => void
}>

function TrackDraftMasterRow({
  artists,
  index,
  isSelected,
  track,
  onSelectTrack,
}: TrackDraftMasterRowProps) {
  function selectTrack() {
    onSelectTrack(track.id)
  }

  return (
    <button
      className={masterRowClassName(isSelected)}
      type="button"
      onClick={selectTrack}
    >
      <span className="release-tracklist-master-number">
        {track.position ?? index + 1}
      </span>
      <span className="release-tracklist-master-copy">
        <strong>{track.title || `Untitled track ${index + 1}`}</strong>
        <span>{trackMasterSummary(track, artists)}</span>
      </span>
      <span className="release-tracklist-master-action">
        {trackReviewState(track)}
      </span>
    </button>
  )
}

type TrackDraftDetailPanelProps = Readonly<{
  artists: ArtistRecord[]
  canInheritReleaseMainArtists: boolean
  creditRoleOptions: DictionaryEntry[]
  defaultTrackMode: () => ReleaseImportTrackMode
  draftArtist: string
  isVariousArtists: boolean
  releaseMainArtistCredits: ReleaseImportArtistCredit[]
  secondaryCreditRoleOptions: DictionaryEntry[]
  selectedTrack: ReleaseImportDraftTrack
  selectedTrackCredits: ReleaseImportArtistCredit[]
  selectedTrackIndex: number
  selectedTrackMode: ReleaseImportTrackMode
  selectedTrackVersionYear?: number | null
  selectedTrackYearInputValue: string
  onAddTrackArtist: (trackId: string, name?: string, artistId?: string) => void
  onDraftArtistChange: (name: string) => void
  onDraftArtistIdChange: (artistId: string) => void
  onTrackArtistCreditsChange: (
    trackId: string,
    credits: ReleaseImportArtistCredit[],
  ) => void
  onTrackModeChange: (
    trackId: string,
    trackMode: ReleaseImportTrackMode,
  ) => void
  onTrackPatch: (
    trackId: string,
    patch: Partial<ReleaseImportDraftTrack>,
  ) => void
  onTrackYearDraftChange: (draft: TrackYearDraft | null) => void
}>

export function TrackDraftDetailPanel({
  artists,
  canInheritReleaseMainArtists,
  creditRoleOptions,
  defaultTrackMode,
  draftArtist,
  isVariousArtists,
  releaseMainArtistCredits,
  secondaryCreditRoleOptions,
  selectedTrack,
  selectedTrackCredits,
  selectedTrackIndex,
  selectedTrackMode,
  selectedTrackVersionYear,
  selectedTrackYearInputValue,
  onAddTrackArtist,
  onDraftArtistChange,
  onDraftArtistIdChange,
  onTrackArtistCreditsChange,
  onTrackModeChange,
  onTrackPatch,
  onTrackYearDraftChange,
}: TrackDraftDetailPanelProps) {
  const selectedTrackMatch = selectedTrack.selectedTrackId
    ? selectedTrack.trackSuggestions.find(
        (suggestion) => suggestion.id === selectedTrack.selectedTrackId,
      )
    : null
  const usesCatalogTrack = selectedTrackMode !== 'releaseOnly'

  return (
    <div className="release-tracklist-detail imports-tracklist-detail">
      <TrackDraftDetailHeader
        selectedTrack={selectedTrack}
        selectedTrackIndex={selectedTrackIndex}
        onTrackPatch={onTrackPatch}
      />
      <TrackModeControl
        selectedTrack={selectedTrack}
        selectedTrackMode={selectedTrackMode}
        onTrackModeChange={onTrackModeChange}
      />
      {selectedTrackMatch || selectedTrack.selectedTrackId ? (
        <output className="imports-match-note">
          Existing track selected:{' '}
          {selectedTrackMatch?.name ?? selectedTrack.selectedTrackId}
        </output>
      ) : null}
      {selectedTrack.moveHint ? (
        <FileMoveHintNote hint={selectedTrack.moveHint} />
      ) : null}
      <TrackDraftIssues selectedTrack={selectedTrack} />
      <TrackDraftMetadataFields
        selectedTrack={selectedTrack}
        selectedTrackMode={selectedTrackMode}
        selectedTrackVersionYear={selectedTrackVersionYear}
        selectedTrackYearInputValue={selectedTrackYearInputValue}
        onTrackPatch={onTrackPatch}
        onTrackYearDraftChange={onTrackYearDraftChange}
      />
      {usesCatalogTrack ? (
        <SuggestionRow
          label="Existing track matches"
          suggestions={selectedTrack.trackSuggestions}
          selectedIds={
            selectedTrack.selectedTrackId ? [selectedTrack.selectedTrackId] : []
          }
          onSelect={(suggestion) => {
            onTrackPatch(selectedTrack.id, {
              selectedTrackId: suggestion.id,
              trackMode: 'link',
            })
          }}
          onClear={() =>
            onTrackPatch(selectedTrack.id, {
              selectedTrackId: null,
              trackMode: defaultTrackMode(),
            })
          }
        />
      ) : null}
      {usesCatalogTrack ? (
        <ImportTrackArtistEditor
          artists={artists}
          canInheritReleaseMainArtists={canInheritReleaseMainArtists}
          creditRoleOptions={creditRoleOptions}
          draftArtist={draftArtist}
          isVariousArtists={isVariousArtists}
          releaseMainArtistCredits={releaseMainArtistCredits}
          secondaryCreditRoleOptions={secondaryCreditRoleOptions}
          selectedTrack={selectedTrack}
          selectedTrackCredits={selectedTrackCredits}
          onAddTrackArtist={onAddTrackArtist}
          onDraftArtistChange={onDraftArtistChange}
          onDraftArtistIdChange={onDraftArtistIdChange}
          onTrackArtistCreditsChange={onTrackArtistCreditsChange}
          onTrackPatch={onTrackPatch}
        />
      ) : null}
    </div>
  )
}

type TrackDraftDetailHeaderProps = Readonly<{
  selectedTrack: ReleaseImportDraftTrack
  selectedTrackIndex: number
  onTrackPatch: (
    trackId: string,
    patch: Partial<ReleaseImportDraftTrack>,
  ) => void
}>

function TrackDraftDetailHeader({
  selectedTrack,
  selectedTrackIndex,
  onTrackPatch,
}: TrackDraftDetailHeaderProps) {
  function updateSkipped(event: ChangeEvent<HTMLInputElement>) {
    onTrackPatch(selectedTrack.id, { isSkipped: event.target.checked })
  }

  return (
    <div className="release-tracklist-detail-header">
      <div>
        <h4>Track {selectedTrackIndex + 1} details</h4>
        <p>{selectedTrack.relativePath}</p>
      </div>
      <label className="compact-checkbox">
        <input
          checked={selectedTrack.isSkipped}
          type="checkbox"
          onChange={updateSkipped}
        />
        <span>Skip track</span>
      </label>
    </div>
  )
}

type TrackModeControlProps = Readonly<{
  selectedTrack: ReleaseImportDraftTrack
  selectedTrackMode: ReleaseImportTrackMode
  onTrackModeChange: (
    trackId: string,
    trackMode: ReleaseImportTrackMode,
  ) => void
}>

function TrackModeControl({
  selectedTrack,
  selectedTrackMode,
  onTrackModeChange,
}: TrackModeControlProps) {
  function updateTrackMode(event: ChangeEvent<HTMLSelectElement>) {
    onTrackModeChange(
      selectedTrack.id,
      event.target.value as ReleaseImportTrackMode,
    )
  }

  return (
    <label className="settings-control imports-track-mode-control">
      <span>Track mode</span>
      <select value={selectedTrackMode} onChange={updateTrackMode}>
        <option value="create">Create Track</option>
        <option value="releaseOnly">Release-only row</option>
        <option disabled={!selectedTrack.selectedTrackId} value="link">
          Link existing Track
        </option>
      </select>
    </label>
  )
}

type TrackDraftIssuesProps = Readonly<{
  selectedTrack: ReleaseImportDraftTrack
}>

function TrackDraftIssues({ selectedTrack }: TrackDraftIssuesProps) {
  if (selectedTrack.issues.length === 0) {
    return null
  }

  return (
    <output className="imports-issue-list">
      {selectedTrack.issues.map((issue, index) => (
        <span
          className="imports-issue-item"
          key={`${issue.code}:${issue.message}:${index}`}
        >
          <strong>{issue.severity}</strong> {issue.message}
        </span>
      ))}
    </output>
  )
}

type TrackDraftMetadataFieldsProps = Readonly<{
  selectedTrack: ReleaseImportDraftTrack
  selectedTrackMode: ReleaseImportTrackMode
  selectedTrackVersionYear?: number | null
  selectedTrackYearInputValue: string
  onTrackPatch: (
    trackId: string,
    patch: Partial<ReleaseImportDraftTrack>,
  ) => void
  onTrackYearDraftChange: (draft: TrackYearDraft | null) => void
}>

function TrackDraftMetadataFields({
  selectedTrack,
  selectedTrackMode,
  selectedTrackVersionYear,
  selectedTrackYearInputValue,
  onTrackPatch,
  onTrackYearDraftChange,
}: TrackDraftMetadataFieldsProps) {
  function updatePosition(event: ChangeEvent<HTMLInputElement>) {
    onTrackPatch(selectedTrack.id, {
      position: Number.parseInt(event.target.value, 10) || null,
    })
  }

  function updateDisc(event: ChangeEvent<HTMLInputElement>) {
    onTrackPatch(selectedTrack.id, { disc: event.target.value })
  }

  function updateSide(event: ChangeEvent<HTMLInputElement>) {
    onTrackPatch(selectedTrack.id, { side: event.target.value })
  }

  function updateTitle(event: ChangeEvent<HTMLInputElement>) {
    onTrackPatch(selectedTrack.id, { title: event.target.value })
  }

  function focusYear() {
    onTrackYearDraftChange({
      trackId: selectedTrack.id,
      value: selectedTrackVersionYear?.toString() ?? '',
    })
  }

  function clearYearDraft() {
    onTrackYearDraftChange(null)
  }

  function updateYear(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = event.target.value.replace(/\D/g, '').slice(0, 4)
    onTrackYearDraftChange({
      trackId: selectedTrack.id,
      value: nextValue,
    })
    onTrackPatch(selectedTrack.id, {
      versionYear: Number.parseInt(nextValue, 10) || null,
    })
  }

  return (
    <div className="imports-track-detail-grid">
      <label className="settings-control imports-position-field">
        <span>No.</span>
        <input value={selectedTrack.position ?? ''} onChange={updatePosition} />
      </label>
      <label className="settings-control">
        <span>Disc</span>
        <input
          aria-label="Disc"
          value={selectedTrack.disc ?? ''}
          onChange={updateDisc}
        />
      </label>
      <label className="settings-control">
        <span>Side</span>
        <input
          aria-label="Side"
          value={selectedTrack.side ?? ''}
          onChange={updateSide}
        />
      </label>
      {selectedTrackMode === 'create' ? (
        <label className="settings-control imports-track-year-field">
          <span>Track year</span>
          <input
            aria-label="Track year"
            inputMode="numeric"
            maxLength={4}
            value={selectedTrackYearInputValue}
            onBlur={clearYearDraft}
            onChange={updateYear}
            onFocus={focusYear}
          />
        </label>
      ) : null}
      <label className="settings-control release-track-title-field">
        <span>Track title</span>
        <input value={selectedTrack.title} onChange={updateTitle} />
      </label>
    </div>
  )
}

function masterRowClassName(isSelected: boolean) {
  return isSelected
    ? 'release-tracklist-master-row is-selected'
    : 'release-tracklist-master-row'
}

function trackMasterSummary(
  track: ReleaseImportDraftTrack,
  artists: ArtistRecord[],
) {
  const positionContext = [track.disc, track.side ? `Side ${track.side}` : '']
    .filter(Boolean)
    .join(' · ')

  return (
    positionContext ||
    effectiveTrackArtistCredits(track)
      .map((credit) => importArtistCreditName(credit, artists))
      .filter(Boolean)
      .join(', ') ||
    track.relativePath
  )
}

function trackReviewState(track: ReleaseImportDraftTrack) {
  if (track.isSkipped) {
    return 'Skipped'
  }

  if (track.selectedTrackId) {
    return 'Matched'
  }

  if (track.trackMode === 'releaseOnly') {
    return 'Release-only'
  }

  if ((track.trackMode ?? 'create') === 'create') {
    return 'New Track'
  }

  return track.issues.length > 0 ? 'Review' : 'Edit'
}

function FileMoveHintNote({ hint }: FileMoveHintNoteProps) {
  return (
    <output className="imports-move-note">
      <strong>Moved or renamed file hint:</strong>{' '}
      {hint.previousPath
        ? `previously at ${hint.previousPath}`
        : 'multiple previous paths match this file'}{' '}
      ({moveHintMatchLabel(hint.matchKind)}, {hint.confidence} confidence)
    </output>
  )
}

function moveHintMatchLabel(matchKind: string) {
  if (matchKind === 'contentHash') {
    return 'same content hash'
  }

  if (matchKind === 'scanManifestIdentity') {
    return 'same scan manifest identity'
  }

  if (matchKind === 'sizeMtime') {
    return 'same size and modified time'
  }

  return matchKind
}
