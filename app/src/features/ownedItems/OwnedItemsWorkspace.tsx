import { DateAddedSortSelect } from '../catalog/DateAddedSortSelect'
import { useDateAddedSort } from '../catalog/dateAddedSort'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  OwnedItemEntryForm,
  type OwnedItemMutationResult,
} from './OwnedItemEntryForm'
export { OwnedItemEntryForm } from './OwnedItemEntryForm'
export type { OwnedItemEntryFormProps } from './OwnedItemEntryForm'
import { uniqueValues } from '../catalog/catalogGraph'
import {
  defaultCatalogDictionaries,
  type CatalogDictionaries,
} from '../catalog/catalogApi'
import { FilterSelect } from '../catalog/FilterSelect'
import { useCatalogSelection } from '../catalog/useCatalogSelection'
import type { PlaylistRecord } from '../playlists/playlistsData'
import type { ReleaseRecord } from '../releases/releasesData'
import type { RelationRecord } from '../relations/relationsData'
import type { TrackRecord } from '../tracks/tracksData'
import {
  EmptyDetailPanel,
  OwnedItemDetail,
  StatusBadge,
} from './OwnedItemDetail'
import {
  ownedItemLocationSummary,
  ownedItemStateSummary,
  type OwnedItemRecord,
} from './ownedItemsData'

type OwnedItemsWorkspaceProps = {
  isManualEntryOpen?: boolean
  items?: OwnedItemRecord[]
  locationSearch?: string
  onAddItem?: (item: OwnedItemRecord) => OwnedItemMutationResult
  onDeleteItem?: (itemId: string) => OwnedItemMutationResult
  onUpdateItem?: (item: OwnedItemRecord) => OwnedItemMutationResult
  onManualEntryClose?: () => void
  playlists?: PlaylistRecord[]
  releases?: ReleaseRecord[]
  relations?: RelationRecord[]
  tracks?: TrackRecord[]
  dictionaries?: CatalogDictionaries
}

export function OwnedItemsWorkspace({
  isManualEntryOpen = false,
  items: providedItems,
  locationSearch = window.location.search,
  onAddItem,
  onDeleteItem,
  onUpdateItem,
  onManualEntryClose = () => {},
  playlists = [],
  releases = [],
  relations = [],
  tracks = [],
  dictionaries = defaultCatalogDictionaries,
}: Readonly<OwnedItemsWorkspaceProps>) {
  const [query, setQuery] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [filters, setFilters] = useState({
    status: '',
    medium: '',
    state: '',
    location: '',
  })
  const [manualItems, setManualItems] = useState<OwnedItemRecord[]>([])
  const [editingItemId, setEditingItemId] = useState('')
  const items = useMemo(() => {
    return [...(providedItems ?? []), ...manualItems]
  }, [manualItems, providedItems])

  const filteredItems = useMemo(() => {
    const terms = queryTerms(query)

    return items.filter(
      (item) =>
        terms.every((term) => ownedItemSearchText(item).includes(term)) &&
        (!filters.status || item.status === filters.status) &&
        (!filters.medium || item.medium === filters.medium) &&
        (!filters.state || ownedItemStateSummary(item) === filters.state) &&
        (!filters.location ||
          ownedItemLocationSummary(item) === filters.location),
    )
  }, [filters, items, query])
  const {
    sort,
    setSort,
    sortedRecords: visibleItems,
  } = useDateAddedSort(filteredItems, 'owned-items')

  const { selectedRecord: selectedItem, selectRecord: selectItem } =
    useCatalogSelection({
      locationSearch,
      queryParam: 'ownedItem',
      records: items,
      routePath: '/owned-items',
      visibleRecords: visibleItems,
    })

  async function handleAddItem(item: OwnedItemRecord) {
    if (onAddItem) {
      if ((await onAddItem(item)) === false) return false
    } else {
      setManualItems((currentItems) => [...currentItems, item])
    }

    setQuery('')
    selectItem(item.id)
    onManualEntryClose()
  }

  async function handleUpdateItem(item: OwnedItemRecord) {
    if (onUpdateItem) {
      if ((await onUpdateItem(item)) === false) return false
    } else {
      setManualItems((currentItems) =>
        currentItems.map((currentItem) =>
          currentItem.id === item.id ? item : currentItem,
        ),
      )
    }

    setQuery('')
    selectItem(item.id)
    setEditingItemId('')
  }

  function handleDeleteItem(itemId: string) {
    setDeleteError('')
    if (onDeleteItem) {
      Promise.resolve()
        .then(() => onDeleteItem(itemId))
        .then((result) => {
          if (result === false) {
            setDeleteError('The copy could not be deleted. Try again.')
            return
          }
          setQuery('')
          setEditingItemId('')
        })
        .catch((error: unknown) => {
          setDeleteError(
            error instanceof Error
              ? error.message
              : 'The copy could not be deleted. Try again.',
          )
        })
      return
    }
    setManualItems((currentItems) =>
      currentItems.filter((item) => item.id !== itemId),
    )
    setQuery('')
    setEditingItemId('')
  }

  const editingItem = items.find((item) => item.id === editingItemId)

  return (
    <section className="catalog-layout" aria-label="Owned Items workspace">
      <div className="catalog-main">
        <SearchField
          label="Search owned items"
          placeholder="Release, artist, medium, status, location, storage, condition, format or digital state"
          query={query}
          onQueryChange={setQuery}
        />
        {deleteError ? <p role="alert">{deleteError}</p> : null}
        <div className="filter-bar">
          <DateAddedSortSelect value={sort} onChange={setSort} />
          <FilterSelect
            label="Ownership status"
            value={filters.status}
            values={uniqueValues(items.map((item) => item.status))}
            onChange={(status) =>
              setFilters((current) => ({ ...current, status }))
            }
          />
          <FilterSelect
            label="Medium"
            value={filters.medium}
            values={uniqueValues(items.map((item) => item.medium))}
            onChange={(medium) =>
              setFilters((current) => ({ ...current, medium }))
            }
          />
          <FilterSelect
            label="Condition / digital state"
            value={filters.state}
            values={uniqueValues(items.map(ownedItemStateSummary))}
            onChange={(state) =>
              setFilters((current) => ({ ...current, state }))
            }
          />
          <FilterSelect
            label="Location / storage"
            value={filters.location}
            values={uniqueValues(items.map(ownedItemLocationSummary))}
            onChange={(location) =>
              setFilters((current) => ({ ...current, location }))
            }
          />
          <span className="result-count">{visibleItems.length} shown</span>
        </div>
        {isManualEntryOpen ? (
          <OwnedItemEntryForm
            dictionaries={dictionaries}
            items={items}
            onCancel={onManualEntryClose}
            releases={releases}
            onSubmit={handleAddItem}
          />
        ) : null}
        {editingItem ? (
          <OwnedItemEntryForm
            dictionaries={dictionaries}
            initialItem={editingItem}
            items={items}
            key={editingItem.id}
            onCancel={() => setEditingItemId('')}
            releases={releases}
            onSubmit={handleUpdateItem}
          />
        ) : null}
        <OwnedItemsTable
          items={visibleItems}
          selectedItemId={selectedItem?.id ?? ''}
          onSelectItem={selectItem}
        />
      </div>

      {selectedItem ? (
        <OwnedItemDetail
          item={selectedItem}
          onEdit={() => setEditingItemId(selectedItem.id)}
          onDelete={() => handleDeleteItem(selectedItem.id)}
          playlists={playlists}
          relations={relations}
          releases={releases}
          tracks={tracks}
        />
      ) : (
        <EmptyDetailPanel />
      )}
    </section>
  )
}

