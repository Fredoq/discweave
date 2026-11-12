import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Check, X } from 'lucide-react'
import { createManualRecordId } from '../manualEntry/manualEntryUtils'
import type { TrackRecord } from '../tracks/tracksData'
import type { PlaylistRecord } from './playlistsData'
import { PlaylistSuggestionsPanel } from './PlaylistSuggestionsPanel'
import { usePlaylistNavigationGuard } from './usePlaylistNavigationGuard'
import { playlistTrackFromRecord } from './playlistBuilderModel'

export type PlaylistSave = (
  playlist: PlaylistRecord,
) => void | PlaylistRecord | Promise<void | PlaylistRecord>

type Props = {
  initialPlaylist?: PlaylistRecord
  isNew?: boolean
  tracks?: TrackRecord[]
  onCancel: () => void
  onSubmit: PlaylistSave
}

export function PlaylistEntryForm({
  initialPlaylist,
  isNew = !initialPlaylist,
  tracks = [],
  onCancel,
  onSubmit,
}: Readonly<Props>) {
  const [clientRequestId] = useState(() =>
    isNew ? crypto.randomUUID() : undefined,
  )
  const [name, setName] = useState(initialPlaylist?.name ?? '')
  const [description, setDescription] = useState(
    initialPlaylist?.description ?? '',
  )
  const [entries, setEntries] = useState(
    () =>
      initialPlaylist?.serverEntries ??
      initialPlaylist?.tracks.map((track) => ({
        kind: 'track' as const,
        id: track.id,
        title: track.title,
      })) ??
      [],
  )
  const trackMap = useMemo(() => firstRecordsById(tracks), [tracks])
  const savedTrackMap = useMemo(
    () => firstRecordsById(initialPlaylist?.tracks ?? []),
    [initialPlaylist?.tracks],
  )
  const occurrenceCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const entry of entries)
      counts.set(entry.id, (counts.get(entry.id) ?? 0) + 1)
    return counts
  }, [entries])
  const discardDialogRef = useRef<HTMLDialogElement>(null)
  const keepEditingRef = useRef<HTMLButtonElement>(null)
  const discardChangesRef = useRef<HTMLButtonElement>(null)
  const [addedTitle, setAddedTitle] = useState('')
  const selectionRef = useRef<HTMLOListElement>(null)
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [visibleCount, setVisibleCount] = useState(50)
  const [dirty, setDirty] = useState(isNew)
  const [discard, setDiscard] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  usePlaylistNavigationGuard(dirty, pending)
  const saving = useRef(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  useEffect(() => {
    if (!discard) return
    const previousFocus = document.activeElement
    const dialog = discardDialogRef.current
    if (dialog?.showModal) dialog.showModal()
    else dialog?.setAttribute('open', '')
    keepEditingRef.current?.focus()
    return () => {
      if (dialog?.open) dialog.close?.()
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [discard])
  function change() {
    setDirty(true)
    setError('')
  }
  function move(index: number, delta: number) {
    setEntries((current) => {
      const next = [...current]
      ;[next[index], next[index + delta]] = [next[index + delta], next[index]]
      return next
    })
    change()
  }
  async function save() {
    if (
      saving.current ||
      discard ||
      !name.trim() ||
      initialPlaylist?.type === 'Smart' ||
      entries.some((entry) => entry.kind !== 'track')
    )
      return
    saving.current = true
    setPending(true)
    setError('')
    const record: PlaylistRecord = {
      id: initialPlaylist?.id ?? createManualRecordId('playlist', name),
      clientRequestId,
      name: name.trim(),
      description: description.trim(),
      type: 'Manual',
      curator: '',
      updatedAt: initialPlaylist?.updatedAt ?? '',
      yearRange: '',
      ruleHints: [],
      tracks: entries.flatMap((entry) => {
        const track = trackMap.get(entry.id)
        if (track) return [playlistTrackFromRecord(track)]
        const savedTrack = savedTrackMap.get(entry.id)
        return savedTrack ? [savedTrack] : []
      }),
      linkedReleases: [],
      serverEntries: entries.map((entry) => ({ ...entry })),
      manualSelection: { source: 'Manual track selection', note: '' },
    }
    try {
      await onSubmit(record)
    } catch (reason) {
      if (alive.current)
        setError(
          reason instanceof Error
            ? reason.message
            : 'Could not save. Your changes are still here.',
        )
    } finally {
      saving.current = false
      if (alive.current) setPending(false)
    }
  }
  const matches = tracks.filter((track) =>
    `${track.title} ${track.artist} ${track.release.title}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  )
  let saveStatus = 'All changes saved'
  if (pending) saveStatus = 'Saving…'
  else if (dirty) saveStatus = 'Unsaved changes'

  return (
    <form
      className="playlist-editor"
      aria-label={isNew ? 'Add playlist' : 'Edit playlist'}
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <fieldset disabled={pending}>
        <div className="playlist-heading">
          <div>
            <span className="entity-type">Manual playlist</span>
            <h2>{isNew ? 'New playlist' : 'Edit playlist'}</h2>
          </div>
          <div className="playlist-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={() => (dirty ? setDiscard(true) : onCancel())}
            >
              Cancel
            </button>
            <button
              className="button button-primary"
              disabled={!name.trim() || !dirty}
              type="submit"
            >
              {pending ? 'Saving…' : 'Save playlist'}
            </button>
          </div>
        </div>
        <label className="playlist-field">
          <span>Name</span>
          <input
            required
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              change()
            }}
          />
        </label>
        <label className="playlist-field">
          <span>Description</span>
          <textarea
            rows={2}
            value={description}
            onChange={(event) => {
              setDescription(event.target.value)
              change()
            }}
          />
        </label>
        <output className="playlist-save-status">{saveStatus}</output>
        {error && (
          <div role="alert">
            <p>Could not save. Your changes are still here.</p>
            <p>{error}</p>
            <button type="submit" className="button button-secondary">
              Retry
            </button>
          </div>
        )}
        <div className="playlist-heading">
          <h3>{entries.length} tracks</h3>
          <div className="playlist-actions">
            <button
              type="button"
              className="button button-secondary"
              disabled={suggesting}
              onClick={() => {
                setSuggesting(true)
                setAdding(false)
              }}
            >
              Ask AI
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                setAdding(!adding)
                setSuggesting(false)
                setAddedTitle('')
              }}
            >
              {adding ? 'Close track picker' : 'Add tracks'}
            </button>
          </div>
        </div>
        {suggesting && (
          <PlaylistSuggestionsPanel
            existingTrackIds={entries.map((entry) => entry.id)}
            disabled={pending}
            onClose={() => setSuggesting(false)}
            onAdd={(ids) => {
              const requested = new Set(ids)

              const additions = [...requested]
                .filter((id) => trackMap.has(id) && !occurrenceCounts.has(id))
                .map((id) => ({
                  kind: 'track' as const,
                  id,
                  title: trackMap.get(id)!.title,
                }))
              if (!additions.length) return 0
              setEntries((current) => {
                const currentIds = new Set(current.map((entry) => entry.id))
                return [
                  ...current,
                  ...additions.filter((entry) => !currentIds.has(entry.id)),
                ]
              })
              change()
              setAddedTitle(`${additions.length} suggested tracks`)
              return additions.length
            }}
          />
        )}
        {adding && (
          <section className="playlist-picker" aria-label="Add tracks">
            <label className="playlist-field">
              <span>Search tracks</span>
              <input
                type="search"
                placeholder="Track, artist or album"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div className="playlist-picker-feedback">
              <output aria-live="polite">
                {addedTitle ? `Added “${addedTitle}” · ` : ''}
                {entries.length} tracks in playlist
              </output>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  setAdding(false)
                  requestAnimationFrame(() => {
                    selectionRef.current?.scrollIntoView?.({
                      block: 'start',
                      behavior: 'smooth',
                    })
                    selectionRef.current?.focus()
                  })
                }}
              >
                View playlist
              </button>
            </div>
            <div className="playlist-picker-results">
              {matches.slice(0, visibleCount).map((track) => {
                const occurrences = occurrenceCounts.get(track.id) ?? 0
                return (
                  <div
                    className={`playlist-track ${occurrences ? 'is-in-playlist' : ''}`}
                    key={track.id}
                  >
                    <div>
                      <strong>{track.title}</strong>
                      <span>
                        {track.artist} · {track.release.title}
                      </span>
                      {occurrences > 1 && (
                        <small>
                          {occurrences} existing copies. Manage each one in the
                          playlist.
                        </small>
                      )}
                    </div>
                    <button
                      type="button"
                      className="button button-secondary"
                      disabled={occurrences > 0}
                      aria-label={
                        occurrences
                          ? `In playlist: ${track.title}`
                          : `Add ${track.title}`
                      }
                      onClick={() => {
                        setEntries((current) =>
                          current.some((entry) => entry.id === track.id)
                            ? current
                            : [
                                ...current,
                                {
                                  kind: 'track',
                                  id: track.id,
                                  title: track.title,
                                },
                              ],
                        )
                        setAddedTitle(track.title)
                        change()
                      }}
                    >
                      {occurrences ? (
                        <>
                          <Check size={15} aria-hidden="true" /> In playlist
                        </>
                      ) : (
                        'Add'
                      )}
                    </button>
                  </div>
                )
              })}
              {matches.length > visibleCount && (
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setVisibleCount((count) => count + 50)}
                >
                  Show more tracks ({matches.length - visibleCount} remaining)
                </button>
              )}
              {!matches.length && <p>No matching tracks.</p>}
            </div>
          </section>
        )}
        <p>Removing a track here does not delete it from your collection.</p>
        <ol
          className="playlist-track-list"
          ref={selectionRef}
          tabIndex={-1}
          aria-label="Selected tracks"
        >
          {entries.map((entry, index) => {
            const track = trackMap.get(entry.id)
            return (
              <li className="playlist-track" key={`${index}:${entry.id}`}>
                <span>{index + 1}</span>
                <div>
                  <strong>
                    {track?.title ?? entry.title ?? 'Unavailable track'}
                  </strong>
                  <span>
                    {track
                      ? `${track.artist} · ${track.release.title} · ${track.duration}`
                      : 'Reference preserved; track details unavailable'}
                  </span>
                </div>
                <div className="playlist-actions">
                  <button
                    type="button"
                    aria-label={`Move track ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move track ${index + 1} down`}
                    disabled={index === entries.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove track ${index + 1}`}
                    onClick={() => {
                      setEntries((current) =>
                        current.filter((_, position) => position !== index),
                      )
                      change()
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
        {!entries.length && (
          <p>No tracks yet. Add tracks to start your selection.</p>
        )}
      </fieldset>
      {discard && (
        <dialog
          ref={discardDialogRef}
          aria-label="Discard unsaved changes?"
          role="alertdialog"
          aria-modal="true"
          onCancel={(event) => {
            event.preventDefault()
            setDiscard(false)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              setDiscard(false)
            }
            if (event.key !== 'Tab') return
            const first = keepEditingRef.current
            const last = discardChangesRef.current
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault()
              last?.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault()
              first?.focus()
            }
          }}
        >
          <p>
            Discard unsaved changes? The saved playlist will stay unchanged.
          </p>
          <div className="playlist-actions">
            <button
              ref={keepEditingRef}
              type="button"
              className="button button-secondary"
              onClick={() => setDiscard(false)}
            >
              Keep editing
            </button>
            <button
              ref={discardChangesRef}
              type="button"
              className="button button-secondary"
              onClick={onCancel}
            >
              Discard changes
            </button>
          </div>
        </dialog>
      )}
    </form>
  )
}

function firstRecordsById<T extends { id: string }>(records: readonly T[]) {
  const byId = new Map<string, T>()
  for (const record of records) {
    if (!byId.has(record.id)) byId.set(record.id, record)
  }
  return byId
}
