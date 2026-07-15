import { ExternalLink, LoaderCircle } from 'lucide-react'
import type { RatingCriterion, RatingTargetType } from '../catalog/catalogApi'
import { openableFilesFromReleaseTracks } from '../localFiles/localFileOpenModel'
import { CompactRatingControl } from '../ratings/RatingsPanel'
import { ratingValueFor } from '../ratings/ratingUtils'
import type { TrackRecord } from '../tracks/tracksData'
import type { ReleaseRecord } from './releasesData'
import { releaseTrackPositionLabel } from './releaseFormHelpers'

export type OpenReleaseTrackLocalFiles = (
  track: TrackRecord,
  release: ReleaseRecord,
) => Promise<void> | void

type ReleaseDetailTracksSectionProps = Readonly<{
  openingTrackId?: string
  onOpenTrackLocalFiles?: OpenReleaseTrackLocalFiles
  onRateTarget?: (
    targetType: RatingTargetType,
    targetId: string,
    criterionId: string,
    value: number,
  ) => void
  ratingCriteria: RatingCriterion[]
  release: ReleaseRecord
  tracks: TrackRecord[]
}>

export function ReleaseDetailTracksSection({
  openingTrackId,
  onOpenTrackLocalFiles,
  onRateTarget,
  ratingCriteria,
  release,
  tracks,
}: ReleaseDetailTracksSectionProps) {
  const trackRatingCriteria = ratingCriteria
    .filter(
      (criterion) =>
        criterion.isActive && criterion.targetTypes.includes('track'),
    )
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
    )

  return (
    <section className="detail-section" aria-labelledby="release-tracks-title">
      <h3 id="release-tracks-title">Tracks</h3>
      {tracks.length > 0 ? (
        <div className="relation-list">
          <p>
            {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
          </p>
          {tracks.map((track) => {
            const canOpenLocalFile = Boolean(
              onOpenTrackLocalFiles &&
              openableFilesFromReleaseTracks([track], release.id).length > 0,
            )

            return (
              <ReleaseDetailTrackCard
                canOpenLocalFile={canOpenLocalFile}
                isOpenDisabled={Boolean(openingTrackId)}
                isOpening={openingTrackId === track.id}
                key={track.id}
                onOpenTrackLocalFiles={onOpenTrackLocalFiles}
                onRateTarget={onRateTarget}
                ratingCriteria={trackRatingCriteria}
                release={release}
                track={track}
              />
            )
          })}
        </div>
      ) : (
        <p>No tracks linked yet.</p>
      )}
    </section>
  )
}

function ReleaseDetailTrackCard({
  canOpenLocalFile,
  isOpenDisabled,
  isOpening,
  onOpenTrackLocalFiles,
  onRateTarget,
  ratingCriteria,
  release,
  track,
}: Readonly<{
  canOpenLocalFile: boolean
  isOpenDisabled: boolean
  isOpening: boolean
  onOpenTrackLocalFiles?: OpenReleaseTrackLocalFiles
  onRateTarget?: ReleaseDetailTracksSectionProps['onRateTarget']
  ratingCriteria: RatingCriterion[]
  release: ReleaseRecord
  track: TrackRecord
}>) {
  const positionLabel = releaseTrackPositionLabel(track, release)

  return (
    <article className="release-track-card">
      <div
        className={`release-track-card-main${
          canOpenLocalFile ? ' has-open-action' : ''
        }`}
      >
        <a className="detail-link" href={trackHref(track.id)}>
          {track.title}
        </a>
        <p>
          {positionLabel} · {track.artist} · {track.duration}
        </p>
        {canOpenLocalFile ? (
          <button
            aria-busy={isOpening || undefined}
            aria-label={`Open ${track.title} in default player`}
            className="release-track-open-button"
            disabled={isOpenDisabled}
            title="Open in default player"
            type="button"
            onClick={() => {
              void onOpenTrackLocalFiles?.(track, release)
            }}
          >
            {isOpening ? (
              <LoaderCircle
                aria-hidden="true"
                className="release-track-open-spinner"
                size={14}
              />
            ) : (
              <ExternalLink aria-hidden="true" size={14} />
            )}
          </button>
        ) : null}
      </div>
      {ratingCriteria.length > 0 ? (
        <div
          className="release-track-rating-list"
          aria-label={`Ratings for ${track.title}`}
        >
          {ratingCriteria.map((criterion) => {
            const ratingValue = ratingValueFor(track.ratings, criterion.id)

            return (
              <div className="release-track-rating-row" key={criterion.id}>
                <div className="release-track-rating-label">
                  <span>{criterion.name}</span>
                  <strong>
                    {ratingValue ? `${ratingValue}/10` : 'Unrated'}
                  </strong>
                </div>
                <CompactRatingControl
                  ariaLabel={`${criterion.name} rating for ${track.title}`}
                  disabled={!onRateTarget}
                  value={ratingValue}
                  onRate={(value) =>
                    onRateTarget?.('track', track.id, criterion.id, value)
                  }
                />
              </div>
            )
          })}
        </div>
      ) : null}
    </article>
  )
}

function trackHref(trackId: string) {
  return `/tracks?track=${encodeURIComponent(trackId)}`
}