function queryTerms(query: string) {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean)
}

function ownedItemSearchText(item: OwnedItemRecord) {
  return [
    item.title,
    item.releaseTitle,
    item.artist,
    item.medium,
    item.status,
    ownedItemLocationSummary(item),
    ownedItemStateSummary(item),
    item.storage,
    item.condition,
    item.acquisition,
    item.copyNotes,
    item.linkedType,
    item.fileFormat,
    item.digitalState,
    item.digitizationState,
    ...item.tags,
  ]
    .join(' ')
    .toLowerCase()
}

type SearchFieldProps = {
  label: string
  placeholder: string
  query: string
  onQueryChange: (query: string) => void
}

function SearchField({
  label,
  placeholder,
  query,
  onQueryChange,
}: Readonly<SearchFieldProps>) {
  return (
    <label className="search-field">
      <span className="search-icon" aria-hidden="true">
        <Search size={17} strokeWidth={2.2} />
      </span>
      <span className="visually-hidden">{label}</span>
      <input
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}

type OwnedItemsTableProps = {
  items: OwnedItemRecord[]
  selectedItemId: string
  onSelectItem: (itemId: string) => void
}

function OwnedItemsTable({
  items,
  selectedItemId,
  onSelectItem,
}: Readonly<OwnedItemsTableProps>) {
  return (
    <section
      className="panel catalog-panel"
      aria-labelledby="owned-items-results-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="owned-items-results-title">Owned item records</h2>
          <p>Concrete copies stay separate from logical release metadata.</p>
        </div>
      </div>

      <div className="table-scroll">
        <table className="catalog-table workspace-table">
          <thead>
            <tr>
              <th scope="col">Owned item</th>
              <th scope="col">Artist</th>
              <th scope="col">Medium</th>
              <th scope="col">Status</th>
              <th scope="col">Location / Storage</th>
              <th scope="col">Condition / Digital state</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                aria-selected={item.id === selectedItemId}
                className={
                  item.id === selectedItemId ? 'is-selected' : undefined
                }
              >
                <th scope="row">
                  <button
                    className="row-title"
                    type="button"
                    onClick={() => onSelectItem(item.id)}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.releaseTitle}</span>
                  </button>
                </th>
                <td data-label="Artist">{item.artist}</td>
                <td data-label="Medium">
                  <span className="badge badge-media">{item.medium}</span>
                </td>
                <td data-label="Status">
                  <StatusBadge item={item}>{item.status}</StatusBadge>
                </td>
                <td data-label="Location / Storage">
                  {ownedItemLocationSummary(item)}
                </td>
                <td data-label="Condition / Digital state">
                  {ownedItemStateSummary(item)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
