import { useState } from 'react'
import type { ReleaseImportDraft } from '../catalog/catalogApi'

type Props = Readonly<{
  draft: ReleaseImportDraft
  isPending: boolean
  onSelectRelease: (releaseId: string) => void
  onSelectTrack: (trackId: string) => void
}>

export function ExternalProvenanceSelectionPanel({
  draft,
  isPending,
  onSelectRelease,
  onSelectTrack,
}: Props) {
  const selection = draft.localProvenanceSelection
  const [releaseId, setReleaseId] = useState(selection?.selectedReleaseId ?? '')
  const [trackId, setTrackId] = useState(selection?.selectedTrackId ?? '')
  const releaseCandidates = [...(draft.provenanceReleaseCandidates ?? [])].sort(
    (left, right) =>
      left.title.localeCompare(right.title) || left.id.localeCompare(right.id),
  )
  const trackCandidates = [...(draft.provenanceTrackCandidates ?? [])].sort(
    (left, right) =>
      left.title.localeCompare(right.title) || left.id.localeCompare(right.id),
  )

  return (
    <section className="release-form-section imports-release-section">
      <div className="release-form-section-header">
        <div>
          <h3>Collection provenance</h3>
          <p>
            Release and Track provenance are independent choices. Use the
            collection IDs returned by the catalog search when more than one
            match exists.
          </p>
        </div>
      </div>
      <div className="imports-release-grid">
        <label className="settings-control">
          <span>Selected release ID</span>
          {releaseCandidates.length > 0 ? (
            <select
              aria-label="Selected release ID"
              value={releaseId}
              onChange={(event) => setReleaseId(event.currentTarget.value)}
            >
              <option value="">Select a release</option>
              {releaseCandidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.title}
                </option>
              ))}
            </select>
          ) : (
            <input
              aria-label="Selected release ID"
              value={releaseId}
              placeholder="UUID or leave empty"
              onChange={(event) => setReleaseId(event.currentTarget.value)}
            />
          )}
          <small>
            {selection?.selectedReleaseId ? 'Selected' : 'No release selected'}
          </small>
        </label>
        <div className="release-section-actions">
          <button
            className="button button-secondary button-compact"
            disabled={isPending || releaseId.trim() === ''}
            type="button"
            onClick={() => onSelectRelease(releaseId.trim())}
          >
            Select release provenance
          </button>
        </div>
        <label className="settings-control">
          <span>Selected track ID</span>
          {trackCandidates.length > 0 ? (
            <select
              aria-label="Selected track ID"
              value={trackId}
              onChange={(event) => setTrackId(event.currentTarget.value)}
            >
              <option value="">Select a track</option>
              {trackCandidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.title}
                </option>
              ))}
            </select>
          ) : (
            <input
              aria-label="Selected track ID"
              value={trackId}
              placeholder="UUID or leave empty"
              onChange={(event) => setTrackId(event.currentTarget.value)}
            />
          )}
          <small>
            {selection?.selectedTrackId ? 'Selected' : 'No track selected'}
          </small>
        </label>
        <div className="release-section-actions">
          <button
            className="button button-secondary button-compact"
            disabled={isPending || trackId.trim() === ''}
            type="button"
            onClick={() => onSelectTrack(trackId.trim())}
          >
            Select track provenance
          </button>
        </div>
      </div>
    </section>
  )
}
