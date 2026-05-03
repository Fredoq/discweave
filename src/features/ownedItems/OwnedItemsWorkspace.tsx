import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ownedItemRecords, type OwnedItemRecord } from './ownedItemsData'

export function OwnedItemsWorkspace() {
  const [query, setQuery] = useState('')
  const [selectedItemId, setSelectedItemId] = useState(ownedItemRecords[0].id)

  const visibleItems = useMemo(() => {
    const terms = queryTerms(query)

    return ownedItemRecords.filter((item) =>
      terms.every((term) => ownedItemSearchText(item).includes(term)),
    )
  }, [query])

  const selectedItem =
    visibleItems.find((item) => item.id === selectedItemId) ??
    visibleItems[0] ??
    null

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
          <span className="result-count">{visibleItems.length} shown</span>
        </div>
        <OwnedItemsTable
          items={visibleItems}
          selectedItemId={selectedItem?.id ?? ''}
          onSelectItem={setSelectedItemId}
        />
      </div>

      {selectedItem ? (
        <OwnedItemDetail item={selectedItem} />
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

function releaseHref(releaseId: string) {
  return `/releases?release=${encodeURIComponent(releaseId)}`
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

type OwnedItemDetailProps = {
  item: OwnedItemRecord
}

function OwnedItemDetail({ item }: OwnedItemDetailProps) {
  return (
    <aside className="panel detail-panel" aria-labelledby="owned-item-title">
      <div className="detail-header">
        <span className="entity-type">{item.medium}</span>
        <h2 id="owned-item-title">{item.title}</h2>
        <p>{item.artist}</p>
      </div>

      <StatusBadge item={item}>{item.status}</StatusBadge>
      <p className="detail-summary">{item.copyNotes}</p>

      <section className="detail-section" aria-labelledby="owned-linked-title">
        <h3 id="owned-linked-title">Linked catalog item</h3>
        <dl className="detail-list">
          <div>
            <dt>{item.linkedType}</dt>
            <dd>
              <a className="detail-link" href={releaseHref(item.releaseId)}>
                {item.releaseTitle}
              </a>
            </dd>
          </div>
          <div>
            <dt>Artist</dt>
            <dd>{item.artist}</dd>
          </div>
        </dl>
      </section>

      <section className="detail-section" aria-labelledby="owned-state-title">
        <h3 id="owned-state-title">Ownership state</h3>
        <dl className="detail-list">
          <div>
            <dt>Status</dt>
            <dd>{item.status}</dd>
          </div>
          <div>
            <dt>Acquisition</dt>
            <dd>{item.acquisition}</dd>
          </div>
          <div>
            <dt>Tags</dt>
            <dd>
              <BadgeList values={item.tags} />
            </dd>
          </div>
        </dl>
      </section>

      <section
        className="detail-section"
        aria-labelledby="owned-physical-title"
      >
        <h3 id="owned-physical-title">Physical details</h3>
        <dl className="detail-list">
          <div>
            <dt>Medium</dt>
            <dd>{item.medium}</dd>
          </div>
          <div>
            <dt>Storage</dt>
            <dd>{item.storage}</dd>
          </div>
          <div>
            <dt>Condition</dt>
            <dd>{item.condition}</dd>
          </div>
        </dl>
      </section>

      <section className="detail-section" aria-labelledby="owned-digital-title">
        <h3 id="owned-digital-title">Digital and digitization metadata</h3>
        <dl className="detail-list">
          <div>
            <dt>File format</dt>
            <dd>{item.fileFormat}</dd>
          </div>
          <div>
            <dt>Digital state</dt>
            <dd>{item.digitalState}</dd>
          </div>
          <div>
            <dt>Digitization state</dt>
            <dd>{item.digitizationState}</dd>
          </div>
        </dl>
      </section>
    </aside>
  )
}

type StatusBadgeProps = {
  item: OwnedItemRecord
  children: string
}

function StatusBadge({ item, children }: StatusBadgeProps) {
  return (
    <span className={`badge status-badge status-${item.statusTone}`}>
      {children}
    </span>
  )
}

type BadgeListProps = {
  values: string[]
}

function BadgeList({ values }: BadgeListProps) {
  return (
    <span className="badge-list">
      {values.map((value) => (
        <span key={value} className="badge badge-tag">
          {value}
        </span>
      ))}
    </span>
  )
}

function EmptyDetailPanel() {
  return (
    <aside
      className="panel detail-panel empty-detail-panel"
      aria-labelledby="empty-owned-detail-title"
      aria-live="polite"
    >
      <div className="detail-header">
        <span className="entity-type">No selection</span>
        <h2 id="empty-owned-detail-title">No matching owned items.</h2>
      </div>

      <p className="detail-summary">
        Try another release, artist, medium, status, storage or condition.
      </p>
    </aside>
  )
}
