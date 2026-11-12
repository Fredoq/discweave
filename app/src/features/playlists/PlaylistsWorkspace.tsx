import { DateAddedSortSelect } from '../catalog/DateAddedSortSelect'
import { useDateAddedSort } from '../catalog/dateAddedSort'
import { useEffect, useRef, useState } from 'react'
import type { ArtistRecord } from '../artists/artistsData'
import type { EntityRating, RatingCriterion } from '../catalog/catalogApi'
import { useCatalogSelection } from '../catalog/useCatalogSelection'
import type { OwnedItemRecord } from '../ownedItems/ownedItemsData'
import type { ReleaseRecord } from '../releases/releasesData'
import type { TrackRecord } from '../tracks/tracksData'
import { createManualRecordId } from '../manualEntry/manualEntryUtils'
import { PlaylistEntryForm, type PlaylistSave } from './PlaylistEntryForm'
import { PlaylistViewModeSwitch } from './PlaylistViewModeSwitch'
import { RatingShowcasesView } from './RatingShowcasesView'
import {
  projectPlaylistTracks,
  createTrackOnlyPlaylistCopy,
} from './playlistBuilderModel'
import type { PlaylistRecord } from './playlistsData'
import './playlist-builder.css'

type Props = {
  artists?: ArtistRecord[]
  isManualEntryOpen?: boolean
  locationSearch?: string
  onAddPlaylist?: PlaylistSave
  onUpdatePlaylist?: PlaylistSave
  onDeletePlaylist?: (playlistId: string) => void
  onManualEntryClose?: () => void
  ownedItems?: OwnedItemRecord[]
  playlists?: PlaylistRecord[]
  ratings?: EntityRating[]
  releases?: ReleaseRecord[]
  tracks?: TrackRecord[]
  ratingCriteria?: RatingCriterion[]
}
export function PlaylistsWorkspace({
  artists = [],
  isManualEntryOpen = false,
  locationSearch = window.location.search,
  onAddPlaylist,
  onUpdatePlaylist,
  onDeletePlaylist,
  onManualEntryClose = () => {},
  playlists: controlledPlaylists,
  ratings = [],
  releases = [],
  tracks = [],
  ratingCriteria = [],
}: Readonly<Props>) {
  const [viewMode, setViewMode] = useState<'playlists' | 'ratings'>('playlists')
  const [query, setQuery] = useState('')
  const [fallback, setFallback] = useState<PlaylistRecord[]>([])
  const [editing, setEditing] = useState<{
    record?: PlaylistRecord
    creating: boolean
  } | null>(null)
  const playlists = controlledPlaylists ?? fallback
  const filtered = filterPlaylists(query, playlists)
  const {
    sort,
    setSort,
    sortedRecords: visible,
  } = useDateAddedSort(filtered, 'playlists')
  const { selectedRecord: selected, selectRecord } = useCatalogSelection({
    locationSearch,
    queryParam: 'playlist',
    records: playlists,
    visibleRecords: visible,
    routePath: '/playlists',
  })
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const open = editing !== null || isManualEntryOpen
  const projection = selected
    ? projectPlaylistTracks(selected, releases, tracks)
    : null
  function close() {
    setEditing(null)
    onManualEntryClose()
  }
  async function save(record: PlaylistRecord) {
    const creating = editing?.creating ?? true
    const callback = creating ? onAddPlaylist : onUpdatePlaylist
    const result = callback ? await callback(record) : record
    if (!alive.current) return
    const saved = result ?? record
    if (!controlledPlaylists)
      setFallback((current) =>
        creating
          ? [...current, saved]
          : current.map((item) => (item.id === saved.id ? saved : item)),
      )
    setQuery('')
    selectRecord(saved.id)
    close()
  }
  if (viewMode === 'ratings')
    return (
      <RatingShowcasesView
        artists={artists}
        onViewModeChange={setViewMode}
        ratings={ratings}
        ratingCriteria={ratingCriteria}
        releases={releases}
        tracks={tracks}
      />
    )
  return (
    <section className="playlist-workspace" aria-label="Playlists workspace">
      <aside className="panel playlist-index">
        <div className="playlist-heading">
          <h2>Playlists</h2>
          <button
            className="button button-secondary"
            disabled={open}
            onClick={() => setEditing({ creating: true })}
          >
            New playlist
          </button>
        </div>
        <label className="playlist-field">
          Search playlists
          <input
            type="search"
            value={query}
            disabled={open}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <fieldset disabled={open} className="playlist-index-controls">
          <DateAddedSortSelect value={sort} onChange={setSort} />
          <div aria-disabled={open}>
            <PlaylistViewModeSwitch
              mode={viewMode}
              onModeChange={(mode) => {
                if (!open) setViewMode(mode)
              }}
            />
          </div>
        </fieldset>
        <div className="playlist-index-list">
          {visible.map((playlist) => (
            <button
              key={playlist.id}
              disabled={open}
              className={playlist.id === selected?.id ? 'is-selected' : ''}
              aria-pressed={playlist.id === selected?.id}
              onClick={() => selectRecord(playlist.id)}
            >
              <strong>{playlist.name}</strong>
              <span>{playlist.type}</span>
            </button>
          ))}
        </div>
        {!visible.length && <p>No playlists found.</p>}
      </aside>
      <section className="panel playlist-content">
        {open ? (
          <PlaylistEntryForm
            key={editing?.record?.id ?? 'new'}
            initialPlaylist={editing?.record}
            isNew={editing?.creating ?? true}
            tracks={tracks}
            onCancel={close}
            onSubmit={save}
          />
        ) : selected && projection ? (
          <>
            <div className="playlist-heading">
              <div>
                <span className="entity-type">{selected.type} playlist</span>
                <h2>{selected.name}</h2>
                <p>{selected.description}</p>
              </div>
              {selected.type === 'Manual' && !projection.legacy && (
                <button
                  className="button button-secondary"
                  onClick={() =>
                    setEditing({ record: selected, creating: false })
                  }
                >
                  Edit playlist
                </button>
              )}
            </div>
            {selected.type === 'Manual' &&
              (onDeletePlaylist || !controlledPlaylists) && (
                <div className="playlist-actions">
                  <button
                    className="button button-danger"
                    type="button"
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Delete playlist “${selected.name}”? This removes only the playlist. Tracks and releases in your collection will not be deleted. This cannot be undone.`,
                        )
                      )
                        return
                      if (onDeletePlaylist) onDeletePlaylist(selected.id)
                      else
                        setFallback((current) =>
                          current.filter(
                            (playlist) => playlist.id !== selected.id,
                          ),
                        )
                    }}
                  >
                    Delete playlist
                  </button>
                </div>
              )}
            {selected.type === 'Smart' && (
              <section className="playlist-notice">
                <h3>Smart rules</h3>
                <p>{selected.smartRules.summary}</p>
                <ul>
                  {selected.smartRules.criteria.map((rule, index) => (
                    <li key={index}>{rule}</li>
                  ))}
                </ul>
                <p>Read-only. Existing rules and results are preserved.</p>
              </section>
            )}
            {selected.type === 'Manual' && projection.legacy && (
              <section className="playlist-notice">
                <h3>Original playlist preserved</h3>
                <p>
                  This playlist contains older release references. Tracks are
                  shown in their original order. Opening it does not change the
                  saved playlist.
                </p>
                <button
                  className="button button-secondary"
                  disabled={!projection.canCopy}
                  onClick={() => {
                    const copy = createTrackOnlyPlaylistCopy(
                      selected,
                      projection,
                      createManualRecordId('playlist', selected.name + ' copy'),
                    )
                    if (copy) setEditing({ record: copy, creating: true })
                  }}
                >
                  Create a track-only copy
                </button>
                <p>
                  Review the copy, then save it as a new playlist. The original
                  stays unchanged.
                </p>
              </section>
            )}
            {projection.problems.length > 0 && (
              <section role="status" className="playlist-notice">
                <h3>Some tracks could not be resolved</h3>
                <ul>
                  {projection.problems.map((problem, index) => (
                    <li key={index}>{problem}</li>
                  ))}
                </ul>
                <p>No references have been removed or replaced.</p>
              </section>
            )}
            <h3>{projection.rows.length} track rows</h3>
            <ol className="playlist-track-list">
              {projection.rows.map((row, index) => (
                <li className="playlist-track" key={row.key}>
                  <span>{index + 1}</span>
                  <div>
                    {row.trackId ? (
                      <a
                        href={`/tracks?track=${encodeURIComponent(row.trackId)}`}
                      >
                        {row.title}
                      </a>
                    ) : (
                      <strong>{row.title}</strong>
                    )}
                    <span>
                      {row.artist} · {row.releaseTitle}{' '}
                      {row.duration && `· ${row.duration}`}
                    </span>
                    {row.problem && <small>{row.problem}</small>}
                  </div>
                </li>
              ))}
            </ol>
            {!projection.rows.length && <p>No tracks in this playlist yet.</p>}
          </>
        ) : (
          <div className="playlist-empty">
            <h2>Your selections, in your order</h2>
            <p>Create a playlist and add tracks from your collection.</p>
          </div>
        )}
      </section>
    </section>
  )
}

function queryTerms(query: string) {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean)
}

function filterPlaylists(query: string, playlists: PlaylistRecord[]) {
  const terms = queryTerms(query)

  return playlists.filter((playlist) =>
    terms.every((term) => playlistSearchText(playlist).includes(term)),
  )
}

function playlistSearchText(playlist: PlaylistRecord) {
  const selectionText =
    playlist.type === 'Manual'
      ? [playlist.manualSelection.source, playlist.manualSelection.note]
      : [playlist.smartRules.summary, ...playlist.smartRules.criteria]

  return [
    playlist.name,
    playlist.type,
    playlist.description,
    playlist.curator,
    playlist.updatedAt,
    playlist.yearRange,
    ...selectionText,
    ...playlist.ruleHints,
    ...playlist.tracks.flatMap((track) => [
      track.title,
      track.artist,
      track.release.title,
      track.release.artist,
      track.release.year,
      track.release.label,
      track.trackNumber,
      track.duration,
      track.fileFormat,
      track.availability,
      ...track.tags,
      ...track.media,
      ...track.ownershipStatus,
    ]),
    ...playlist.linkedReleases.flatMap((release) => [
      release.title,
      release.artist,
      release.year,
      release.availability,
      ...release.media,
      ...release.ownershipStatus,
    ]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}
