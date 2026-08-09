import type { StackRelationTypeOption } from './trackStackModel'
import type { TrackRecord } from './tracksData'
import type { OriginalTrackDiscoveryController } from './useOriginalTrackDiscovery'
import { externalReleaseRouteKey } from './originalTrackDiscoveryExternalDraft'
import {
  isLocalDiscoveryCandidate,
  localCandidateForReview,
  type ExternalOriginalTrackDiscoveryCandidate,
} from './originalTrackDiscoveryPresentation'
import { confidenceLabel } from './originalTrackDiscoveryModel'
import './original-track-discovery-external.css'

type OriginalTrackDiscoveryReviewProps = Readonly<{
  controller: OriginalTrackDiscoveryController
  relationTypeOptions: readonly StackRelationTypeOption[]
  sourceTrack: TrackRecord
}>

export function OriginalTrackDiscoveryReview({
  controller,
  relationTypeOptions,
  sourceTrack,
}: OriginalTrackDiscoveryReviewProps) {
  const { selectedCandidate, state } = controller
  if (selectedCandidate === null) return null
  const localCandidate = localCandidateForReview(selectedCandidate)
  if (localCandidate === null) {
    return isLocalDiscoveryCandidate(selectedCandidate) ? null : (
      <ExternalCandidateReview
        candidate={selectedCandidate}
        controller={controller}
      />
    )
  }

  return (
    <section className="original-track-discovery-review">
      <h3 id="original-track-discovery-review-title" tabIndex={-1}>
        Review local relationship
      </h3>
      <section
        aria-label="Relationship direction"
        className="original-track-discovery-route"
      >
        <section aria-label="Source track">
          <span>Source track</span>
          <strong>{sourceTrack.title}</strong>
          <span>{sourceTrack.artist}</span>
        </section>
        <span
          aria-hidden="true"
          className="original-track-discovery-route-arrow"
        >
          →
        </span>
        <section aria-label="Target original">
          <span>Target original</span>
          <strong>{localCandidate.title}</strong>
          <span>{localCandidate.artistDisplay}</span>
          <span>
            {localCandidate.isExistingRoot
              ? existingRootLabel(localCandidate.memberCount)
              : 'Standalone local track'}
          </span>
        </section>
      </section>
      {localCandidate.requiresPromotion ? (
        <p className="original-track-discovery-promotion">
          This standalone local track will be promoted to an original when you
          confirm.
        </p>
      ) : localCandidate.isExistingRoot ? (
        <p className="original-track-discovery-root-note">
          The target is already an existing original root.
        </p>
      ) : (
        <p className="original-track-discovery-root-note">
          The standalone target is already marked as an original and will become
          the stack root.
        </p>
      )}
      {localCandidate.confidence === 'low' ? (
        <p className="original-track-discovery-low-review-warning">
          Low-confidence candidate: the evidence conflicts with the source.
          Confirm only if your manual review establishes this relationship.
        </p>
      ) : null}
      <fieldset className="original-track-discovery-relations">
        <legend>Choose relation type</legend>
        {relationTypeOptions.map((option) => (
          <label key={option.code}>
            <input
              checked={state.relationTypeCode === option.code}
              disabled={state.submitting}
              name="original-track-relation-type"
              type="radio"
              value={option.code}
              onChange={() => controller.setRelationTypeCode(option.code)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
    </section>
  )
}

function ExternalCandidateReview({
  candidate,
  controller,
}: Readonly<{
  candidate: ExternalOriginalTrackDiscoveryCandidate
  controller: OriginalTrackDiscoveryController
}>) {
  const external = candidate.externalCandidate
  if (external === null) return null

  return (
    <section className="original-track-discovery-review">
      <h3 id="original-track-discovery-review-title" tabIndex={-1}>
        Choose release
      </h3>
      <section
        aria-label="Selected original recording"
        className="original-track-discovery-external-summary"
      >
        <div>
          <span>Selected original</span>
          <strong>{candidate.title}</strong>
          <span>{candidate.artistDisplay}</span>
        </div>
        <span
          className="original-track-discovery-confidence"
          data-confidence={candidate.confidence}
        >
          {confidenceLabel(candidate.confidence)}
        </span>
      </section>
      <section
        aria-label="Release routes"
        className="original-track-discovery-release-routes"
      >
        <div className="original-track-discovery-release-routes-heading">
          <h4>Available releases</h4>
          <span>
            {external.releaseRoutes.length}{' '}
            {external.releaseRoutes.length === 1 ? 'release' : 'releases'}
          </span>
        </div>
        {external.releaseRoutes.length === 0 ? (
          <div className="original-track-discovery-release-empty">
            <strong>No release available</strong>
            <span>
              Return to the candidates and choose another original track.
            </span>
          </div>
        ) : (
          <ul>
            {external.releaseRoutes.map((route, index) => {
              const routeKey = externalReleaseRouteKey(route)
              const inputId = `original-track-release-route-${index}`
              const authority = route.discogsBinding
                ? route.discogsBinding.releaseSource
                : route.releaseSource
              return (
                <li key={routeKey}>
                  <article
                    data-selected={
                      controller.state.selectedExternalRouteKey === routeKey
                    }
                  >
                    <input
                      id={inputId}
                      checked={
                        controller.state.selectedExternalRouteKey === routeKey
                      }
                      disabled={controller.state.submitting}
                      name="original-track-release-route"
                      type="radio"
                      onChange={() =>
                        controller.setExternalReleaseRoute(routeKey)
                      }
                    />
                    <label htmlFor={inputId}>
                      <span className="original-track-discovery-release-title">
                        {route.title}
                      </span>
                      <span className="original-track-discovery-release-meta">
                        <span>{partialDateLabel(route.date)}</span>
                        <span>Medium {route.mediumPosition}</span>
                        {route.discogsBinding?.position ? (
                          <span>Track {route.discogsBinding.position}</span>
                        ) : null}
                      </span>
                    </label>
                    <div className="original-track-discovery-release-source">
                      <span>
                        {route.discogsBinding ? 'Discogs' : 'MusicBrainz'}
                      </span>
                      <a href={authority.sourceUrl}>
                        View {authority.attribution}
                      </a>
                    </div>
                  </article>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      {external.releaseRoutes.length > 1 &&
      controller.state.selectedExternalRouteKey === null ? (
        <p className="original-track-discovery-release-hint">
          Choose a release to continue
        </p>
      ) : null}
    </section>
  )
}

function partialDateLabel(
  date: NonNullable<
    ExternalOriginalTrackDiscoveryCandidate['externalCandidate']
  >['releaseRoutes'][number]['date'],
) {
  if (date === null) return 'Unknown'
  return [date.year, date.month, date.day]
    .filter((part) => part !== null)
    .map((part, index) =>
      index === 0 ? String(part) : String(part).padStart(2, '0'),
    )
    .join('-')
}

function existingRootLabel(memberCount: number) {
  return `Existing original root · ${memberCount} ${
    memberCount === 1 ? 'stack member' : 'stack members'
  }`
}
