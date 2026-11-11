import { useEffect, useRef, useState } from 'react'
import type { CatalogDictionaries } from '../catalog/catalogApi'
import { OwnedItemDetail } from '../ownedItems/OwnedItemDetail'
import { OwnedItemEntryForm } from '../ownedItems/OwnedItemsWorkspace'
import {
  digitalCoverageSummary,
  isDigitalOwnedItem,
  ownedItemLocationSummary,
  ownedItemStateSummary,
  type OwnedItemRecord,
} from '../ownedItems/ownedItemsData'
import type { PlaylistRecord } from '../playlists/playlistsData'
import type { RelationRecord } from '../relations/relationsData'
import type { TrackRecord } from '../tracks/tracksData'
import type { ReleaseRecord } from './releasesData'
import { ReleaseCopyDialog } from './ReleaseCopyDialog'
import './release-copies.css'

export type CopyMutationResult = void | boolean | Promise<void | boolean>
export type ReleaseCopyActions = {
  onAddOwnedItem?: (item: OwnedItemRecord) => CopyMutationResult
  onUpdateOwnedItem?: (item: OwnedItemRecord) => CopyMutationResult
  onDeleteOwnedItem?: (id: string) => CopyMutationResult
}

type CopyDialogState =
  | { mode: 'add' }
  | { mode: 'edit' | 'details'; id: string }

type ReleaseCopiesSectionProps = ReleaseCopyActions & {
  release: ReleaseRecord
  items: OwnedItemRecord[]
  dictionaries: CatalogDictionaries
  playlists: PlaylistRecord[]
  relations: RelationRecord[]
  tracks: TrackRecord[]
}

export function ReleaseCopiesSection({
  release,
  items,
  dictionaries,
  playlists,
  relations,
  tracks,
  onAddOwnedItem,
  onUpdateOwnedItem,
  onDeleteOwnedItem,
}: Readonly<ReleaseCopiesSectionProps>) {
  const [dialog, setDialog] = useState<CopyDialogState | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [error, setError] = useState('')
  const deletionLock = useRef(false)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const copies = items.filter(
    (item) =>
      (item.releaseId ?? item.targetId ?? item.target?.id) === release.id,
  )
  const copyIds = new Set(copies.map((item) => item.id))
  const summaryCopies = release.ownedCopies.filter(
    (copy) => !copyIds.has(copy.id),
  )
  const selectedItem =
    dialog && dialog.mode !== 'add'
      ? copies.find((item) => item.id === dialog.id)
      : undefined
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
  const busy = saving || Boolean(deletingId)

  function closeDialog() {
    if (!busy) {
      setDialog(null)
      setError('')
    }
  }

  async function save(item: OwnedItemRecord) {
    const action = dialog?.mode === 'edit' ? onUpdateOwnedItem : onAddOwnedItem
    if (!action) return false
    const result = await action(item)
    if (result !== false && mounted.current) setDialog(null)
    return result
  }

  async function deleteCopy(item: OwnedItemRecord) {
    if (!onDeleteOwnedItem || deletionLock.current || saving) return
    if (
      !window.confirm(
        'Delete this copy from the collection? Its file links will be removed, but audio files will not be deleted. This cannot be undone.',
      )
    )
      return
    deletionLock.current = true
    setDeletingId(item.id)
    setError('')
    try {
      const result = await onDeleteOwnedItem(item.id)
      if (!mounted.current) return
      if (result === false)
        setError(
          'The copy could not be deleted. Your collection record is still shown; try again.',
        )
      else setDialog(null)
    } catch {
      if (mounted.current) setError('The copy could not be deleted. Try again.')
    } finally {
      deletionLock.current = false
      if (mounted.current) setDeletingId('')
    }
  }

  return (
    <section
      className="detail-section release-copies"
      aria-labelledby="release-copies-title"
    >
      <div className="release-copies__heading">
        <h3 id="release-copies-title">
          Copies ({copies.length + summaryCopies.length})
        </h3>
        {onAddOwnedItem ? (
          <button
            className="button button-secondary"
            type="button"
            onClick={() => {
              setError('')
              setDialog({ mode: 'add' })
            }}
            disabled={busy}
          >
            Add copy
          </button>
        ) : null}
      </div>
      {error && !dialog ? <p role="alert">{error}</p> : null}
      {groups.map((group) =>
        group.items.length > 0 ? (
          <div className="release-copies__group" key={group.name}>
            <h4>{group.name}</h4>
            <div className="copy-list">
              {group.items.map((item) => {
                const number = copies.indexOf(item) + 1
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
                    <p className="release-copy__location">
                      {ownedItemLocationSummary(item)}
                    </p>
                    {item.copyNotes ? <p>{item.copyNotes}</p> : null}
                    <div className="release-copy__actions">
                      <button
                        className="button button-secondary"
                        type="button"
                        aria-label={`Details for copy ${number}`}
                        onClick={() => {
                          setError('')
                          setDialog({ mode: 'details', id: item.id })
                        }}
                        disabled={busy}
                      >
                        Details
                      </button>
                      {onUpdateOwnedItem ? (
                        <button
                          className="button button-secondary"
                          type="button"
                          aria-label={`Edit copy ${number}`}
                          onClick={() => {
                            setError('')
                            setDialog({ mode: 'edit', id: item.id })
                          }}
                          disabled={busy}
                        >
                          Edit
                        </button>
                      ) : null}
                      {onDeleteOwnedItem ? (
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
              })}
            </div>
          </div>
        ) : null,
      )}
      {summaryCopies.length > 0 ? (
        <div className="copy-list">
          {summaryCopies.map((copy) => (
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
      ) : null}
      {copies.length + summaryCopies.length === 0 ? (
        <p>No copies recorded for this release.</p>
      ) : null}
      {dialog && (dialog.mode === 'add' || selectedItem) ? (
        <ReleaseCopyDialog
          title={
            dialog.mode === 'add'
              ? 'Add copy'
              : dialog.mode === 'edit'
                ? 'Edit copy'
                : 'Copy details'
          }
          busy={busy}
          onClose={closeDialog}
        >
          {error ? <p role="alert">{error}</p> : null}
          {dialog.mode === 'details' && selectedItem ? (
            <>
              <OwnedItemDetail
                item={selectedItem}
                playlists={playlists}
                releases={[release]}
                relations={relations}
                tracks={tracks}
              />
              <div className="release-copy__actions">
                <a
                  className="detail-link"
                  href={`/owned-items?ownedItem=${encodeURIComponent(selectedItem.id)}`}
                >
                  Open in inventory
                </a>
                {onUpdateOwnedItem ? (
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() =>
                      setDialog({ mode: 'edit', id: selectedItem.id })
                    }
                    disabled={busy}
                  >
                    Edit copy
                  </button>
                ) : null}
                {onDeleteOwnedItem ? (
                  <button
                    className="button button-danger"
                    type="button"
                    onClick={() => {
                      void deleteCopy(selectedItem)
                    }}
                    disabled={busy}
                  >
                    {deletingId ? 'Deleting…' : 'Delete copy'}
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <OwnedItemEntryForm
              key={`${release.id}:${selectedItem?.id ?? 'new'}`}
              dictionaries={dictionaries}
              scopedRelease={release}
              initialItem={selectedItem}
              items={items}
              releases={[release]}
              onSubmit={save}
              onCancel={closeDialog}
              onPendingChange={setSaving}
            />
          )}
        </ReleaseCopyDialog>
      ) : null}
    </section>
  )
}
