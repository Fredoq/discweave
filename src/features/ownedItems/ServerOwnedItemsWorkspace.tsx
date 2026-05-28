import { useEffect, useMemo, useRef, useState } from 'react'
import { CatalogApiError } from '../catalog/api/httpClient'
import { loadOwnedItemInventory } from '../catalog/api/ownedItemsClient'
import {
  EmptyDetailPanel,
  OwnedItemDetail,
  StatusBadge,
} from './OwnedItemDetail'
import {
  formatCollectorSignal,
  inventoryViewOptions,
  type OwnedItemRecord,
} from './ownedItemsData'

type ServerOwnedItemsWorkspaceProps = {
  locationSearch: string
  onSessionExpired: () => void
  searchRefreshKey: number
}

type InventoryFilters = {
  status: string
  medium: string
  condition: string
  storageLocation: string
  inventoryView: string
}

const emptyFilters: InventoryFilters = {
  status: '',
  medium: '',
  condition: '',
  storageLocation: '',
  inventoryView: '',
}

const statusOptions = [
  { label: 'Owned', value: 'owned' },
  { label: 'Wanted', value: 'wanted' },
  { label: 'Sold', value: 'sold' },
  { label: 'Needs digitization', value: 'needsDigitization' },
]

const mediumOptions = [
  { label: 'Digital', value: 'digital' },
  { label: 'Vinyl', value: 'vinyl' },
  { label: 'CD', value: 'cd' },
  { label: 'Cassette', value: 'cassette' },
  { label: 'Other', value: 'other' },
]

const conditionOptions = [
  { label: 'Mint', value: 'mint' },
  { label: 'Near Mint', value: 'nearMint' },
  { label: 'Very Good Plus', value: 'veryGoodPlus' },
  { label: 'Very Good', value: 'veryGood' },
  { label: 'Good', value: 'good' },
  { label: 'Fair', value: 'fair' },
  { label: 'Poor', value: 'poor' },
]

