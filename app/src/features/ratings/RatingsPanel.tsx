import type {
  EntityRating,
  RatingCriterion,
  RatingTargetType,
} from '../catalog/catalogApi'

type RatingsPanelProps = {
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
  ) => void
}

const ratingValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export function RatingsPanel({
  criteria,
  ratings = [],
  targetId,
  targetType,
  onDeleteRating,
  onRateTarget,
}: RatingsPanelProps) {
  const applicableCriteria = criteria
    .filter(
      (criterion) =>
        criterion.isActive && criterion.targetTypes.includes(targetType),
    )
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
    )

  if (applicableCriteria.length === 0) {
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

          return (
            <div className="rating-row" key={criterion.id}>
              <div className="rating-row-label">
                <strong>{criterion.name}</strong>
                <span>{rating ? `${rating.value}/10` : 'Unrated'}</span>
              </div>
              <div
                className="rating-segmented-control"
                role="group"
                aria-label={`${criterion.name} rating`}
              >
                {ratingValues.map((value) => (
                  <button
                    aria-pressed={rating?.value === value}
                    className={
                      rating?.value === value
                        ? 'rating-segment is-selected'
                        : 'rating-segment'
                    }
                    key={value}
                    type="button"
                    onClick={() =>
                      onRateTarget?.(targetType, targetId, criterion.id, value)
                    }
                  >
                    {value}
                  </button>
                ))}
              </div>
              {rating ? (
                <button
                  className="button button-secondary rating-clear-button"
                  type="button"
                  onClick={() =>
                    onDeleteRating?.(targetType, targetId, criterion.id)
                  }
                >
                  Clear
                </button>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function CompactRatingControl({
  ariaLabel,
  disabled = false,
  value,
  onRate,
}: {
  ariaLabel: string
  disabled?: boolean
  value?: number
  onRate: (value: number) => void
}) {
  return (
    <div className="compact-rating-control" role="group" aria-label={ariaLabel}>
      {ratingValues.map((ratingValue) => (
        <button
          aria-pressed={value === ratingValue}
          className={
            value === ratingValue
              ? 'compact-rating-segment is-selected'
              : 'compact-rating-segment'
          }
          disabled={disabled}
          key={ratingValue}
          type="button"
          onClick={() => onRate(ratingValue)}
        >
          {ratingValue}
        </button>
      ))}
    </div>
  )
}

export function RatingTableValue({ value }: { value?: number }) {
  return value !== undefined ? (
    <span className="rating-table-value">{value}</span>
  ) : (
    <span className="rating-table-empty">-</span>
  )
}

export function RatingColumnSelector({
  criteria,
  selectedIds,
  storageKey,
  onChange,
}: {
  criteria: RatingCriterion[]
  selectedIds: string[]
  storageKey: string
  onChange: (ids: string[]) => void
}) {
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
