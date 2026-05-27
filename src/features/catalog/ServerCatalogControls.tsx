import type { LabelRecord } from '../labels/labelsData'
import type { CatalogSearchResult } from './catalogApi'
import { FilterSelect } from './FilterSelect'
import { catalogEntityHref } from './catalogLinks'
import { uniqueValues } from './catalogGraph'
import {
  displayEntityType,
  resultKey,
  savedViews,
  serverFilterOptions,
  type SavedView,
  type ServerCatalogFilters,
} from './catalogWorkspaceShared'

export function ServerFilterBar({
  activeView,
  filters,
  labels,
  results,
  visibleCount,
  total,
  onClearFilters,
  onFilterChange,
  onViewChange,
}: {
  activeView: SavedView
  filters: ServerCatalogFilters
  labels: LabelRecord[]
  results: CatalogSearchResult[]
  visibleCount: number
  total: number
  onClearFilters: () => void
  onFilterChange: (filters: ServerCatalogFilters) => void
  onViewChange: (view: SavedView) => void
}) {
  function updateFilter<Key extends keyof ServerCatalogFilters>(
    key: Key,
    value: ServerCatalogFilters[Key],
  ) {
    onFilterChange({ ...filters, [key]: value })
  }
  const mediaOptions = uniqueValues([
    ...serverFilterOptions.media,
    ...results.flatMap((result) => result.facets.media),
  ])
  const statusOptions = uniqueValues([
    ...serverFilterOptions.statuses,
    ...results.flatMap((result) => result.facets.statuses),
  ])
  const roleOptions = uniqueValues([
    ...serverFilterOptions.roles,
    ...results.flatMap((result) => result.facets.roles),
  ])
  const tagOptions = uniqueValues(
    results.flatMap((result) => result.facets.tags),
  )
  const labelOptions = buildLabelOptions(labels, results, filters.labelId)

  return (
    <div className="filter-stack" aria-label="Catalog filters">
      <div className="filter-bar">
        <div className="saved-views" role="list" aria-label="Saved views">
          {savedViews.map((view) => (
            <button
              key={view}
              className="view-pill"
              type="button"
              aria-pressed={activeView === view}
              onClick={() => onViewChange(view)}
            >
              {view}
            </button>
          ))}
        </div>
        <button
          className="button button-secondary"
          type="button"
          onClick={onClearFilters}
        >
          Clear filters
        </button>
        <span className="result-count">
          {visibleCount} shown · {total} total
        </span>
      </div>

      <div className="filter-grid">
        <FilterSelect
          label="Catalog entity type"
          value={filters.entityType}
          values={serverFilterOptions.entityTypes}
          onChange={(value) =>
            updateFilter(
              'entityType',
              value as ServerCatalogFilters['entityType'],
            )
          }
        />
        <FilterSelect
          label="Media type"
          value={filters.media}
          values={mediaOptions}
          onChange={(value) => updateFilter('media', value)}
        />
        <FilterSelect
          label="Ownership status"
          value={filters.status}
          values={statusOptions}
          onChange={(value) => updateFilter('status', value)}
        />
        <FilterSelect
          label="Credit or relation role"
          value={filters.role}
          values={roleOptions}
          onChange={(value) => updateFilter('role', value)}
        />
        <LabelFilterSelect
          value={filters.labelId}
          labels={labelOptions}
          onChange={(value) => updateFilter('labelId', value)}
        />
        <FilterSelect
          label="Tag"
          value={filters.tag}
          values={tagOptions}
          onChange={(value) => updateFilter('tag', value)}
        />
      </div>
    </div>
  )
}

const collectorSignalLabels: Record<string, string> = {
  digitalWithoutPhysical: 'Digital without physical',
  losslessAvailable: 'Lossless available',
  lossyWithoutLossless: 'Lossy without lossless',
  missingCredits: 'Missing credits',
  physicalWithoutDigital: 'Physical without digital',
  wantedNotOwned: 'Wanted not owned',
}

function formatCollectorSignals(values: string[]) {
  return values.map(formatCollectorSignal)
}

function formatCollectorSignal(value: string) {
  return (
    collectorSignalLabels[value] ??
    value.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  )
}

function BadgeList({
  values,
  variant,
}: {
  values: string[]
  variant: 'credit' | 'media' | 'tag'
}) {
  if (values.length === 0) {
    return <span className="badge badge-tag">None</span>
  }

  return (
    <span className="badge-list">
      {values.map((value) => (
        <span key={value} className={`badge badge-${variant}`}>
          {value}
        </span>
      ))}
    </span>
  )
}

