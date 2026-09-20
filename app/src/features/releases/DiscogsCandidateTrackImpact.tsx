import { useState } from 'react'
import type {
  CatalogDictionaries,
  ExternalMetadataReleaseDraftTrackDto,
} from '../catalog/catalogApi'
import {
  discogsRoleLabelFromCode,
  groupDiscogsReviewCredits,
  type GroupedDiscogsReviewCredit,
} from './discogsRoleUtils'

export function DiscogsCandidateTrackImpact({
  dictionaries,
  tracks,
  trackImpactAction,
}: Readonly<{
  dictionaries: CatalogDictionaries
  tracks: ExternalMetadataReleaseDraftTrackDto[]
  trackImpactAction: string
}>) {
  const [showAllTracks, setShowAllTracks] = useState(false)
  const previewTracks = showAllTracks ? tracks : tracks.slice(0, 4)
  const hiddenCount = tracks.length - previewTracks.length
  const showMoreButton = hiddenCount > 0
  const showFewerButton = !showMoreButton && showAllTracks && tracks.length > 4

  if (tracks.length === 0) {
    return <p className="discogs-impact-empty">No Discogs track rows.</p>
  }

  return (
    <div className="discogs-track-impact-list">
      {previewTracks.map((track, index) => {
        const trackContext = discogsTrackContext(track)
        const trackKey = `${track.disc ?? ''}-${track.side ?? ''}-${track.position}-${track.title}-${index}`

        return (
          <div className="discogs-track-impact-row" key={trackKey}>
            <span className="discogs-track-impact-position">
              {track.position}
            </span>
            <div>
              <strong>{track.title}</strong>
              <p>
                {[trackContext, trackDurationLabel(track), trackImpactAction]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {track.artistCredits.length > 0 ? (
                <div className="discogs-credit-impact-list">
                  {groupDiscogsReviewCredits(track.artistCredits).map(
                    (credit) => (
                      <DiscogsCreditImpactRow
                        credit={credit}
                        dictionaries={dictionaries}
                        key={`${trackKey}-${credit.name}`}
                      />
                    ),
                  )}
                </div>
              ) : (
                <p className="discogs-impact-empty">
                  Inherits release artists.
                </p>
              )}
            </div>
          </div>
        )
      })}
      {showMoreButton ? (
        <button
          className="button button-secondary button-compact discogs-track-toggle"
          type="button"
          aria-expanded={showAllTracks}
          onClick={() => setShowAllTracks(true)}
        >
          Show {hiddenCount} more Discogs track row
          {hiddenCount === 1 ? '' : 's'}
        </button>
      ) : showFewerButton ? (
        <button
          className="button button-secondary button-compact discogs-track-toggle"
          type="button"
          aria-expanded={showAllTracks}
          onClick={() => setShowAllTracks(false)}
        >
          Show fewer Discogs track rows
        </button>
      ) : null}
    </div>
  )
}

export function DiscogsCreditImpactRow({
  credit,
  dictionaries,
}: Readonly<{
  credit: GroupedDiscogsReviewCredit
  dictionaries: CatalogDictionaries
}>) {
  return (
    <div className="discogs-credit-impact-row">
      <strong>{credit.name}</strong>
      <span className="discogs-credit-role-list">
        {credit.roles.map((role) => (
          <span className="badge badge-credit" key={role}>
            {discogsRoleLabelFromCode(role, dictionaries)}
          </span>
        ))}
      </span>
    </div>
  )
}

function discogsTrackContext(track: ExternalMetadataReleaseDraftTrackDto) {
  return [
    track.disc?.trim(),
    track.side?.trim() ? `Side ${track.side.trim()}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

function trackDurationLabel(track: ExternalMetadataReleaseDraftTrackDto) {
  return track.durationSeconds
    ? formatDurationSeconds(track.durationSeconds)
    : 'No duration'
}

function formatDurationSeconds(durationSeconds: number) {
  const minutes = Math.floor(durationSeconds / 60)
  const seconds = durationSeconds % 60

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
