import type { StackRelationTypeOption } from './trackStackModel'
import type { TrackRecord } from './tracksData'
import type { OriginalTrackDiscoveryController } from './useOriginalTrackDiscovery'

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
          <strong>{selectedCandidate.title}</strong>
          <span>{selectedCandidate.artistDisplay}</span>
          <span>
            {selectedCandidate.isExistingRoot
              ? existingRootLabel(selectedCandidate.memberCount)
              : 'Standalone local track'}
          </span>
        </section>
      </section>
      {selectedCandidate.requiresPromotion ? (
        <p className="original-track-discovery-promotion">
          This standalone local track will be promoted to an original when you
          confirm.
        </p>
      ) : (
        <p className="original-track-discovery-root-note">
          The target is already an existing original root.
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

function existingRootLabel(memberCount: number) {
  return `Existing original root · ${memberCount} ${
    memberCount === 1 ? 'stack member' : 'stack members'
  }`
}
