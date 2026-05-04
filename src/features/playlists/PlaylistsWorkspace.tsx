import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ManualEntryPanel } from '../manualEntry/ManualEntryPanel'
import {
  createManualRecordId,
  splitCommaList,
  textOrFallback,
} from '../manualEntry/manualEntryUtils'
import { FilterSelect } from '../catalog/FilterSelect'
import { playlistTouchesArtist, uniqueValues } from '../catalog/catalogGraph'
import { useCatalogSelection } from '../catalog/useCatalogSelection'
import type { ArtistRecord } from '../artists/artistsData'
import type { OwnedItemRecord } from '../ownedItems/ownedItemsData'
import { releaseRecords, type ReleaseRecord } from '../releases/releasesData'
import { trackRecords, type TrackRecord } from '../tracks/tracksData'
import {
  playlistRecords,
  type LinkedReleaseAvailability,
  type PlaylistRecord,
  type PlaylistTrack,
  type PlaylistType,
} from './playlistsData'

type PlaylistsWorkspaceProps = {
  artists?: ArtistRecord[]
  isManualEntryOpen?: boolean
  locationSearch?: string
  onAddPlaylist?: (playlist: PlaylistRecord) => void
  onManualEntryClose?: () => void
  ownedItems?: OwnedItemRecord[]
  playlists?: PlaylistRecord[]
  releases?: ReleaseRecord[]
  tracks?: TrackRecord[]
}

