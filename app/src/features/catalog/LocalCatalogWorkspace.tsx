import { DateAddedSortSelect } from './DateAddedSortSelect'
import { useDateAddedSort } from './dateAddedSort'
import { Search } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ArtistRecord } from '../artists/artistsData'
import type { OwnedItemRecord } from '../ownedItems/ownedItemsData'
import type { PlaylistRecord } from '../playlists/playlistsData'
import type { ReleaseRecord } from '../releases/releasesData'
import type { RelationRecord } from '../relations/relationsData'
import type { TrackRecord } from '../tracks/tracksData'
import { FilterSelect } from './FilterSelect'
import { SearchControls } from './SearchControls'
import { SearchPreviewDialog } from './SearchPreviewDialog'
import {
  buildCatalogEntries,
  matchesTerms,
  uniqueValues,
  type CatalogEntry,
} from './catalogGraph'
import {
  buildFilterOptions,
  emptyFilters,
  matchesFilters,
  matchesSavedView,
  type CatalogFilters,
  type SavedView,
} from './catalogWorkspaceShared'

type LocalCatalogWorkspaceProps = {
  addEntryPanel?: ReactNode
  artists: ArtistRecord[]
  releases: ReleaseRecord[]
  tracks: TrackRecord[]
  ownedItems: OwnedItemRecord[]
  relations: RelationRecord[]
  playlists: PlaylistRecord[]
}

export function LocalCatalogWorkspace({
  addEntryPanel,
  artists,
  releases,
  tracks,
  ownedItems,
  relations,
  playlists,
}: Readonly<LocalCatalogWorkspaceProps>) {
  const [query, setQuery] = useState('')
  const [activeView, setActiveView] = useState<SavedView>('All')
  const [filters, setFilters] = useState<CatalogFilters>(emptyFilters)
  const entries = useMemo(
    () =>
      buildCatalogEntries({
        artists,
        releases,
        tracks,
        ownedItems,
        relations,
        playlists,
      }),
    [artists, ownedItems, playlists, relations, releases, tracks],
  )
  const [selectedEntryId, setSelectedEntryId] = useState('')

  const filterOptions = useMemo(() => buildFilterOptions(entries), [entries])
  const filteredEntries = useMemo(() => {
    return entries
      .filter((entry) => matchesSavedView(entry, activeView))
      .filter((entry) => matchesFilters(entry, filters))
      .filter((entry) => matchesTerms(entry.searchText, query))
  }, [activeView, entries, filters, query])

  const {
    sort,
    setSort,
    sortedRecords: visibleEntries,
  } = useDateAddedSort(filteredEntries, 'catalog')

  const selectedEntry =
    visibleEntries.find((entry) => entry.id === selectedEntryId) ?? null

  useEffect(() => {
    if (!selectedEntryId || selectedEntry) return
    let current = true
    queueMicrotask(() => {
      if (current) setSelectedEntryId('')
    })
    return () => {
      current = false
    }
  }, [selectedEntry, selectedEntryId])

  return (
    <section className="search-workspace" aria-label="Search workspace">
      <div className="catalog-main">
        <SearchField query={query} onQueryChange={setQuery} />
        {addEntryPanel}
        <FilterBar
          activeView={activeView}
          sortControl={<DateAddedSortSelect value={sort} onChange={setSort} />}
          filters={filters}
          filterOptions={filterOptions}
          visibleCount={visibleEntries.length}
          onClearFilters={() => {
            setQuery('')
            setActiveView('All')
            setFilters(emptyFilters)
          }}
          onFilterChange={(nextFilters) => setFilters(nextFilters)}
          onViewChange={setActiveView}
        />
        <CatalogTable
          entries={visibleEntries}
          selectedEntryId={selectedEntry?.id ?? ''}
          onSelectEntry={setSelectedEntryId}
        />
      </div>

      {selectedEntry ? (
        <SearchPreviewDialog
          title={selectedEntry.title}
          onClose={() => setSelectedEntryId('')}
        >
          <DetailPanel entry={selectedEntry} />
        </SearchPreviewDialog>
      ) : null}
    </section>
  )
}

