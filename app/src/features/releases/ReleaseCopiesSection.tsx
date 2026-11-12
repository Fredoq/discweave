import { useEffect, useRef, useState } from 'react'
import type { CatalogDictionaries } from '../catalog/catalogApi'
import { OwnedItemDetail } from '../ownedItems/OwnedItemDetail'
import { OwnedItemEntryForm } from '../ownedItems/OwnedItemsWorkspace'
import type { OwnedItemRecord } from '../ownedItems/ownedItemsData'
import { ReleaseCopyGroups, ReleaseCopySummaries } from './ReleaseCopyCards'
import type { PlaylistRecord } from '../playlists/playlistsData'
import type { RelationRecord } from '../relations/relationsData'
import type { TrackRecord } from '../tracks/tracksData'
import type { ReleaseRecord } from './releasesData'
import { ReleaseCopyDialog } from './ReleaseCopyDialog'
import './release-copies.css'

export type CopyMutationResult =
  | void
  | boolean
  | string
  | Promise<void | boolean | string>
export type ReleaseCopyActions = {
  onAddOwnedItem?: (item: OwnedItemRecord) => CopyMutationResult
  onUpdateOwnedItem?: (item: OwnedItemRecord) => CopyMutationResult
  onDeleteOwnedItem?: (id: string) => CopyMutationResult
}

const copyDialogTitles = {
  add: 'Add copy',
  edit: 'Edit copy',
  details: 'Copy details',
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
      <ReleaseCopyGroups
        copies={copies}
        busy={busy}
        deletingId={deletingId}
        canEdit={Boolean(onUpdateOwnedItem)}
        canDelete={Boolean(onDeleteOwnedItem)}
        deleteCopy={deleteCopy}
        onOpen={(next) => {
          setError('')
          setDialog(next)
        }}
      />
      <ReleaseCopySummaries copies={summaryCopies} />
      {copies.length + summaryCopies.length === 0 ? (
        <p>No copies recorded for this release.</p>
      ) : null}
      <CopyEditorDialog
        dialog={dialog}
        selectedItem={selectedItem}
        release={release}
        dictionaries={dictionaries}
        items={items}
        playlists={playlists}
        relations={relations}
        tracks={tracks}
        onUpdateOwnedItem={onUpdateOwnedItem}
        onDeleteOwnedItem={onDeleteOwnedItem}
        busy={busy}
        deletingId={deletingId}
        error={error}
        closeDialog={closeDialog}
        save={save}
        deleteCopy={deleteCopy}
        onPendingChange={setSaving}
        openEdit={(id) => setDialog({ mode: 'edit', id })}
      />
    </section>
  )
}

type CopyEditorDialogProps = ReleaseCopiesSectionProps & {
  dialog: CopyDialogState | null
  selectedItem: OwnedItemRecord | undefined
  busy: boolean
  deletingId: string
  error: string
  closeDialog: () => void
  save: (item: OwnedItemRecord) => Promise<void | boolean | string>
  deleteCopy: (item: OwnedItemRecord) => Promise<void>
  onPendingChange: (pending: boolean) => void
  openEdit: (id: string) => void
}

function CopyEditorDialog({
  dialog,
  selectedItem,
  release,
  dictionaries,
  items,
  playlists,
  relations,
  tracks,
  onUpdateOwnedItem,
  onDeleteOwnedItem,
  busy,
  deletingId,
  error,
  closeDialog,
  save,
  deleteCopy,
  onPendingChange,
  openEdit,
}: Readonly<CopyEditorDialogProps>) {
  if (!dialog || (dialog.mode !== 'add' && !selectedItem)) return null
  return (
    <ReleaseCopyDialog
      title={copyDialogTitles[dialog.mode]}
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
                onClick={() => openEdit(selectedItem.id)}
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
          onPendingChange={onPendingChange}
        />
      )}
    </ReleaseCopyDialog>
  )
}