export function PlaylistsWorkspace({
  artists = [],
  isManualEntryOpen = false,
  locationSearch = window.location.search,
  onAddPlaylist,
  onManualEntryClose = () => {},
  ownedItems = [],
  playlists: controlledPlaylists,
  releases = releaseRecords,
  tracks = trackRecords,
}: PlaylistsWorkspaceProps) {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({
    type: '',
    rule: '',
    referenceLink: '',
  })
  const [fallbackPlaylists, setFallbackPlaylists] = useState<PlaylistRecord[]>(
    () => playlistRecords,
  )
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
        <PlaylistsTable
          playlists={visiblePlaylists}
          selectedPlaylistId={selectedPlaylist?.id ?? ''}
          onSelectPlaylist={selectPlaylist}
        />
      </div>

      {selectedPlaylist ? (
        <PlaylistDetail
          artists={artists}
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

type PlaylistEntryFormProps = {
  onCancel: () => void
  onSubmit: (playlist: PlaylistRecord) => void
}

function PlaylistEntryForm({ onCancel, onSubmit }: PlaylistEntryFormProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<PlaylistType>('Manual')
  const [description, setDescription] = useState('')
  const [curator, setCurator] = useState('')
  const [selectionNote, setSelectionNote] = useState('')
  const [criteria, setCriteria] = useState('')
  const isValid = name.trim().length > 0

  function handleSubmit() {
    const playlistName = name.trim()
    const ruleHints = splitCommaList(criteria)
    const baseRecord = {
      id: createManualRecordId('playlist', playlistName),
      name: playlistName,
      description: textOrFallback(description, 'Manual playlist draft.'),
      curator: textOrFallback(curator, 'Default collection'),
      updatedAt: 'Manual entry',
      yearRange: 'Not recorded',
      ruleHints,
      tracks: [],
      linkedReleases: [],
    }

    if (type === 'Manual') {
      onSubmit({
        ...baseRecord,
        type,
        manualSelection: {
          source: 'Manual track selection',
          note: textOrFallback(
            selectionNote,
            'No manual selection note recorded.',
          ),
        },
      })
      return
    }

    onSubmit({
      ...baseRecord,
      type,
      smartRules: {
        summary: textOrFallback(
          selectionNote,
          'No smart rule summary recorded.',
        ),
        criteria: ruleHints.length > 0 ? ruleHints : ['No criteria recorded.'],
      },
    })
  }

  return (
    <ManualEntryPanel
      title="Add playlist"
      requiredMessage="Name is required."
      isValid={isValid}
      onCancel={onCancel}
      onSubmit={handleSubmit}
    >
      <label>
        <span>Name</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </label>
      <label>
        <span>Type</span>
        <select
          value={type}
          onChange={(event) => setType(event.target.value as PlaylistType)}
        >
          <option>Manual</option>
          <option>Smart</option>
        </select>
      </label>
      <label>
        <span>Description</span>
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <label>
        <span>Curator</span>
        <input
          value={curator}
          onChange={(event) => setCurator(event.target.value)}
        />
      </label>
      <label className="manual-entry-wide">
        <span>Rule or manual selection note</span>
        <textarea
          value={selectionNote}
          onChange={(event) => setSelectionNote(event.target.value)}
          rows={3}
        />
      </label>
      <label className="manual-entry-wide">
        <span>Tags/criteria</span>
        <input
          value={criteria}
          onChange={(event) => setCriteria(event.target.value)}
        />
      </label>
    </ManualEntryPanel>
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

function releaseHref(releaseId: string) {
  return `/releases?release=${encodeURIComponent(releaseId)}`
}

function trackHref(trackId: string) {
  return `/tracks?track=${encodeURIComponent(trackId)}`
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

type PlaylistDetailProps = {
  artists: ArtistRecord[]
  ownedItems: OwnedItemRecord[]
  playlist: PlaylistRecord
  releases: ReleaseRecord[]
  tracks: TrackRecord[]
}

function PlaylistDetail({
  artists,
  ownedItems,
  playlist,
  releases,
  tracks,
}: PlaylistDetailProps) {
  const relatedArtists = artists.filter((artist) =>
    playlistTouchesArtist(playlist, artist),
  )
  const relatedOwnedItems = ownedItems.filter((item) =>
    playlist.linkedReleases.some(
      (release) => release.releaseId === item.releaseId,
    ),
  )

  return (
    <aside className="panel detail-panel" aria-labelledby="playlist-title">
      <div className="detail-header">
        <span className="entity-type">{playlist.type} playlist</span>
        <h2 id="playlist-title">{playlist.name}</h2>
        <p>{playlist.curator}</p>
      </div>

      <p className="detail-summary">{playlist.description}</p>

      <section
        className="detail-section"
        aria-labelledby="playlist-metadata-title"
      >
        <h3 id="playlist-metadata-title">Playlist metadata</h3>
        <dl className="detail-list">
          <div>
            <dt>Type</dt>
            <dd>{playlist.type}</dd>
          </div>
          <div>
            <dt>Track count</dt>
            <dd>{playlist.tracks.length}</dd>
          </div>
          <div>
            <dt>Year range</dt>
            <dd>{playlist.yearRange}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{playlist.updatedAt}</dd>
          </div>
        </dl>
      </section>

      <section className="detail-section" aria-labelledby="playlist-tracks">
        <h3 id="playlist-tracks">Tracks</h3>
        <div className="relation-list">
          {playlist.tracks.map((track) => (
            <TrackCard
              key={track.id}
              knownReleases={releases}
              knownTracks={tracks}
              track={track}
            />
          ))}
        </div>
      </section>

      <section className="detail-section" aria-labelledby="playlist-rules">
        <h3 id="playlist-rules">Smart rules / manual selection</h3>
        {playlist.type === 'Manual' ? (
          <dl className="detail-list">
            <div>
              <dt>Selection mode</dt>
              <dd>{playlist.manualSelection.source}</dd>
            </div>
            <div>
              <dt>Selection note</dt>
              <dd>{playlist.manualSelection.note}</dd>
            </div>
          </dl>
        ) : null}
        {playlist.type === 'Smart' ? (
          <div className="copy-list">
            <article className="copy-card">
              <strong>{playlist.smartRules.summary}</strong>
              <ul className="criteria-list">
                {playlist.smartRules.criteria.map((criterion) => (
                  <li key={criterion}>{criterion}</li>
                ))}
              </ul>
            </article>
          </div>
        ) : null}
      </section>

      <section
        className="detail-section"
        aria-labelledby="playlist-availability"
      >
        <h3 id="playlist-availability">
          Linked releases and owned availability
        </h3>
        <div className="copy-list">
          {playlist.linkedReleases.map((release) => (
            <ReleaseAvailabilityCard
              key={release.releaseId}
              knownReleases={releases}
              release={release}
            />
          ))}
        </div>
      </section>

      <section className="detail-section" aria-labelledby="playlist-graph">
        <h3 id="playlist-graph">Related catalog context</h3>
        <div className="relation-list">
          {relatedArtists.length > 0 || relatedOwnedItems.length > 0 ? (
            <>
              {relatedArtists.map((artist) => (
                <article key={artist.id}>
                  <span className="badge badge-credit">Artist</span>
                  <a
                    className="detail-link"
                    href={`/artists?artist=${encodeURIComponent(artist.id)}`}
                  >
                    {artist.name}
                  </a>
                  <p>{artist.creditHint}</p>
                </article>
              ))}
              {relatedOwnedItems.map((item) => (
                <article key={item.id}>
                  <span className="badge badge-media">{item.medium}</span>
                  <a
                    className="detail-link"
                    href={`/owned-items?ownedItem=${encodeURIComponent(item.id)}`}
                  >
                    {item.title}
                  </a>
                  <p>
                    {item.status} · {item.storage}
                  </p>
                </article>
              ))}
            </>
          ) : (
            <p>No related artists or owned items found yet.</p>
          )}
        </div>
      </section>
    </aside>
  )
}

type TrackCardProps = {
  knownReleases: ReleaseRecord[]
  knownTracks: TrackRecord[]
  track: PlaylistTrack
}

function TrackCard({ knownReleases, knownTracks, track }: TrackCardProps) {
  const linkedTrackExists = knownTracks.some((record) => record.id === track.id)
  const linkedReleaseExists = knownReleases.some(
    (record) => record.id === track.release.id,
  )

  return (
    <article>
      <span className="badge badge-media">{track.fileFormat}</span>
      <strong>
        {linkedTrackExists ? (
          <a className="detail-link" href={trackHref(track.id)}>
            {track.title}
          </a>
        ) : (
          track.title
        )}
      </strong>
      <p>
        {track.artist} ·{' '}
        {linkedReleaseExists ? (
          <a className="detail-link" href={releaseHref(track.release.id)}>
            {track.release.title}
          </a>
        ) : (
          track.release.title
        )}{' '}
        · {track.release.year}
      </p>
      <p>{track.availability}</p>
      <BadgeList values={[...track.tags, ...track.media]} />
    </article>
  )
}

type ReleaseAvailabilityCardProps = {
  knownReleases: ReleaseRecord[]
  release: LinkedReleaseAvailability
}

function ReleaseAvailabilityCard({
  knownReleases,
  release,
}: ReleaseAvailabilityCardProps) {
  const linkedReleaseExists = knownReleases.some(
    (record) => record.id === release.releaseId,
  )

  return (
    <article className="copy-card">
      <div>
        <strong>
          {linkedReleaseExists ? (
            <a className="detail-link" href={releaseHref(release.releaseId)}>
              {release.title}
            </a>
          ) : (
            release.title
          )}
        </strong>
        <span>{release.year}</span>
      </div>
      <dl className="detail-list">
        <div>
          <dt>Artist</dt>
          <dd>{release.artist}</dd>
        </div>
        <div>
          <dt>Media</dt>
          <dd>
            <BadgeList values={release.media} variant="media" />
          </dd>
        </div>
        <div>
          <dt>Owned availability</dt>
          <dd>
            <BadgeList values={release.ownershipStatus} />
          </dd>
        </div>
      </dl>
      <p>{release.availability}</p>
    </article>
  )
}

type BadgeListProps = {
  values: string[]
  variant?: 'media' | 'tag'
}

function BadgeList({ values, variant = 'tag' }: BadgeListProps) {
  const uniqueValues = [...new Set(values)]

  return (
    <span className="badge-list">
      {uniqueValues.map((value) => (
        <span key={value} className={`badge badge-${variant}`}>
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
      aria-labelledby="empty-playlist-detail-title"
      aria-live="polite"
    >
      <div className="detail-header">
        <span className="entity-type">No selection</span>
        <h2 id="empty-playlist-detail-title">No matching playlists.</h2>
      </div>

      <p className="detail-summary">
        Try another name, type, track, artist, release, tag, format, status or
        rule.
      </p>
    </aside>
  )
}
