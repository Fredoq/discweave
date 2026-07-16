import type { RatingCriterion } from '../catalog/catalogApi'
import { ratingValueFor } from '../ratings/ratingUtils'
import type { TrackStackRow } from './trackStackModel'
import type { TrackRecord } from './tracksData'

type TrackStackFactsProps = Readonly<{
  ratingCriteria: RatingCriterion[]
  stack: TrackStackRow
  track: TrackRecord
}>

export function TrackStackFacts({
  ratingCriteria,
  stack,
  track,
}: TrackStackFactsProps) {
  return (
    <div className="track-stack-facts">
      <span>{track.versionYear ?? 'No year'}</span>
      <span>{track.duration}</span>
      <span>{stack.members.length} versions</span>
      <span>{track.releaseAppearances.length} releases</span>
      {stack.hasCycleIssue ? <span>Cycle issue</span> : null}
      {ratingCriteria.map((criterion) => (
        <span key={criterion.id}>
          {criterion.name}: {ratingValueFor(track.ratings, criterion.id) ?? '-'}
        </span>
      ))}
    </div>
  )
}
