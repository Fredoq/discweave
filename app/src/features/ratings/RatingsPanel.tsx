import { Sparkles } from 'lucide-react'
import type {
  EntityRating,
  RatingCriterion,
  RatingTargetType,
} from '../catalog/catalogApi'
import { RatingMeter, RatingMeterInput } from './RatingMeter'
import { type NamedRatingAverage, useTrackAverages } from './ratingAverages'

type RatingsPanelProps = Readonly<{
  criteria: RatingCriterion[]
  ratings?: EntityRating[]
  targetId: string
  targetType: RatingTargetType
  onDeleteRating?: (
    targetType: RatingTargetType,
    targetId: string,
    criterionId: string,
  ) => void
  onRateTarget?: (
    targetType: RatingTargetType,
    targetId: string,
    criterionId: string,
    value: number,
    standout?: boolean,
  ) => void
}>

export function RatingsPanel({
  criteria,
  ratings = [],
  targetId,
  targetType,
  onDeleteRating,
  onRateTarget,
}: RatingsPanelProps) {
  const trackAverages = useTrackAverages(targetType, targetId)
  const applicableCriteria = criteria
    .filter(
      (criterion) =>
        criterion.isActive && criterion.targetTypes.includes(targetType),
    )
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
    )

  if (applicableCriteria.length === 0 && trackAverages.length === 0) {
    return null
  }

  return (
    <section className="detail-section ratings-section" aria-label="Ratings">
      <h3>Ratings</h3>
      <div className="ratings-rubric">
        {applicableCriteria.map((criterion) => {
          const rating = ratings.find(
            (item) => item.criterionId === criterion.id,
          )
          const isStandout = rating?.standout === true

          return (
            <div className="rating-row" key={criterion.id}>
              <div className="rating-row-label">
                <strong>{criterion.name}</strong>
                <span>{rating ? `${rating.value} / 5` : 'Unrated'}</span>
              </div>
              <RatingMeterInput
                ariaLabel={`${criterion.name} rating`}
                standout={isStandout}
                value={rating?.value}
                onRate={(value, standout) =>
                  onRateTarget?.(
                    targetType,
                    targetId,
                    criterion.id,
                    value,
                    standout,
                  )
                }
              />
              {rating ? (
                <div className="rating-row-actions">
                  <button
                    aria-pressed={isStandout}
                    className="button button-secondary rating-standout-toggle"
                    disabled={rating.value !== 5}
                    title="Mark an exceptional 5 as standout"
                    type="button"
                    onClick={() =>
                      onRateTarget?.(
                        targetType,
                        targetId,
                        criterion.id,
                        rating.value,
                        !isStandout,
                      )
                    }
                  >
                    <Sparkles size={14} aria-hidden="true" />
                    Standout
                  </button>
                  <button
                    className="button button-secondary rating-clear-button"
                    type="button"
                    onClick={() =>
                      onDeleteRating?.(targetType, targetId, criterion.id)
                    }
                  >
                    Clear
                  </button>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
      <TrackAverages averages={trackAverages} targetType={targetType} />
    </section>
  )
}

/** Computed averages of track ratings for a release, label, or artist. */
export function TrackAverages({
  averages,
  targetType,
}: Readonly<{
  averages: NamedRatingAverage[]
  targetType: RatingTargetType
}>) {
  if (averages.length === 0) {
    return null
  }

  return (
    <div className="rating-averages" aria-label="Track averages">
      <h4>Track average</h4>
      <dl className="rating-average-list">
        {averages.map((average) => (
          <div className="rating-average" key={average.criterionId}>
            <dt>{average.criterionName}</dt>
            <dd>
              <RatingMeter
                computed
                label={`${average.criterionName} track average ${average.average.toFixed(2)} of 5`}
                value={average.average}
              />
              <span className="rating-average-value">
                {average.average.toFixed(2)}
              </span>
              <span className="rating-average-count">
                {average.ratedTrackCount} of {average.trackCount} tracks rated
              </span>
            </dd>
          </div>
        ))}
      </dl>
      {targetType === 'artist' ? (
        <p className="rating-average-note">
          Includes tracks credited to aliases and groups.
        </p>
      ) : null}
    </div>
  )
}

export function CompactRatingControl({
  ariaLabel,
  disabled = false,
  standout = false,
  value,
  onRate,
}: Readonly<{
  ariaLabel: string
  disabled?: boolean
  standout?: boolean
  value?: number
  onRate: (value: number, standout: boolean) => void
}>) {
  return (
    <RatingMeterInput
      ariaLabel={ariaLabel}
      compact
      disabled={disabled}
      standout={standout}
      value={value}
      onRate={onRate}
    />
  )
}

export function RatingTableValue({
  standout = false,
  value,
}: Readonly<{ standout?: boolean; value?: number }>) {
  return <RatingMeter standout={standout} value={value} />
}

export function RatingColumnSelector({
  criteria,
  selectedIds,
  storageKey,
  onChange,
}: Readonly<{
  criteria: RatingCriterion[]
  selectedIds: string[]
  storageKey: string
  onChange: (ids: string[]) => void
}>) {
  if (criteria.length === 0) {
    return null
  }

  function toggleCriterion(criterionId: string, isSelected: boolean) {
    const nextIds = isSelected
      ? [...selectedIds, criterionId]
      : selectedIds.filter((id) => id !== criterionId)

    writeRatingColumnIds(storageKey, nextIds)
    onChange(nextIds)
  }

  return (
    <fieldset className="rating-column-selector">
      <legend>Rating columns</legend>
      {criteria.map((criterion) => (
        <label key={criterion.id}>
          <input
            checked={selectedIds.includes(criterion.id)}
            type="checkbox"
            onChange={(event) =>
              toggleCriterion(criterion.id, event.target.checked)
            }
          />
          <span>{criterion.name}</span>
        </label>
      ))}
    </fieldset>
  )
}

function writeRatingColumnIds(storageKey: string, ids: string[]) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(ids))
  } catch {
    return
  }
}
