import { Plus, Save, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type {
  RatingCriterion,
  RatingCriterionRequest,
  RatingCriterionUpdateRequest,
  RatingTargetType,
} from '../catalog/catalogApi'
import {
  parseSortOrder,
  ratingTargetTypeLabel,
  ratingTargetTypes,
  type SettingsMode,
} from './settingsModel'
import { SearchField, ViewModeSwitch } from './settingsShared'

export function RatingCriteriaSettings({
  criteria,
  onCreateRatingCriterion,
  onDeleteRatingCriterion,
  onModeChange,
  onUpdateRatingCriterion,
}: {
  criteria: RatingCriterion[]
  onCreateRatingCriterion?: (criterion: RatingCriterionRequest) => void
  onDeleteRatingCriterion?: (criterion: RatingCriterion) => void
  onModeChange: (mode: SettingsMode) => void
  onUpdateRatingCriterion?: (
    criterionId: string,
    criterion: RatingCriterionUpdateRequest,
  ) => void
}) {
  const [query, setQuery] = useState('')
  const [selectedCriterionId, setSelectedCriterionId] = useState('')
  const queryTerms = useMemo(
    () => query.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [query],
  )
  const sortedCriteria = useMemo(
    () =>
      criteria
        .filter((criterion) => {
          const searchText = ratingCriterionSearchText(criterion)

          return queryTerms.every((term) => searchText.includes(term))
        })
        .sort(
          (left, right) =>
            left.sortOrder - right.sortOrder ||
            left.name.localeCompare(right.name),
        ),
    [criteria, queryTerms],
  )
  const selectedCriterion =
    sortedCriteria.find((criterion) => criterion.id === selectedCriterionId) ??
    sortedCriteria[0] ??
    null

  return (
    <section className="catalog-layout" aria-label="Rating criteria settings">
      <div className="catalog-main">
        <SearchField
          placeholder="Criterion name, code, target type or status"
          query={query}
          onQueryChange={setQuery}
        />
        <div className="settings-mode-row">
          <ViewModeSwitch mode="ratings" onModeChange={onModeChange} />
        </div>
        <RatingCriteriaContextPanel count={sortedCriteria.length} />
        <RatingCriterionCreatePanel
          onCreateRatingCriterion={onCreateRatingCriterion}
        />
        <section
          className="panel catalog-panel"
          aria-labelledby="rating-criteria-title"
        >
          <div className="panel-heading">
            <div>
              <h2 id="rating-criteria-title">Rating criteria</h2>
              <p>Criteria define which catalog entities can be rated.</p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="catalog-table workspace-table">
              <thead>
                <tr>
                  <th scope="col">Criterion</th>
                  <th scope="col">Targets</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedCriteria.map((criterion) => (
                  <tr
                    aria-selected={criterion.id === selectedCriterion?.id}
                    className={
                      criterion.id === selectedCriterion?.id
                        ? 'is-selected'
                        : undefined
                    }
                    key={criterion.id}
                  >
                    <th scope="row">
                      <button
                        className="row-title"
                        type="button"
                        onClick={() => setSelectedCriterionId(criterion.id)}
                      >
                        <strong>{criterion.name}</strong>
                        <span>{criterion.code}</span>
                      </button>
                    </th>
                    <td data-label="Targets">
                      {criterion.targetTypes
                        .map(ratingTargetTypeLabel)
                        .join(', ')}
                    </td>
                    <td data-label="Status">
                      {criterion.isActive ? 'Active' : 'Inactive'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      {selectedCriterion ? (
        <RatingCriterionDetail
          criterion={selectedCriterion}
          key={selectedCriterion.id}
          onDeleteRatingCriterion={onDeleteRatingCriterion}
          onUpdateRatingCriterion={onUpdateRatingCriterion}
        />
      ) : (
        <EmptyRatingCriterionPanel />
      )}
    </section>
  )
}

function RatingCriteriaContextPanel({ count }: { count: number }) {
  return (
    <section
      className="panel settings-context-panel"
      aria-label="Rating criteria scope"
    >
      <div className="settings-context-copy">
        <span className="entity-type">Rating criteria</span>
        <strong>Criteria editor</strong>
        <p>{count} criteria shown for this collection.</p>
      </div>
    </section>
  )
}

function RatingCriterionCreatePanel({
  onCreateRatingCriterion,
}: {
  onCreateRatingCriterion?: (criterion: RatingCriterionRequest) => void
}) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [sortOrder, setSortOrder] = useState('100')
  const [targetTypes, setTargetTypes] = useState<RatingTargetType[]>(['track'])
  const canSubmit = code.trim().length > 0 && name.trim().length > 0

  function handleSubmit() {
    if (!canSubmit) {
      return
    }

    onCreateRatingCriterion?.({
      code: code.trim(),
      name: name.trim(),
      targetTypes,
      sortOrder: parseSortOrder(sortOrder, 100),
      isActive: true,
    })
    setCode('')
    setName('')
    setSortOrder('100')
    setTargetTypes(['track'])
  }

  return (
    <section
      className="panel settings-controls settings-controls-rating"
      aria-label="Add rating criterion"
    >
      <div className="settings-control-grid">
        <label className="settings-control">
          <span>Code</span>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
        <label className="settings-control">
          <span>Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="settings-control">
          <span>Order</span>
          <input
            inputMode="numeric"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          />
        </label>
        <RatingTargetCheckboxes
          targetTypes={targetTypes}
          onTargetTypesChange={setTargetTypes}
        />
        <button
          className="button button-primary"
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          <Plus size={16} aria-hidden="true" />
          Add
        </button>
      </div>
    </section>
  )
}

function RatingCriterionDetail({
  criterion,
  onDeleteRatingCriterion,
  onUpdateRatingCriterion,
}: {
  criterion: RatingCriterion
  onDeleteRatingCriterion?: (criterion: RatingCriterion) => void
  onUpdateRatingCriterion?: (
    criterionId: string,
    criterion: RatingCriterionUpdateRequest,
  ) => void
}) {
  const [name, setName] = useState(criterion.name)
  const [sortOrder, setSortOrder] = useState(String(criterion.sortOrder))
  const [isActive, setIsActive] = useState(criterion.isActive)
  const [targetTypes, setTargetTypes] = useState<RatingTargetType[]>(
    criterion.targetTypes,
  )
  const canSave = name.trim().length > 0

  function handleSave() {
    const trimmedName = name.trim()
    if (trimmedName.length === 0) {
      return
    }

    onUpdateRatingCriterion?.(criterion.id, {
      name: trimmedName,
      targetTypes,
      sortOrder: parseSortOrder(sortOrder, criterion.sortOrder),
      isActive,
    })
  }

  return (
    <aside
      className="panel detail-panel"
      aria-labelledby="rating-criterion-title"
    >
      <div className="detail-header">
        <span className="entity-type">
          {criterion.isBuiltin ? 'Built-in criterion' : 'Custom criterion'}
        </span>
        <h2 id="rating-criterion-title">{criterion.name}</h2>
        <p>{criterion.code}</p>
      </div>

      <section className="detail-section" aria-label="Rating criterion editor">
        <label className="settings-control">
          <span>Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="settings-control">
          <span>Order</span>
          <input
            inputMode="numeric"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          />
        </label>
        <RatingTargetCheckboxes
          disabled={criterion.isProtected}
          targetTypes={targetTypes}
          onTargetTypesChange={setTargetTypes}
        />
        <label className="settings-check">
          <input
            type="checkbox"
            checked={isActive}
            disabled={criterion.isProtected}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          <span>Active</span>
        </label>
        <div className="rating-criterion-preview">
          <span>Preview</span>
          <strong>{name || criterion.name}</strong>
          <p>{targetTypes.map(ratingTargetTypeLabel).join(', ')}</p>
        </div>
        <button
          className="button button-primary"
          type="button"
          disabled={!canSave}
          onClick={handleSave}
        >
          <Save size={16} aria-hidden="true" />
          Save
        </button>
      </section>

      <section className="detail-section" aria-label="Rating criterion removal">
        <button
          className="button button-secondary"
          type="button"
          disabled={criterion.isProtected}
          onClick={() => onDeleteRatingCriterion?.(criterion)}
        >
          <Trash2 size={16} aria-hidden="true" />
          Delete
        </button>
      </section>
    </aside>
  )
}

function RatingTargetCheckboxes({
  disabled = false,
  targetTypes,
  onTargetTypesChange,
}: {
  disabled?: boolean
  targetTypes: RatingTargetType[]
  onTargetTypesChange: (targetTypes: RatingTargetType[]) => void
}) {
  function toggleTarget(targetType: RatingTargetType, checked: boolean) {
    const nextTargetTypes = checked
      ? [...targetTypes, targetType]
      : targetTypes.filter((item) => item !== targetType)

    if (nextTargetTypes.length > 0) {
      onTargetTypesChange(nextTargetTypes)
    }
  }

  return (
    <fieldset className="rating-target-checkboxes" disabled={disabled}>
      <legend>Targets</legend>
      {ratingTargetTypes.map((targetType) => (
        <label key={targetType}>
          <input
            checked={targetTypes.includes(targetType)}
            type="checkbox"
            onChange={(event) => toggleTarget(targetType, event.target.checked)}
          />
          <span>{ratingTargetTypeLabel(targetType)}</span>
        </label>
      ))}
    </fieldset>
  )
}
function EmptyRatingCriterionPanel() {
  return (
    <aside
      className="panel detail-panel"
      aria-label="No rating criterion selected"
    >
      <div className="detail-header">
        <span className="entity-type">Rating criteria</span>
        <h2>No criterion selected</h2>
        <p>Choose a rating criterion.</p>
      </div>
    </aside>
  )
}

function ratingCriterionSearchText(criterion: RatingCriterion) {
  return [
    criterion.name,
    criterion.code,
    criterion.isActive ? 'active' : 'inactive',
    criterion.isBuiltin ? 'builtin' : 'custom',
    criterion.isProtected ? 'protected' : '',
    ...criterion.targetTypes.map(ratingTargetTypeLabel),
  ]
    .join(' ')
    .toLowerCase()
}
