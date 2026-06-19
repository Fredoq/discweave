import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ManualEntryPanel } from '../manualEntry/ManualEntryPanel'
import {
  createManualRecordId,
  textOrFallback,
} from '../manualEntry/manualEntryUtils'
import { uniqueValues } from '../catalog/catalogGraph'
import {
  activeDictionaryLabels,
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
import type { OwnedItemRecord, OwnedItemStatus } from './ownedItemsData'

type OwnedItemsWorkspaceProps = {
  isManualEntryOpen?: boolean
  items?: OwnedItemRecord[]
  locationSearch?: string
  onAddItem?: (item: OwnedItemRecord) => void
  onDeleteItem?: (itemId: string) => void
  onUpdateItem?: (item: OwnedItemRecord) => void
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
}: OwnedItemsWorkspaceProps) {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({
    status: '',
    medium: '',
    condition: '',
    storage: '',
  })
  const [manualItems, setManualItems] = useState<OwnedItemRecord[]>([])
  const [editingItemId, setEditingItemId] = useState('')
  const items = useMemo(() => {
    return [...(providedItems ?? []), ...manualItems]
  }, [manualItems, providedItems])

  const visibleItems = useMemo(() => {
    const terms = queryTerms(query)

    return items.filter(
      (item) =>
        terms.every((term) => ownedItemSearchText(item).includes(term)) &&
        (!filters.status || item.status === filters.status) &&
        (!filters.medium || item.medium === filters.medium) &&
        (!filters.condition || item.condition === filters.condition) &&
        (!filters.storage || item.storage === filters.storage),
    )
  }, [filters, items, query])
  const { selectedRecord: selectedItem, selectRecord: selectItem } =
    useCatalogSelection({
      locationSearch,
      queryParam: 'ownedItem',
      records: items,
      routePath: '/owned-items',
      visibleRecords: visibleItems,
    })

  function handleAddItem(item: OwnedItemRecord) {
    if (onAddItem) {
      onAddItem(item)
    } else {
      setManualItems((currentItems) => [...currentItems, item])
    }

    setQuery('')
    selectItem(item.id)
    onManualEntryClose()
  }

  function handleUpdateItem(item: OwnedItemRecord) {
    if (onUpdateItem) {
      onUpdateItem(item)
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
    if (onDeleteItem) {
      onDeleteItem(itemId)
    } else {
      setManualItems((currentItems) =>
        currentItems.filter((item) => item.id !== itemId),
      )
    }

    setQuery('')
    setEditingItemId('')
  }

  const editingItem = items.find((item) => item.id === editingItemId)

  return (
    <section className="catalog-layout" aria-label="Owned Items workspace">
      <div className="catalog-main">
        <SearchField
          label="Search owned items"
          placeholder="Release, artist, medium, status, storage, condition or format"
          query={query}
          onQueryChange={setQuery}
        />
        <div className="filter-bar">
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
            label="Condition"
            value={filters.condition}
            values={uniqueValues(items.map((item) => item.condition))}
            onChange={(condition) =>
              setFilters((current) => ({ ...current, condition }))
            }
          />
          <FilterSelect
            label="Storage location"
            value={filters.storage}
            values={uniqueValues(items.map((item) => item.storage))}
            onChange={(storage) =>
              setFilters((current) => ({ ...current, storage }))
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
            tracks={tracks}
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
            tracks={tracks}
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

export type OwnedItemEntryFormProps = {
  dictionaries: CatalogDictionaries
  initialItem?: OwnedItemRecord
  items: OwnedItemRecord[]
  onCancel: () => void
  releases: ReleaseRecord[]
  tracks: TrackRecord[]
  onSubmit: (item: OwnedItemRecord) => void
}

export function OwnedItemEntryForm({
  dictionaries,
  initialItem,
  items,
  onCancel,
  releases,
  onSubmit,
}: OwnedItemEntryFormProps) {
  const mediaTypeOptions = activeDictionaryLabels(dictionaries, 'mediaType')
  const [title, setTitle] = useState(initialItem?.title ?? '')
  const [selectedReleaseId, setSelectedReleaseId] = useState(
    initialItem?.releaseId ?? initialItem?.targetId ?? '',
  )
  const [medium, setMedium] = useState(initialItem?.medium ?? '')
  const [status, setStatus] = useState<OwnedItemStatus | ''>(
    initialItem?.status === 'Not recorded' ? '' : (initialItem?.status ?? ''),
  )
  const [storage, setStorage] = useState(initialItem?.storage ?? '')
  const [condition, setCondition] = useState(initialItem?.condition ?? '')
  const [digitizationNote, setDigitizationNote] = useState(
    initialItem?.digitizationState ?? '',
  )
  const selectedRelease = releases.find(
    (record) => record.id === selectedReleaseId,
  )
  const isValid = title.trim().length > 0 && Boolean(selectedRelease)
  const duplicateItem = items.find(
    (item) =>
      item.id !== initialItem?.id &&
      selectedRelease !== undefined &&
      item.releaseId === selectedRelease.id &&
      item.medium.toLowerCase() === medium.trim().toLowerCase() &&
      item.storage.toLowerCase() === storage.trim().toLowerCase(),
  )
  const formTitle = initialItem ? 'Edit owned item' : 'Add owned item'
  const requiredMessage =
    title.trim().length === 0
      ? 'Item name is required.'
      : 'Select an existing release.'

  function handleSubmit() {
    const itemTitle = title.trim()
    const itemStatus = status || 'Not recorded'

    if (!itemTitle || !selectedRelease) {
      return
    }

    const note = textOrFallback(
      digitizationNote,
      'Manual owned item draft with incomplete metadata.',
    )

    onSubmit({
      id: initialItem?.id ?? createManualRecordId('owned-item', itemTitle),
      title: itemTitle,
      targetType: 'Release',
      targetId: selectedRelease.id,
      releaseId: selectedRelease.id,
      releaseTitle: selectedRelease.title,
      artist: selectedRelease.artist,
      medium: textOrFallback(medium, 'Unspecified medium'),
      status: itemStatus,
      statusTone: statusToneFor(itemStatus),
      storage: textOrFallback(storage, 'No storage recorded'),
      condition: textOrFallback(condition, 'No condition recorded'),
      acquisition: 'Manual entry',
      copyNotes: note,
      linkedType: 'Release',
      fileFormat: 'None recorded',
      digitalState: 'Not recorded',
      digitizationState: note,
      tags: ['manual entry'],
    })
  }

  return (
    <ManualEntryPanel
      title={formTitle}
      requiredMessage={requiredMessage}
      isValid={isValid}
      onCancel={onCancel}
      onSubmit={handleSubmit}
      submitLabel={initialItem ? 'Save record' : 'Add record'}
    >
      <label>
        <span>Item name</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
      </label>
      {duplicateItem && medium.trim() && storage.trim() ? (
        <p className="manual-entry-warning manual-entry-wide" role="status">
          Likely duplicate owned item for {duplicateItem.releaseTitle},{' '}
          {duplicateItem.medium}, {duplicateItem.storage}. Submit is still
          allowed for this session.
        </p>
      ) : null}
      <label>
        <span>Existing release</span>
        <select
          value={selectedReleaseId}
          onChange={(event) => setSelectedReleaseId(event.target.value)}
        >
          <option value="">Select a release</option>
          {releases.map((releaseRecord) => (
            <option key={releaseRecord.id} value={releaseRecord.id}>
              {releaseRecord.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Medium</span>
        <select
          value={medium}
          onChange={(event) => setMedium(event.target.value)}
        >
          <option value="">Not recorded</option>
          {mediaTypeOptions.map((mediaType) => (
            <option key={mediaType}>{mediaType}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Ownership status</span>
        <select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as OwnedItemStatus | '')
          }
        >
          <option value="">Not recorded</option>
          <option>Owned</option>
          <option>Wanted</option>
          <option>Sold</option>
          <option>Needs digitization</option>
        </select>
      </label>
      <label>
        <span>Storage location</span>
        <input
          value={storage}
          onChange={(event) => setStorage(event.target.value)}
        />
      </label>
      <label>
        <span>Condition</span>
        <input
          value={condition}
          onChange={(event) => setCondition(event.target.value)}
        />
      </label>
      <label className="manual-entry-wide">
        <span>Digitization note</span>
        <textarea
          value={digitizationNote}
          onChange={(event) => setDigitizationNote(event.target.value)}
          rows={3}
        />
      </label>
    </ManualEntryPanel>
  )
}

function statusToneFor(status: OwnedItemStatus): OwnedItemRecord['statusTone'] {
  switch (status) {
    case 'Owned':
      return 'green'
    case 'Wanted':
      return 'blue'
    case 'Needs digitization':
      return 'amber'
    default:
      return 'gray'
  }
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
}: SearchFieldProps) {
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
}: OwnedItemsTableProps) {
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
              <th scope="col">Storage</th>
              <th scope="col">Condition</th>
              <th scope="col">Digital state</th>
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
                <td data-label="Storage">{item.storage}</td>
                <td data-label="Condition">{item.condition}</td>
                <td data-label="Digital state">{item.digitalState}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