export function ServerOwnedItemsWorkspace({
  locationSearch,
  onSessionExpired,
  searchRefreshKey,
}: ServerOwnedItemsWorkspaceProps) {
  const initialParams = useMemo(
    () => parseInventorySearchParams(locationSearch),
    [locationSearch],
  )
  const [filters, setFilters] = useState(initialParams.filters)
  const [items, setItems] = useState<OwnedItemRecord[]>([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [selectedItemId, setSelectedItemId] = useState(
    initialParams.selectedItemId,
  )
  const onSessionExpiredRef = useRef(onSessionExpired)

  useEffect(() => {
    onSessionExpiredRef.current = onSessionExpired
  }, [onSessionExpired])

  useEffect(() => {
    let isCurrent = true

    queueMicrotask(() => {
      if (!isCurrent) {
        return
      }

      setFilters(initialParams.filters)
      setSelectedItemId(initialParams.selectedItemId)
    })

    return () => {
      isCurrent = false
    }
  }, [initialParams])

  useEffect(() => {
    let isCurrent = true

    queueMicrotask(() => {
      if (!isCurrent) {
        return
      }

      setStatus('loading')
      setError('')
    })

    void loadOwnedItemInventory(filters)
      .then((response) => {
        if (!isCurrent) {
          return
        }

        setItems(response.items)
        setTotal(response.total)
        setStatus('ready')
        setSelectedItemId((currentId) =>
          response.items.some((item) => item.id === currentId)
            ? currentId
            : (response.items[0]?.id ?? ''),
        )
      })
      .catch((loadError: unknown) => {
        if (!isCurrent) {
          return
        }

        if (loadError instanceof CatalogApiError && loadError.status === 401) {
          onSessionExpiredRef.current()
          return
        }

        setItems([])
        setTotal(0)
        setStatus('error')
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Owned item inventory could not be loaded.',
        )
      })

    return () => {
      isCurrent = false
    }
  }, [filters, searchRefreshKey])

  const selectedItem =
    items.find((item) => item.id === selectedItemId) ?? items[0]

  useEffect(() => {
    const nextUrl = buildInventoryUrl(selectedItem?.id ?? '', filters)
    const currentUrl = `${window.location.pathname}${window.location.search}`

    if (currentUrl !== nextUrl) {
      window.history.replaceState({}, '', nextUrl)
    }
  }, [filters, selectedItem])

  function updateFilter<Key extends keyof InventoryFilters>(
    key: Key,
    value: InventoryFilters[Key],
  ) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  function selectItem(itemId: string) {
    setSelectedItemId(itemId)
    const nextUrl = buildInventoryUrl(itemId, filters)
    const currentUrl = `${window.location.pathname}${window.location.search}`

    if (currentUrl !== nextUrl) {
      window.history.pushState({}, '', nextUrl)
    }
  }

  return (
    <section className="catalog-layout" aria-label="Owned Items workspace">
      <div className="catalog-main">
        <InventoryFilterBar
          filters={filters}
          total={total}
          visibleCount={items.length}
          onClearFilters={() => setFilters(emptyFilters)}
          onFilterChange={updateFilter}
        />
        <OwnedInventoryTable
          items={items}
          selectedItemId={selectedItem?.id ?? ''}
          status={status}
          total={total}
          onSelectItem={selectItem}
        />
        {status === 'error' ? (
          <section className="panel section-panel" role="alert">
            {error}
          </section>
        ) : null}
      </div>

      {selectedItem ? (
        <OwnedItemDetail
          item={selectedItem}
          playlists={[]}
          releases={[]}
          relations={[]}
          tracks={[]}
        />
      ) : (
        <EmptyDetailPanel />
      )}
    </section>
  )
}

function InventoryFilterBar({
  filters,
  total,
  visibleCount,
  onClearFilters,
  onFilterChange,
}: {
  filters: InventoryFilters
  total: number
  visibleCount: number
  onClearFilters: () => void
  onFilterChange: <Key extends keyof InventoryFilters>(
    key: Key,
    value: InventoryFilters[Key],
  ) => void
}) {
  return (
    <div className="filter-stack" aria-label="Inventory filters">
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
        <CodeFilterSelect
          label="Ownership status"
          value={filters.status}
          options={statusOptions}
          onChange={(value) => onFilterChange('status', value)}
        />
        <CodeFilterSelect
          label="Medium"
          value={filters.medium}
          options={mediumOptions}
          onChange={(value) => onFilterChange('medium', value)}
        />
        <CodeFilterSelect
          label="Condition"
          value={filters.condition}
          options={conditionOptions}
          onChange={(value) => onFilterChange('condition', value)}
        />
        <label className="filter-control">
          <span>Storage location</span>
          <input
            type="search"
            value={filters.storageLocation}
            onChange={(event) =>
              onFilterChange('storageLocation', event.target.value)
            }
          />
        </label>
        <CodeFilterSelect
          label="Inventory view"
          value={filters.inventoryView}
          options={inventoryViewOptions}
          onChange={(value) => onFilterChange('inventoryView', value)}
        />
      </div>
    </div>
  )
}

function CodeFilterSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: ReadonlyArray<{ label: string; value: string }>
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="filter-control">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function OwnedInventoryTable({
  items,
  selectedItemId,
  status,
  total,
  onSelectItem,
}: {
  items: OwnedItemRecord[]
  selectedItemId: string
  status: 'loading' | 'ready' | 'error'
  total: number
  onSelectItem: (itemId: string) => void
}) {
  if (status === 'loading') {
    return (
      <section className="panel catalog-panel" aria-live="polite">
        <p role="status">Loading owned item inventory...</p>
      </section>
    )
  }

  if (items.length === 0) {
    return (
      <section className="panel catalog-panel" aria-live="polite">
        <div className="panel-heading">
          <div>
            <h2>Owned item inventory</h2>
            <p>No matching owned items.</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section
      className="panel catalog-panel"
      aria-labelledby="owned-inventory-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="owned-inventory-title">Owned item inventory</h2>
          <p>Concrete copies with collection status and format signals.</p>
          {total > items.length ? (
            <p className="result-window-note">
              Showing first {items.length} of {total} matches. Refine filters to
              narrow results.
            </p>
          ) : null}
        </div>
      </div>

      <div className="table-scroll">
        <table className="catalog-table workspace-table">
          <thead>
            <tr>
              <th scope="col">Owned item</th>
              <th scope="col">Target</th>
              <th scope="col">Medium</th>
              <th scope="col">Status</th>
              <th scope="col">Storage</th>
              <th scope="col">Condition</th>
              <th scope="col">Signals</th>
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
                <td data-label="Target">{item.target?.subtitle}</td>
                <td data-label="Medium">
                  <span className="badge badge-media">{item.medium}</span>
                </td>
                <td data-label="Status">
                  <StatusBadge item={item}>{item.status}</StatusBadge>
                </td>
                <td data-label="Storage">{item.storage}</td>
                <td data-label="Condition">{item.condition}</td>
                <td data-label="Signals">
                  <SignalBadges signals={item.inventorySignals ?? []} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function SignalBadges({ signals }: { signals: string[] }) {
  if (signals.length === 0) {
    return <span className="badge badge-tag">None</span>
  }

  return (
    <span className="badge-list">
      {signals.map((signal) => (
        <span key={signal} className="badge badge-tag">
          {formatCollectorSignal(signal)}
        </span>
      ))}
    </span>
  )
}

function parseInventorySearchParams(locationSearch: string): {
  selectedItemId: string
  filters: InventoryFilters
} {
  const params = new URLSearchParams(locationSearch)

  return {
    selectedItemId: params.get('ownedItem') ?? '',
    filters: {
      ...emptyFilters,
      status: params.get('status') ?? '',
      medium: params.get('medium') ?? '',
      condition: params.get('condition') ?? '',
      storageLocation: params.get('storageLocation') ?? '',
      inventoryView: params.get('inventoryView') ?? '',
    },
  }
}

function buildInventoryUrl(selectedItemId: string, filters: InventoryFilters) {
  const params = new URLSearchParams()

  if (selectedItemId) {
    params.set('ownedItem', selectedItemId)
  }
  for (const [key, value] of Object.entries(filters)) {
    const trimmed = value.trim()
    if (trimmed) {
      params.set(key, trimmed)
    }
  }

  const search = params.toString()
  return search ? `/owned-items?${search}` : '/owned-items'
}
