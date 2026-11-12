import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, X } from 'lucide-react'
import { createManualRecordId } from '../manualEntry/manualEntryUtils'
import type { TrackRecord } from '../tracks/tracksData'
import type { PlaylistRecord } from './playlistsData'
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
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
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
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
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
      name: name.trim(),
      description: description.trim(),
      type: 'Manual',
      curator: '',
      updatedAt: initialPlaylist?.updatedAt ?? '',
      yearRange: '',
      ruleHints: [],
      tracks: entries.flatMap((entry) => {
        const track = tracks.find((track) => track.id === entry.id)
        return track
          ? [playlistTrackFromRecord(track)]
          : (initialPlaylist?.tracks
              .filter((track) => track.id === entry.id)
              .slice(0, 1) ?? [])
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
  return (
    <form
      className="playlist-editor"
      aria-label={initialPlaylist ? 'Edit playlist' : 'Add playlist'}
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <fieldset disabled={pending}>
        <div className="playlist-heading">
          <div>
            <span className="entity-type">Manual playlist</span>
            <h2>{initialPlaylist ? 'Edit playlist' : 'New playlist'}</h2>
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
          Name
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
          Description
          <textarea
            rows={2}
            value={description}
            onChange={(event) => {
              setDescription(event.target.value)
              change()
            }}
          />
        </label>
        <p role="status">
          {pending
            ? 'Saving…'
            : dirty
              ? 'Unsaved changes'
              : 'All changes saved'}
        </p>
        {error && (
          <div role="alert">
            <p>Could not save. Your changes are still here.</p>
            <p>{error}</p>
            <button type="submit" className="button button-secondary">
              Retry
            </button>
          </div>
        )}
        {discard && (
          <section role="alertdialog" aria-label="Discard unsaved changes?">
            <p>
              Discard unsaved changes? The saved playlist will stay unchanged.
            </p>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setDiscard(false)}
            >
              Keep editing
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={onCancel}
            >
              Discard changes
            </button>
          </section>
        )}
        <div className="playlist-heading">
          <h3>{entries.length} tracks</h3>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setAdding(!adding)}
          >
            {adding ? 'Close track picker' : 'Add tracks'}
          </button>
        </div>
        {adding && (
          <section className="playlist-picker" aria-label="Add tracks">
            <label className="playlist-field">
              Search tracks
              <input
                type="search"
                placeholder="Track, artist or album"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div className="playlist-picker-results">
              {matches.slice(0, visibleCount).map((track) => (
                <div className="playlist-track" key={track.id}>
                  <div>
                    <strong>{track.title}</strong>
                    <span>
                      {track.artist} · {track.release.title}
                    </span>
                    {entries.some((entry) => entry.id === track.id) && (
                      <small>
                        Already in playlist; adds another occurrence
                      </small>
                    )}
                  </div>
                  <button
                    type="button"
                    className="button button-secondary"
                    aria-label={`Add ${track.title}`}
                    onClick={() => {
                      setEntries((current) => [
                        ...current,
                        { kind: 'track', id: track.id, title: track.title },
                      ])
                      change()
                    }}
                  >
                    Add
                  </button>
                </div>
              ))}
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
        <ol className="playlist-track-list">
          {entries.map((entry, index) => {
            const track = tracks.find((track) => track.id === entry.id)
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
    </form>
  )
}