type SearchFieldProps = {
  query: string
  onQueryChange: (query: string) => void
}

export function SearchField({
  query,
  onQueryChange,
}: Readonly<SearchFieldProps>) {
  return (
    <label className="search-field">
      <span className="search-icon" aria-hidden="true">
        <Search size={17} strokeWidth={2.2} />
      </span>
      <span className="visually-hidden">Search collection</span>
      <input
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Artist, release, track, label, role, medium, tag or status"
      />
    </label>
  )
}

type FilterBarProps = {
  activeView: SavedView
  sortControl?: ReactNode
  filters: CatalogFilters
  filterOptions: ReturnType<typeof buildFilterOptions>
  visibleCount: number
  onClearFilters: () => void
  onFilterChange: (filters: CatalogFilters) => void
  onViewChange: (view: SavedView) => void
}

function FilterBar({
  activeView,
  sortControl,
  filters,
  filterOptions,
  visibleCount,
  onClearFilters,
  onFilterChange,
  onViewChange,
}: Readonly<FilterBarProps>) {
  function updateFilter<Key extends keyof CatalogFilters>(
    key: Key,
    value: CatalogFilters[Key],
  ) {
    onFilterChange({ ...filters, [key]: value })
  }

  return (
    <SearchControls
      activeView={activeView}
      entityType={filters.entityType}
      entityOptions={filterOptions.entityTypes.map((value) => ({
        value,
        label: value === 'Owned item' ? 'Copies' : `${value}s`,
      }))}
      activeFilterCount={
        Object.entries(filters).filter(
          ([key, value]) => key !== 'entityType' && value !== '',
        ).length
      }
      resultCount={`${visibleCount} shown`}
      sortControl={sortControl}
      onEntityChange={(value) =>
        updateFilter('entityType', value as CatalogFilters['entityType'])
      }
      onViewChange={onViewChange}
      onClearFilters={onClearFilters}
    >
      <FilterSelect
        label="Media type"
        value={filters.media}
        values={filterOptions.media}
        onChange={(value) => updateFilter('media', value)}
      />
      <FilterSelect
        label="Ownership status"
        value={filters.status}
        values={filterOptions.statuses}
        onChange={(value) => updateFilter('status', value)}
      />
      <FilterSelect
        label="Credit or relation role"
        value={filters.role}
        values={filterOptions.roles}
        onChange={(value) => updateFilter('role', value)}
      />
      <FilterSelect
        label="Label"
        value={filters.label}
        values={filterOptions.labels}
        onChange={(value) => updateFilter('label', value)}
      />
      <FilterSelect
        label="Tag"
        value={filters.tag}
        values={filterOptions.tags}
        onChange={(value) => updateFilter('tag', value)}
      />
      <FilterSelect
        label="File format"
        value={filters.format}
        values={filterOptions.formats}
        onChange={(value) => updateFilter('format', value)}
      />
    </SearchControls>
  )
}

type CatalogTableProps = {
  entries: CatalogEntry[]
  selectedEntryId: string
  onSelectEntry: (entryId: string) => void
}