function buildLabelOptions(
  labels: LabelRecord[],
  results: CatalogSearchResult[],
  selectedLabelId: string,
) {
  const byId = new Map(labels.map((label) => [label.id, label]))

  for (const result of results) {
    if (result.type !== 'label') {
      continue
    }

    const labelId = result.facets.labelId ?? result.id

    if (!labelId || byId.has(labelId)) {
      continue
    }

    byId.set(labelId, {
      id: labelId,
      name: result.title,
    })
  }

  if (selectedLabelId && !byId.has(selectedLabelId)) {
    byId.set(selectedLabelId, { id: selectedLabelId, name: selectedLabelId })
  }

  return [...byId.values()]
}

function LabelFilterSelect({
  labels,
  value,
  onChange,
}: {
  labels: LabelRecord[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="filter-control">
      <span>Label</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">All</option>
        {labels.map((label) => (
          <option key={label.id} value={label.id}>
            {label.name}
          </option>
        ))}
      </select>
    </label>
  )
}

export function ServerCatalogTable({
  results,
  searchStatus,
  selectedResultId,
  total,
  onSelectResult,
}: {
  results: CatalogSearchResult[]
  searchStatus: 'loading' | 'ready' | 'error'
  selectedResultId: string
  total: number
  onSelectResult: (result: CatalogSearchResult) => void
}) {
  if (searchStatus === 'loading') {
    return (
      <section className="panel catalog-panel" aria-live="polite">
        <p role="status">Searching catalog…</p>
      </section>
    )
  }

  if (results.length === 0) {
    return (
      <section className="panel catalog-panel" aria-live="polite">
        <div className="panel-heading">
          <div>
            <h2>Catalog results</h2>
            <p>No matching catalog entries.</p>
          </div>
        </div>
      </section>
    )
  }

  const hasHiddenResults = total > results.length

  return (
    <section className="panel catalog-panel" aria-labelledby="results-title">
      <div className="panel-heading">
        <div>
          <h2 id="results-title">Catalog results</h2>
          <p>Server-ranked matches with facets and relationship context.</p>
          {hasHiddenResults ? (
            <p className="result-window-note">
              Showing first {results.length} of {total} matches. Refine search
              or filters to narrow results.
            </p>
          ) : null}
        </div>
      </div>

      <div className="table-scroll">
        <table className="catalog-table">
          <thead>
            <tr>
              <th scope="col">Title</th>
              <th scope="col">Type</th>
              <th scope="col">Context</th>
              <th scope="col">Roles</th>
              <th scope="col">Media</th>
              <th scope="col">Status</th>
              <th scope="col">Matched fields</th>
              <th scope="col">Signals</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => {
              const key = resultKey(result)

              return (
                <tr
                  key={key}
                  aria-selected={key === selectedResultId}
                  className={
                    key === selectedResultId ? 'is-selected' : undefined
                  }
                >
                  <th scope="row">
                    <button
                      className="row-title"
                      type="button"
                      aria-label={`Select catalog ${displayEntityType(
                        result.type,
                      ).toLowerCase()} ${result.title}`}
                      onClick={() => onSelectResult(result)}
                    >
                      <strong>{result.title}</strong>
                      <span>
                        {result.subtitle ?? result.summary ?? 'Catalog entity'}
                      </span>
                    </button>
                    <a
                      className="detail-link row-link"
                      href={catalogEntityHref({
                        kind: result.type,
                        id: result.id,
                      })}
                      aria-label={`Open ${result.title}`}
                    >
                      Open
                    </a>
                  </th>
                  <td data-label="Type">{displayEntityType(result.type)}</td>
                  <td data-label="Context">
                    {result.summary ?? result.snippets[0] ?? 'No context'}
                  </td>
                  <td data-label="Roles">
                    <BadgeList values={result.facets.roles} variant="credit" />
                  </td>
                  <td data-label="Media">
                    <BadgeList values={result.facets.media} variant="media" />
                  </td>
                  <td data-label="Status">
                    <BadgeList values={result.facets.statuses} variant="tag" />
                  </td>
                  <td data-label="Matched fields">
                    <BadgeList values={result.matchedFields} variant="credit" />
                  </td>
                  <td data-label="Signals">
                    <BadgeList
                      values={formatCollectorSignals(
                        result.facets.collectorSignals,
                      )}
                      variant="tag"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
