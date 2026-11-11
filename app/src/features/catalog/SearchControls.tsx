import { SlidersHorizontal } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { savedViews, type SavedView } from './catalogWorkspaceShared'

export function SearchControls({
  activeView,
  entityType,
  entityOptions,
  activeFilterCount,
  children,
  resultCount,
  sortControl,
  onEntityChange,
  onViewChange,
  onClearFilters,
}: Readonly<{
  activeView: SavedView
  entityType: string
  entityOptions: { value: string; label: string }[]
  activeFilterCount: number
  children: ReactNode
  resultCount: string
  sortControl?: ReactNode
  onEntityChange: (value: string) => void
  onViewChange: (view: SavedView) => void
  onClearFilters: () => void
}>) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filtersId = useId()

  return (
    <div className="search-controls" aria-label="Search controls">
      <div className="search-controls__toolbar">
        <div
          className="search-entity-types"
          role="group"
          aria-label="Catalog entity type"
        >
          {[{ value: '', label: 'All' }, ...entityOptions].map((option) => (
            <button
              key={option.value}
              className="view-pill"
              type="button"
              aria-pressed={entityType === option.value}
              onClick={() => onEntityChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="search-saved-view">
          <span>Saved view</span>
          <select
            value={activeView}
            onChange={(event) => onViewChange(event.target.value as SavedView)}
          >
            {savedViews.map((view) => (
              <option key={view}>{view}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="button button-secondary"
          aria-expanded={filtersOpen}
          aria-controls={filtersId}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <SlidersHorizontal size={15} aria-hidden="true" />
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
        <button
          type="button"
          className="button button-secondary"
          onClick={onClearFilters}
        >
          Clear filters
        </button>
      </div>
      {filtersOpen ? (
        <section
          id={filtersId}
          className="search-advanced-filters"
          aria-label="Advanced filters"
        >
          <div className="filter-grid">{children}</div>
          <p>
            Filters apply immediately. Closing this panel keeps them active.
          </p>
        </section>
      ) : null}
      <div className="search-controls__results">
        <span className="result-count">{resultCount}</span>
        {sortControl}
      </div>
    </div>
  )
}
