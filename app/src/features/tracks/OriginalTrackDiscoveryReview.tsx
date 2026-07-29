import type { StackRelationTypeOption } from './trackStackModel'
import type { TrackRecord } from './tracksData'
import type { OriginalTrackDiscoveryController } from './useOriginalTrackDiscovery'
import type { OriginalCandidateEvidenceDto } from '../catalog/api/catalogDtoTypes'
import {
  isLocalDiscoveryCandidate,
  localCandidateForReview,
  type ExternalOriginalTrackDiscoveryCandidate,
} from './originalTrackDiscoveryPresentation'
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
      <ExternalCandidateReview candidate={selectedCandidate} />
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
}: Readonly<{ candidate: ExternalOriginalTrackDiscoveryCandidate }>) {
  const external = candidate.externalCandidate
  if (external === null) return null

  return (
    <section className="original-track-discovery-review">
      <h3 id="original-track-discovery-review-title" tabIndex={-1}>
        Review external evidence
      </h3>
      <section
        aria-label="External recording evidence"
        className="original-track-discovery-external-summary"
      >
        <span>Recording</span>
        <strong>{candidate.title}</strong>
        <span>{candidate.artistDisplay}</span>
        <a href={external.recordingSource.sourceUrl}>
          View {external.recordingSource.attribution} recording
        </a>
      </section>
      <section
        aria-label="Candidate evidence"
        className="original-track-discovery-external-evidence"
      >
        <h4>Candidate evidence</h4>
        <EvidenceGroup
          items={candidate.supportingEvidence}
          label="Supporting evidence"
        />
        <EvidenceGroup
          items={candidate.contradictions}
          label="Contradictions"
        />
        <EvidenceGroup
          items={candidate.missingEvidence}
          label="Missing evidence"
        />
      </section>
      <section
        aria-label="Release routes"
        className="original-track-discovery-release-routes"
      >
        <h4>Release routes</h4>
        {external.releaseRoutes.length === 0 ? (
          <p>No release routes were returned.</p>
        ) : (
          <ul>
            {external.releaseRoutes.map((route) => (
              <li
                key={[
                  route.releaseSource.externalId,
                  route.mediumPosition,
                  route.musicBrainzTrackMbid,
                ].join(':')}
              >
                <article>
                  <h5>{route.title}</h5>
                  <dl>
                    <div>
                      <dt>Release date</dt>
                      <dd>{partialDateLabel(route.date)}</dd>
                    </div>
                    <div>
                      <dt>Medium</dt>
                      <dd>{route.mediumPosition}</dd>
                    </div>
                    <div>
                      <dt>MusicBrainz Track</dt>
                      <dd>{route.musicBrainzTrackMbid}</dd>
                    </div>
                  </dl>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="original-track-discovery-external-notice">
        Release review is not available in this build
      </p>
    </section>
  )
}

function EvidenceGroup({
  items,
  label,
}: Readonly<{
  items: readonly OriginalCandidateEvidenceDto[]
  label: string
}>) {
  return (
    <section aria-label={label}>
      <h5>{label}</h5>
      {items.length === 0 ? (
        <p>None</p>
      ) : (
        <ul>
          {items.map((item, index) => (
            <li key={`${item.code}:${item.channel}:${index}`}>
              <span>{evidenceLabel(item.code)}</span>
              <span>{evidenceLabel(item.channel)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function evidenceLabel(value: string) {
  if (value === 'musicBrainz') return 'MusicBrainz'
  const words = value.replace(/([a-z])([A-Z])/g, '$1 $2')
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase()
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
