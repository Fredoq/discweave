import type { OwnedItemRecord } from '../ownedItems/ownedItemsData'
import {
  digitalCoverageSummary,
  isDigitalOwnedItem,
  ownedItemLocationSummary,
  ownedItemStateSummary,
} from '../ownedItems/ownedItemsData'
import type { OwnedCopy } from './releasesData'

type CopyCardActions = {
  busy: boolean
  deletingId: string
  canEdit: boolean
  canDelete: boolean
  onOpen: (dialog: { mode: 'edit' | 'details'; id: string }) => void
  deleteCopy: (item: OwnedItemRecord) => Promise<void>
}

function ReleaseCopyCard({
  item,
  number,
  busy,
  deletingId,
  canEdit,
  canDelete,
  onOpen,
  deleteCopy,
}: Readonly<CopyCardActions & { item: OwnedItemRecord; number: number }>) {
  return (
    <article
      className="copy-card"
      key={item.id}
      aria-label={`Copy ${number}: ${item.medium}`}
    >
      <div className="release-copy__title">
        <strong>{item.medium}</strong>
        <span className="badge badge-tag">{item.status}</span>
      </div>
      <p>
        {isDigitalOwnedItem(item)
          ? `${item.fileFormat} · ${digitalCoverageSummary(item.digitalDetails)}`
          : ownedItemStateSummary(item)}
      </p>
      <p className="release-copy__location">{ownedItemLocationSummary(item)}</p>
      {item.copyNotes ? <p>{item.copyNotes}</p> : null}
      <div className="release-copy__actions">
        <button
          className="button button-secondary"
          type="button"
          aria-label={`Details for copy ${number}`}
          onClick={() => {
            onOpen({ mode: 'details', id: item.id })
          }}
          disabled={busy}
        >
          Details
        </button>
        {canEdit ? (
          <button
            className="button button-secondary"
            type="button"
            aria-label={`Edit copy ${number}`}
            onClick={() => {
              onOpen({ mode: 'edit', id: item.id })
            }}
            disabled={busy}
          >
            Edit
          </button>
        ) : null}
        {canDelete ? (
          <button
            className="button button-danger"
            type="button"
            aria-label={`Delete copy ${number}`}
            onClick={() => {
              void deleteCopy(item)
            }}
            disabled={busy}
          >
            {deletingId === item.id ? 'Deleting…' : 'Delete'}
          </button>
        ) : null}
      </div>
    </article>
  )
}

export function ReleaseCopyGroups({
  copies,
  ...actions
}: Readonly<CopyCardActions & { copies: OwnedItemRecord[] }>) {
  const groups = [
    {
      name: 'Physical',
      items: copies.filter(
        (item) => item.status !== 'Wanted' && !isDigitalOwnedItem(item),
      ),
    },
    {
      name: 'Digital',
      items: copies.filter(
        (item) => item.status !== 'Wanted' && isDigitalOwnedItem(item),
      ),
    },
    {
      name: 'Wanted',
      items: copies.filter((item) => item.status === 'Wanted'),
    },
  ]
  return groups
    .filter((group) => group.items.length > 0)
    .map((group) => (
      <div className="release-copies__group" key={group.name}>
        <h4>{group.name}</h4>
        <div className="copy-list">
          {group.items.map((item) => (
            <ReleaseCopyCard
              key={item.id}
              item={item}
              number={copies.indexOf(item) + 1}
              {...actions}
            />
          ))}
        </div>
      </div>
    ))
}

export function ReleaseCopySummaries({
  copies,
}: Readonly<{ copies: OwnedCopy[] }>) {
  if (copies.length === 0) return null
  return (
    <div className="copy-list">
      {copies.map((copy) => (
        <article className="copy-card" key={copy.id}>
          <div className="release-copy__title">
            <strong>{copy.medium}</strong>
            <span className="badge badge-tag">{copy.status}</span>
          </div>
          {copy.condition ? <p>{copy.condition}</p> : null}
          {copy.storage ? <p>{copy.storage}</p> : null}
          {copy.note ? <p>{copy.note}</p> : null}
          <a
            className="detail-link"
            href={`/owned-items?ownedItem=${encodeURIComponent(copy.id)}`}
          >
            Open in inventory
          </a>
        </article>
      ))}
    </div>
  )
}
