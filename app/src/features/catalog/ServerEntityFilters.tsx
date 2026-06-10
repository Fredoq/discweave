import { FilterSelect } from './FilterSelect'
import { formatRoleFacet, roleFacetValue } from './catalogDisplayLabels'
import { uniqueValues } from './catalogGraph'
import type { CatalogDictionaries, CatalogSearchResult } from './catalogApi'
import type { ServerCatalogFilters } from './catalogWorkspaceShared'

export function EntityFilterBar({
  filters,
  dictionaries,
  results,
  total,
  visibleCount,
  onClearFilters,
  onFilterChange,
}: {
  filters: ServerCatalogFilters
  dictionaries?: CatalogDictionaries
  results: CatalogSearchResult[]
  total: number
  visibleCount: number
  onClearFilters: () => void
  onFilterChange: (filters: ServerCatalogFilters) => void
}) {
  function updateFilter<Key extends keyof ServerCatalogFilters>(
    key: Key,
    value: ServerCatalogFilters[Key],
  ) {
    onFilterChange({ ...filters, [key]: value })
  }

  const mediaOptions = uniqueValues(
    results.flatMap((result) => result.facets.media),
  )
  const statusOptions = uniqueValues(
    results.flatMap((result) => result.facets.statuses),
  )
  const roleOptions = uniqueRoleOptions(
    results.flatMap((result) => result.facets.roles),
    dictionaries,
  )
  const tagOptions = uniqueValues(
    results.flatMap((result) => result.facets.tags),
  )

  return (
    <div className="filter-stack" aria-label="Workspace filters">
      <div className="filter-bar">
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
          values={[]}
          options={roleOptions}
          onChange={(value) => updateFilter('role', value)}
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

function uniqueRoleOptions(
  roles: string[],
  dictionaries: CatalogDictionaries | undefined,
) {
  const options = new Map<string, { label: string; value: string }>()

  for (const role of uniqueValues(roles)) {
    const value = roleFacetValue(role, dictionaries)
    options.set(value, {
      label: formatRoleFacet(role, dictionaries),
      value,
    })
  }

  return [...options.values()]
}
