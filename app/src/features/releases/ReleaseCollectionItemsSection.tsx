import type { CollectionItemDraft } from './ReleaseEntryFormTypes'
import type { OwnedCopy } from './releasesData'

type ReleaseCollectionItemsSectionProps = {
  collectionItems: CollectionItemDraft[]
  mediaTypeOptions: string[]
  onAddItem: () => void
  onRemoveItem: (id: string) => void
  onUpdateItem: (
    id: string,
    field: keyof Pick<CollectionItemDraft, 'status' | 'medium' | 'note'>,
    value: string,
  ) => void
}

const statusOptions: OwnedCopy['status'][] = [
  'Owned',
  'Wanted',
  'Sold',
  'Needs digitization',
]

export function ReleaseCollectionItemsSection({
  collectionItems,
  mediaTypeOptions,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
}: ReleaseCollectionItemsSectionProps) {
  return (
    <section className="manual-entry-wide release-form-section release-collection-items-section">
      <div className="release-form-section-header">
        <div>
          <h3>Collection items</h3>
          <p>
            Track owned copies, wanted targets, and other collection statuses
            for this release.
          </p>
        </div>
        <button
          className="button button-secondary button-compact"
          type="button"
          onClick={onAddItem}
        >
          + Item
        </button>
      </div>
      {collectionItems.length > 0 ? (
        <div
          className="release-collection-items-grid"
          role="table"
          aria-label="Collection items"
        >
          <div className="release-collection-items-heading" role="row">
            <span>Status</span>
            <span>Medium</span>
            <span>Note</span>
            <span className="visually-hidden">Actions</span>
          </div>
          {collectionItems.map((item, index) => (
            <div
              className="release-collection-items-row"
              role="row"
              key={item.id}
            >
              <label>
                <span className="visually-hidden">
                  Collection item {index + 1} status
                </span>
                <select
                  aria-label={`Collection item ${index + 1} status`}
                  value={item.status}
                  onChange={(event) =>
                    onUpdateItem(item.id, 'status', event.target.value)
                  }
                >
                  <option value="">Not recorded</option>
                  {statusOptions.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="visually-hidden">
                  Collection item {index + 1} medium
                </span>
                <select
                  aria-label={`Collection item ${index + 1} medium`}
                  value={item.medium}
                  onChange={(event) =>
                    onUpdateItem(item.id, 'medium', event.target.value)
                  }
                >
                  <option value="">Not recorded</option>
                  {mediaTypeOptions.map((mediaType) => (
                    <option key={mediaType}>{mediaType}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="visually-hidden">
                  Collection item {index + 1} note
                </span>
                <input
                  aria-label={`Collection item ${index + 1} note`}
                  value={item.note}
                  onChange={(event) =>
                    onUpdateItem(item.id, 'note', event.target.value)
                  }
                />
              </label>
              <button
                className="button button-secondary"
                type="button"
                aria-label={`Remove collection item ${index + 1}`}
                onClick={() => onRemoveItem(item.id)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-state">No collection items added.</p>
      )}
    </section>
  )
}
