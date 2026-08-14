import type { TrackRecord } from '../tracks/tracksData'

export function ReleaseTrackExistingTrackPicker({
  clearExistingTrack,
  selectedDraftTrackId,
  selectedExistingTrack,
  selectedExistingTrackSuggestions,
  selectExistingTrack,
}: Readonly<{
  clearExistingTrack: (trackId: string) => void
  selectedDraftTrackId: string
  selectedExistingTrack?: TrackRecord
  selectedExistingTrackSuggestions: TrackRecord[]
  selectExistingTrack: (trackId: string, linkedTrack: TrackRecord) => void
}>) {
  if (selectedExistingTrack) {
    return (
      <div className="existing-track-summary">
        <span className="badge badge-tag">Linked to existing track</span>
        <strong>{selectedExistingTrack.title}</strong>
        <span>
          {trackCreditsSummary(selectedExistingTrack.credits) ||
            selectedExistingTrack.artist}{' '}
          · {selectedExistingTrack.duration}
        </span>
        <button
          className="button button-secondary button-compact"
          type="button"
          onClick={() => clearExistingTrack(selectedDraftTrackId)}
        >
          Clear linked track
        </button>
      </div>
    )
  }

  if (selectedExistingTrackSuggestions.length > 0) {
    return (
      <div
        className="existing-track-results"
        aria-label="Existing track suggestions"
      >
        {selectedExistingTrackSuggestions.map((track) => (
          <button
            key={track.id}
            type="button"
            aria-label={`Use existing track ${track.title}`}
            onClick={() => selectExistingTrack(selectedDraftTrackId, track)}
          >
            <strong>{track.title}</strong>
            <span>
              {track.artist} · {track.release.title}
            </span>
          </button>
        ))}
      </div>
    )
  }

  return <p className="release-section-note">No matching existing tracks.</p>
}

function trackCreditsSummary(credits: TrackRecord['credits']) {
  return credits.map(trackCreditSummary).filter(Boolean).join(', ')
}

function trackCreditSummary(credit: TrackRecord['credits'][number]) {
  const roles = creditRolesSummary(credit)
  return roles ? `${credit.artist} (${roles})` : credit.artist
}

function creditRolesSummary(credit: TrackRecord['credits'][number]) {
  return (credit.roles?.length ? credit.roles : [credit.role])
    .filter(Boolean)
    .join(', ')
}
