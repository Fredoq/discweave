import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { isManualSessionRecord } from '../manualEntry/manualEntryUtils'
import { FilterSelect } from '../catalog/FilterSelect'
import { uniqueValues } from '../catalog/catalogGraph'
import type { EntityRating, RatingCriterion } from '../catalog/catalogApi'
import { useCatalogSelection } from '../catalog/useCatalogSelection'
import type { ArtistRecord } from '../artists/artistsData'
import type { OwnedItemRecord } from '../ownedItems/ownedItemsData'
import type { ReleaseRecord } from '../releases/releasesData'
import type { TrackRecord } from '../tracks/tracksData'
import { BadgeList, EmptyDetailPanel, PlaylistDetail } from './PlaylistDetail'
import { PlaylistEntryForm } from './PlaylistEntryForm'
import { PlaylistViewModeSwitch } from './PlaylistViewModeSwitch'
import { RatingShowcasesView } from './RatingShowcasesView'
import { type PlaylistRecord } from './playlistsData'

type PlaylistsWorkspaceProps = {
  artists?: ArtistRecord[]
  isManualEntryOpen?: boolean
  locationSearch?: string
  onAddPlaylist?: (playlist: PlaylistRecord) => void
  onDeletePlaylist?: (playlistId: string) => void
  onUpdatePlaylist?: (playlist: PlaylistRecord) => void
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
  onDeletePlaylist,
  onUpdatePlaylist,
  onManualEntryClose = () => {},
  ownedItems = [],
  playlists: controlledPlaylists,
  ratings = [],
  releases = [],
  tracks = [],
  ratingCriteria = [],
}: PlaylistsWorkspaceProps) {
  const [viewMode, setViewMode] = useState<'playlists' | 'ratings'>('playlists')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({
    type: '',
    rule: '',
    referenceLink: '',
  })
  const [fallbackPlaylists, setFallbackPlaylists] = useState<PlaylistRecord[]>(
    [],
  )
  const [editingPlaylistId, setEditingPlaylistId] = useState('')
  const playlists = controlledPlaylists ?? fallbackPlaylists

  const visiblePlaylists = useMemo(() => {
    return filterPlaylists(query, playlists).filter(
      (playlist) =>
        (!filters.type || playlist.type === filters.type) &&
        (!filters.rule || playlist.ruleHints.includes(filters.rule)) &&
        (!filters.referenceLink ||
          (filters.referenceLink === 'Linked'
            ? hasLinkedPlaylistReferences(playlist, releases, tracks)
            : !hasLinkedPlaylistReferences(playlist, releases, tracks))),
    )
  }, [filters, playlists, query, releases, tracks])
  const { selectedRecord: selectedPlaylist, selectRecord: selectPlaylist } =
    useCatalogSelection({
      locationSearch,
      queryParam: 'playlist',
      records: playlists,
      routePath: '/playlists',
      visibleRecords: visiblePlaylists,
    })

  function handleQueryChange(nextQuery: string) {
    setQuery(nextQuery)
  }

  function handleAddPlaylist(playlist: PlaylistRecord) {
    if (onAddPlaylist) {
      onAddPlaylist(playlist)
    } else {
      setFallbackPlaylists((currentPlaylists) => [
        ...currentPlaylists,
        playlist,
      ])
    }

    setQuery('')
    selectPlaylist(playlist.id)
    onManualEntryClose()
  }

  function handleUpdatePlaylist(playlist: PlaylistRecord) {
    if (onUpdatePlaylist) {
      onUpdatePlaylist(playlist)
    } else {
      setFallbackPlaylists((currentPlaylists) =>
        currentPlaylists.map((currentPlaylist) =>
          currentPlaylist.id === playlist.id ? playlist : currentPlaylist,
        ),
      )
    }

    setQuery('')
    selectPlaylist(playlist.id)
    setEditingPlaylistId('')
  }

  function handleDeletePlaylist(playlistId: string) {
    if (onDeletePlaylist) {
      onDeletePlaylist(playlistId)
    } else {
      setFallbackPlaylists((currentPlaylists) =>
        currentPlaylists.filter((playlist) => playlist.id !== playlistId),
      )
    }

    setQuery('')
    setEditingPlaylistId('')
  }

  const editingPlaylist = playlists.find(
    (playlist) => playlist.id === editingPlaylistId,
  )

  if (viewMode === 'ratings') {
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
  }

  return (
    <section className="catalog-layout" aria-label="Playlists workspace">
      <div className="catalog-main">
        <SearchField
          label="Search playlists"
          placeholder="Name, type, track, artist, release, tags, year range, format, status or rule"
          query={query}
          onQueryChange={handleQueryChange}
        />
        <div className="filter-bar">
          <PlaylistViewModeSwitch mode={viewMode} onModeChange={setViewMode} />
          <FilterSelect
            label="Playlist type"
            value={filters.type}
            values={['Manual', 'Smart']}
            onChange={(type) => setFilters((current) => ({ ...current, type }))}
          />
          <FilterSelect
            label="Tag or rule type"
            value={filters.rule}
            values={uniqueValues(
              playlists.flatMap((playlist) => playlist.ruleHints),
            )}
            onChange={(rule) => setFilters((current) => ({ ...current, rule }))}
          />
          <FilterSelect
            label="Reference links"
            value={filters.referenceLink}
            values={['Linked', 'Unlinked']}
            onChange={(referenceLink) =>
              setFilters((current) => ({ ...current, referenceLink }))
            }
          />
          <span className="result-count">{visiblePlaylists.length} shown</span>
        </div>
        {isManualEntryOpen ? (
          <PlaylistEntryForm
            onCancel={onManualEntryClose}
            onSubmit={handleAddPlaylist}
          />
        ) : null}
        {editingPlaylist ? (
          <PlaylistEntryForm
            initialPlaylist={editingPlaylist}
            key={editingPlaylist.id}
            onCancel={() => setEditingPlaylistId('')}
            onSubmit={handleUpdatePlaylist}
          />
        ) : null}
        <PlaylistsTable
          playlists={visiblePlaylists}
          selectedPlaylistId={selectedPlaylist?.id ?? ''}
          onSelectPlaylist={selectPlaylist}
        />
      </div>

      {selectedPlaylist ? (
        <PlaylistDetail
          artists={artists}
          onEdit={
            onUpdatePlaylist || isManualSessionRecord(selectedPlaylist.id)
              ? () => setEditingPlaylistId(selectedPlaylist.id)
              : undefined
          }
          onDelete={
            onDeletePlaylist || isManualSessionRecord(selectedPlaylist.id)
              ? () => handleDeletePlaylist(selectedPlaylist.id)
              : undefined
          }
          ownedItems={ownedItems}
          playlist={selectedPlaylist}
          releases={releases}
          tracks={tracks}
        />
      ) : (
        <EmptyDetailPanel />
      )}
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

function hasLinkedPlaylistReferences(
  playlist: PlaylistRecord,
  releases: ReleaseRecord[],
  tracks: TrackRecord[],
) {
  return (
    playlist.tracks.some((playlistTrack) =>
      tracks.some((track) => track.id === playlistTrack.id),
    ) ||
    playlist.linkedReleases.some((linkedRelease) =>
      releases.some((release) => release.id === linkedRelease.releaseId),
    )
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

type PlaylistsTableProps = {
  playlists: PlaylistRecord[]
  selectedPlaylistId: string
  onSelectPlaylist: (playlistId: string) => void
}

function PlaylistsTable({
  playlists,
  selectedPlaylistId,
  onSelectPlaylist,
}: PlaylistsTableProps) {
  return (
    <section
      className="panel catalog-panel"
      aria-labelledby="playlist-results-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="playlist-results-title">Playlist records</h2>
          <p>
            Manual and smart playlists are catalog criteria, not playback
            queues.
          </p>
        </div>
      </div>

      <div className="table-scroll">
        <table className="catalog-table workspace-table">
          <thead>
            <tr>
              <th scope="col">Playlist</th>
              <th scope="col">Type</th>
              <th scope="col">Tracks</th>
              <th scope="col">Year range</th>
              <th scope="col">Rules</th>
              <th scope="col">Availability</th>
            </tr>
          </thead>
          <tbody>
            {playlists.map((playlist) => (
              <tr
                key={playlist.id}
                aria-selected={playlist.id === selectedPlaylistId}
                className={
                  playlist.id === selectedPlaylistId ? 'is-selected' : undefined
                }
              >
                <th scope="row">
                  <button
                    className="row-title"
                    type="button"
                    onClick={() => onSelectPlaylist(playlist.id)}
                  >
                    <strong>{playlist.name}</strong>
                    <span>{playlist.description}</span>
                  </button>
                </th>
                <td data-label="Type">
                  <span className="badge badge-tag">{playlist.type}</span>
                </td>
                <td data-label="Tracks">{playlist.tracks.length}</td>
                <td data-label="Year range">{playlist.yearRange}</td>
                <td data-label="Rules">
                  <BadgeList values={playlist.ruleHints.slice(0, 3)} />
                </td>
                <td data-label="Availability">
                  <BadgeList
                    values={[
                      ...new Set(
                        playlist.linkedReleases.flatMap(
                          (release) => release.ownershipStatus,
                        ),
                      ),
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