function CatalogTable({
  entries,
  selectedEntryId,
  onSelectEntry,
}: Readonly<CatalogTableProps>) {
  return (
    <section className="panel catalog-panel" aria-labelledby="results-title">
      <div className="panel-heading">
        <div>
          <h2 id="results-title">Search results</h2>
          <p>Rows combine releases, tracks and ownership signals.</p>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="search-empty-state">No matching catalog entries.</p>
      ) : null}
      <div className="table-scroll">
        <table className="catalog-table search-local-results">
          <thead>
            <tr>
              <th scope="col">Title</th>
              <th scope="col">Type</th>
              <th scope="col">Year</th>
              <th scope="col">Label</th>
              <th scope="col">Media</th>
              <th scope="col">Status</th>
              <th scope="col">Relation hint</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                aria-selected={entry.id === selectedEntryId}
                className={
                  entry.id === selectedEntryId ? 'is-selected' : undefined
                }
              >
                <th scope="row">
                  <a
                    className="row-title search-result-title"
                    href={entry.href}
                    aria-label={`Open ${entry.title}`}
                  >
                    <strong>{entry.title}</strong>
                    <span>{entry.artist}</span>
                  </a>
                  <button
                    className="detail-link row-link search-preview-button"
                    type="button"
                    aria-label={`Preview ${entry.title}`}
                    onClick={() => onSelectEntry(entry.id)}
                  >
                    Preview
                  </button>
                </th>
                <td data-label="Type">{entry.type}</td>
                <td data-label="Year">{entry.year}</td>
                <td data-label="Label">{entry.label}</td>
                <td data-label="Media">
                  <BadgeList values={entry.media} variant="media" />
                </td>
                <td data-label="Status">
                  <StatusBadge tone={entry.statusTone}>
                    {entry.status}
                  </StatusBadge>
                </td>
                <td data-label="Relation">{entry.relationHint}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

type DetailPanelProps = {
  entry: CatalogEntry
}

function DetailPanel({ entry }: Readonly<DetailPanelProps>) {
  return (
    <aside
      className="panel detail-panel"
      aria-labelledby="detail-title"
      aria-label={entry.title}
    >
      <div className="detail-header">
        <span className="entity-type">{entry.type}</span>
        <h2 id="detail-title">{entry.title}</h2>
        <p>{entry.artist}</p>
      </div>

      <StatusBadge tone={entry.statusTone}>{entry.status}</StatusBadge>

      {entry.summary ? <p className="detail-summary">{entry.summary}</p> : null}

      <section className="detail-section" aria-labelledby="catalog-open-title">
        <h3 id="catalog-open-title">Workspace link</h3>
        <a className="detail-link" href={entry.href}>
          Open in workspace
        </a>
      </section>

      <section className="detail-section" aria-labelledby="owned-copies-title">
        <h3 id="owned-copies-title">Media and ownership</h3>
        <dl className="detail-list">
          <div>
            <dt>Media</dt>
            <dd>
              <BadgeList values={entry.media} variant="media" />
            </dd>
          </div>
          <div>
            <dt>Storage</dt>
            <dd>{entry.storage || 'No storage recorded'}</dd>
          </div>
          <div>
            <dt>Condition</dt>
            <dd>{entry.condition || 'No condition recorded'}</dd>
          </div>
        </dl>
      </section>

      <section className="detail-section" aria-labelledby="credits-title">
        <h3 id="credits-title">Credits and relations</h3>
        <BadgeList values={entry.credits} variant="credit" />
        <p>{entry.relationHint}</p>
      </section>

      <section className="detail-section" aria-labelledby="tags-title">
        <h3 id="tags-title">Tags</h3>
        <BadgeList values={entry.tags} variant="tag" />
      </section>
    </aside>
  )
}

type BadgeListProps = {
  values: string[]
  variant: 'media' | 'credit' | 'tag'
}

function BadgeList({ values, variant }: Readonly<BadgeListProps>) {
  const unique = uniqueValues(values)

  if (unique.length === 0) {
    return <span>None recorded</span>
  }

  return (
    <span className="badge-list">
      {unique.map((value) => (
        <span key={value} className={`badge badge-${variant}`}>
          {value}
        </span>
      ))}
    </span>
  )
}

type StatusBadgeProps = {
  children: string
  tone: CatalogEntry['statusTone']
}

function StatusBadge({ children, tone }: Readonly<StatusBadgeProps>) {
  return <span className={`badge status-badge status-${tone}`}>{children}</span>
}
