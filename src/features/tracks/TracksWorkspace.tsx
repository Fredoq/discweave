import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ManualEntryPanel } from '../manualEntry/ManualEntryPanel'
import {
  createManualRecordId,
  textOrFallback,
} from '../manualEntry/manualEntryUtils'
import {
  playlistTouchesTrack,
  relationTouchesLink,
  uniqueValues,
} from '../catalog/catalogGraph'
import { FilterSelect } from '../catalog/FilterSelect'
import { useCatalogSelection } from '../catalog/useCatalogSelection'
import { artistRecords, type ArtistRecord } from '../artists/artistsData'
import type { PlaylistRecord } from '../playlists/playlistsData'
import { releaseRecords, type ReleaseRecord } from '../releases/releasesData'
import type { RelationRecord } from '../relations/relationsData'
import {
  trackRecords,
  type LocalFileMetadata,
  type TrackCredit,
  type TrackRecord,
  type TrackRelation,
} from './tracksData'

type TracksWorkspaceProps = {
  artists?: ArtistRecord[]
  isManualEntryOpen?: boolean
  locationSearch?: string
  onAddTrack?: (track: TrackRecord) => void
  onManualEntryClose?: () => void
  playlists?: PlaylistRecord[]
  releases?: ReleaseRecord[]
  relations?: RelationRecord[]
  tracks?: TrackRecord[]
}

export function TracksWorkspace({
  artists = artistRecords,
  isManualEntryOpen = false,
  locationSearch = window.location.search,
  onAddTrack,
  onManualEntryClose = () => {},
  playlists = [],
  releases = releaseRecords,
  relations = [],
  tracks: providedTracks,
}: TracksWorkspaceProps) {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({
    format: '',
    creditRole: '',
    relationType: '',
    releaseLink: '',
  })
  const [manualTracks, setManualTracks] = useState<TrackRecord[]>([])
  const tracks = useMemo(() => {
    return providedTracks ?? [...trackRecords, ...manualTracks]
  }, [manualTracks, providedTracks])

  const visibleTracks = useMemo(() => {
    const terms = queryTerms(query)

    return tracks.filter(
      (track) =>
        terms.every((term) => trackSearchText(track).includes(term)) &&
        (!filters.format || track.fileMetadata.format === filters.format) &&
        (!filters.creditRole ||
          track.credits.some((credit) => credit.role === filters.creditRole)) &&
        (!filters.relationType ||
          track.versionHint === filters.relationType ||
          track.relations.some(
            (relation) => relation.type === filters.relationType,
          )) &&
        (!filters.releaseLink ||
          (filters.releaseLink === 'Linked'
            ? Boolean(track.release.id)
            : !track.release.id)),
    )
  }, [filters, query, tracks])
  const { selectedRecord: selectedTrack, selectRecord: selectTrack } =
    useCatalogSelection({
      locationSearch,
      queryParam: 'track',
      records: tracks,
      routePath: '/tracks',
      visibleRecords: visibleTracks,
    })

  function handleAddTrack(track: TrackRecord) {
    if (onAddTrack) {
      onAddTrack(track)
    } else {
      setManualTracks((currentTracks) => [...currentTracks, track])
    }

    setQuery('')
    selectTrack(track.id)
    onManualEntryClose()
  }

  return (
    <section className="catalog-layout" aria-label="Tracks workspace">
      <div className="catalog-main">
        <SearchField
          label="Search tracks"
          placeholder="Title, artist, release, duration, role, version or format"
          query={query}
          onQueryChange={setQuery}
        />
        <div className="filter-bar">
          <FilterSelect
            label="File format"
            value={filters.format}
            values={uniqueValues(
              tracks.map((track) => track.fileMetadata.format),
            )}
            onChange={(format) =>
              setFilters((current) => ({ ...current, format }))
            }
          />
          <FilterSelect
            label="Credit role"
            value={filters.creditRole}
            values={uniqueValues(
              tracks.flatMap((track) =>
                track.credits.map((credit) => credit.role),
              ),
            )}
            onChange={(creditRole) =>
              setFilters((current) => ({ ...current, creditRole }))
            }
          />
          <FilterSelect
            label="Version or relation type"
            value={filters.relationType}
            values={uniqueValues(
              tracks.flatMap((track) => [
                track.versionHint,
                ...track.relations.map((relation) => relation.type),
              ]),
            )}
            onChange={(relationType) =>
              setFilters((current) => ({ ...current, relationType }))
            }
          />
          <FilterSelect
            label="Release link"
            value={filters.releaseLink}
            values={['Linked', 'Unlinked']}
            onChange={(releaseLink) =>
              setFilters((current) => ({ ...current, releaseLink }))
            }
          />
          <span className="result-count">{visibleTracks.length} shown</span>
        </div>
        {isManualEntryOpen ? (
          <TrackEntryForm
            artists={artists}
            onCancel={onManualEntryClose}
            releases={releases}
            tracks={tracks}
            onSubmit={handleAddTrack}
          />
        ) : null}
        <TrackTable
          selectedTrackId={selectedTrack?.id ?? ''}
          tracks={visibleTracks}
          onSelectTrack={selectTrack}
        />
      </div>

      {selectedTrack ? (
        <TrackDetail
          playlists={playlists}
          relations={relations}
          releases={releases}
          track={selectedTrack}
        />
      ) : (
        <EmptyDetailPanel />
      )}
    </section>
  )
}

type TrackEntryFormProps = {
  artists: ArtistRecord[]
  onCancel: () => void
  releases: ReleaseRecord[]
  tracks: TrackRecord[]
  onSubmit: (track: TrackRecord) => void
}

function TrackEntryForm({
  artists,
  onCancel,
  releases,
  tracks,
  onSubmit,
}: TrackEntryFormProps) {
  const [title, setTitle] = useState('')
  const [selectedArtistId, setSelectedArtistId] = useState('')
  const [artist, setArtist] = useState('')
  const [selectedReleaseId, setSelectedReleaseId] = useState('')
  const [release, setRelease] = useState('')
  const [duration, setDuration] = useState('')
  const [fileFormat, setFileFormat] = useState('')
  const [creditRole, setCreditRole] = useState('')
  const [versionNote, setVersionNote] = useState('')
  const isValid = title.trim().length > 0
  const selectedArtist = artists.find(
    (record) => record.id === selectedArtistId,
  )
  const selectedRelease = releases.find(
    (record) => record.id === selectedReleaseId,
  )
  const candidateArtist = (
    selectedArtist?.name ??
    selectedRelease?.artist ??
    artist.trim()
  ).toLowerCase()
  const candidateRelease = (
    selectedRelease?.title ?? release.trim()
  ).toLowerCase()
  const duplicateTrack = tracks.find(
    (track) =>
      track.title.toLowerCase() === title.trim().toLowerCase() &&
      track.artist.toLowerCase() === candidateArtist &&
      track.release.title.toLowerCase() === candidateRelease,
  )

  function handleSubmit() {
    const trackTitle = title.trim()
    const trackArtist =
      selectedArtist?.name ??
      textOrFallback(artist, selectedRelease?.artist ?? 'Unknown artist')
    const releaseTitle =
      selectedRelease?.title ?? textOrFallback(release, 'Unlinked release')
    const role = creditRole.trim()
    const note = versionNote.trim()

    onSubmit({
      id: createManualRecordId('track', trackTitle),
      title: trackTitle,
      artistId: selectedArtist?.id,
      artist: trackArtist,
      release: {
        id: selectedRelease?.id,
        title: releaseTitle,
        artist: selectedRelease?.artist ?? trackArtist,
        year: selectedRelease?.year ?? 'Unknown year',
        label: selectedRelease?.label ?? 'Unknown label',
      },
      trackNumber: 'Unnumbered',
      duration: textOrFallback(duration, 'Unknown duration'),
      versionHint: textOrFallback(note, 'No version note recorded'),
      relationHint: textOrFallback(
        note,
        'Manual track draft with incomplete metadata.',
      ),
      tags: ['manual entry'],
      credits:
        role.length > 0
          ? [
              {
                role,
                artist: trackArtist,
                scope: 'Manual track credit hint.',
              },
            ]
          : [],
      relations:
        note.length > 0
          ? [
              {
                type: 'Version note',
                target: trackTitle,
                detail: note,
              },
            ]
          : [],
      fileMetadata: {
        format: textOrFallback(fileFormat, 'None recorded'),
        path: 'No file linked',
        bitrate: 'Not recorded',
        sampleRate: 'Not recorded',
        channels: 'Not recorded',
        importedAt: 'Manual entry',
        checksum: 'Not recorded',
      },
    })
  }

  return (
    <ManualEntryPanel
      title="Add track"
      requiredMessage="Title is required."
      isValid={isValid}
      onCancel={onCancel}
      onSubmit={handleSubmit}
    >
      <label>
        <span>Title</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
      </label>
      {duplicateTrack ? (
        <p className="manual-entry-warning manual-entry-wide" role="status">
          Likely duplicate track: {duplicateTrack.title} by{' '}
          {duplicateTrack.artist} on {duplicateTrack.release.title}. Submit is
          still allowed for this session.
        </p>
      ) : null}
      <label>
        <span>Existing artist</span>
        <select
          value={selectedArtistId}
          onChange={(event) => {
            const nextArtistId = event.target.value

            setSelectedArtistId(nextArtistId)

            if (nextArtistId.length > 0) {
              setArtist('')
            }
          }}
        >
          <option value="">Free text artist</option>
          {artists.map((artistRecord) => (
            <option key={artistRecord.id} value={artistRecord.id}>
              {artistRecord.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Artist</span>
        <input
          value={artist}
          disabled={selectedArtistId.length > 0}
          onChange={(event) => setArtist(event.target.value)}
        />
      </label>
      <label>
        <span>Existing release</span>
        <select
          value={selectedReleaseId}
          onChange={(event) => {
            const nextReleaseId = event.target.value

            setSelectedReleaseId(nextReleaseId)

            if (nextReleaseId.length > 0) {
              setRelease('')
            }
          }}
        >
          <option value="">Free text release</option>
          {releases.map((releaseRecord) => (
            <option key={releaseRecord.id} value={releaseRecord.id}>
              {releaseRecord.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Linked release</span>
        <input
          value={release}
          disabled={selectedReleaseId.length > 0}
          onChange={(event) => setRelease(event.target.value)}
        />
      </label>
      <label>
        <span>Duration</span>
        <input
          value={duration}
          onChange={(event) => setDuration(event.target.value)}
        />
      </label>
      <label>
        <span>File format</span>
        <input
          value={fileFormat}
          onChange={(event) => setFileFormat(event.target.value)}
        />
      </label>
      <label>
        <span>Credit role</span>
        <input
          value={creditRole}
          onChange={(event) => setCreditRole(event.target.value)}
        />
      </label>
      <label className="manual-entry-wide">
        <span>Version/relation note</span>
        <textarea
          value={versionNote}
          onChange={(event) => setVersionNote(event.target.value)}
          rows={3}
        />
      </label>
    </ManualEntryPanel>
  )
}

function queryTerms(query: string) {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean)
}

function trackSearchText(track: TrackRecord) {
  return [
    track.title,
    track.artist,
    track.release.title,
    track.release.artist,
    track.release.year,
    track.release.label,
    track.trackNumber,
    track.duration,
    track.versionHint,
    track.relationHint,
    track.fileMetadata.format,
    track.fileMetadata.path,
    track.fileMetadata.bitrate,
    track.fileMetadata.sampleRate,
    track.fileMetadata.channels,
    ...track.tags,
    ...track.credits.flatMap((credit) => [
      credit.role,
      credit.artist,
      credit.scope,
    ]),
    ...track.relations.flatMap((relation) => [
      relation.type,
      relation.target,
      relation.detail,
    ]),
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

type TrackTableProps = {
  tracks: TrackRecord[]
  selectedTrackId: string
  onSelectTrack: (trackId: string) => void
}

function TrackTable({
  tracks,
  selectedTrackId,
  onSelectTrack,
}: TrackTableProps) {
  return (
    <section
      className="panel catalog-panel"
      aria-labelledby="track-results-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="track-results-title">Track records</h2>
          <p>
            Tracks connect releases, credits, versions and local file facts.
          </p>
        </div>
      </div>

      <div className="table-scroll">
        <table className="catalog-table workspace-table">
          <thead>
            <tr>
              <th scope="col">Track</th>
              <th scope="col">Artist</th>
              <th scope="col">Release</th>
              <th scope="col">Duration</th>
              <th scope="col">Credits</th>
              <th scope="col">Version</th>
              <th scope="col">File</th>
            </tr>
          </thead>
          <tbody>
            {tracks.map((track) => (
              <tr
                key={track.id}
                aria-selected={track.id === selectedTrackId}
                className={
                  track.id === selectedTrackId ? 'is-selected' : undefined
                }
              >
                <th scope="row">
                  <button
                    className="row-title"
                    type="button"
                    onClick={() => onSelectTrack(track.id)}
                  >
                    <strong>{track.title}</strong>
                    <span>Track {track.trackNumber}</span>
                  </button>
                </th>
                <td data-label="Artist">{track.artist}</td>
                <td data-label="Release">{track.release.title}</td>
                <td data-label="Duration">{track.duration}</td>
                <td data-label="Credits">
                  <BadgeList
                    values={[
                      ...new Set(track.credits.map((credit) => credit.role)),
                    ]}
                    variant="credit"
                  />
                </td>
                <td data-label="Version">{track.versionHint}</td>
                <td data-label="File">
                  <span className="badge badge-media">
                    {track.fileMetadata.format}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

type TrackDetailProps = {
  playlists: PlaylistRecord[]
  relations: RelationRecord[]
  releases: ReleaseRecord[]
  track: TrackRecord
}

function TrackDetail({
  playlists,
  relations,
  releases,
  track,
}: TrackDetailProps) {
  const linkedReleaseExists =
    track.release.id &&
    releases.some((release) => release.id === track.release.id)
  const trackLink = { kind: 'track', id: track.id } as const
  const linkedRelations = relations.filter(
    (relation) =>
      relationTouchesLink(relation, trackLink) ||
      track.relations.some(
        (trackRelation) =>
          trackRelation.target.toLowerCase() ===
          relation.linkedEntity.toLowerCase(),
      ) ||
      relation.linkedEntity.toLowerCase() === track.title.toLowerCase(),
  )
  const linkedPlaylists = playlists.filter((playlist) =>
    playlistTouchesTrack(playlist, track),
  )

  return (
    <aside className="panel detail-panel" aria-labelledby="track-detail-title">
      <div className="detail-header">
        <span className="entity-type">Track</span>
        <h2 id="track-detail-title">{track.title}</h2>
        <p>{track.artist}</p>
      </div>

      <p className="detail-summary">{track.relationHint}</p>

      <section
        className="detail-section"
        aria-labelledby="linked-release-title"
      >
        <h3 id="linked-release-title">Linked release</h3>
        <dl className="detail-list">
          <div>
            <dt>Release</dt>
            <dd>
              {linkedReleaseExists && track.release.id ? (
                <a className="detail-link" href={releaseHref(track.release.id)}>
                  {track.release.title}
                </a>
              ) : (
                track.release.title
              )}
            </dd>
          </div>
          <div>
            <dt>Release artist</dt>
            <dd>{track.release.artist}</dd>
          </div>
          <div>
            <dt>Year and label</dt>
            <dd>
              {track.release.year} · {track.release.label}
            </dd>
          </div>
          <div>
            <dt>Track number and duration</dt>
            <dd>
              {track.trackNumber} · {track.duration}
            </dd>
          </div>
        </dl>
      </section>

      <section className="detail-section" aria-labelledby="track-credits-title">
        <h3 id="track-credits-title">Track credits</h3>
        <div className="relation-list">
          {track.credits.map((credit) => (
            <CreditCard
              key={`${credit.role}-${credit.artist}`}
              credit={credit}
            />
          ))}
        </div>
      </section>

      <section
        className="detail-section"
        aria-labelledby="track-relations-title"
      >
        <h3 id="track-relations-title">Versions and relations</h3>
        <div className="relation-list">
          {track.relations.map((relation) => (
            <RelationCard
              key={`${relation.type}-${relation.target}`}
              relation={relation}
            />
          ))}
        </div>
      </section>

      <section className="detail-section" aria-labelledby="track-files-title">
        <h3 id="track-files-title">Local file metadata</h3>
        <FileMetadata metadata={track.fileMetadata} />
      </section>

      <section className="detail-section" aria-labelledby="track-graph-title">
        <h3 id="track-graph-title">Relation and playlist backlinks</h3>
        {linkedRelations.length > 0 || linkedPlaylists.length > 0 ? (
          <div className="relation-list">
            {linkedRelations.map((relation) => (
              <article key={relation.id}>
                <span className="badge badge-credit">
                  {relation.relationType}
                </span>
                <a
                  className="detail-link"
                  href={`/relations?relation=${encodeURIComponent(relation.id)}`}
                >
                  {relation.source} to {relation.target}
                </a>
                <p>{relation.role}</p>
              </article>
            ))}
            {linkedPlaylists.map((playlist) => (
              <article key={playlist.id}>
                <span className="badge badge-tag">{playlist.type}</span>
                <a
                  className="detail-link"
                  href={`/playlists?playlist=${encodeURIComponent(playlist.id)}`}
                >
                  {playlist.name}
                </a>
                <p>{playlist.description}</p>
              </article>
            ))}
          </div>
        ) : (
          <p>No relation or playlist backlinks yet.</p>
        )}
      </section>
    </aside>
  )
}

type CreditCardProps = {
  credit: TrackCredit
}

function CreditCard({ credit }: CreditCardProps) {
  return (
    <article>
      <span className="badge badge-credit">{credit.role}</span>
      <strong>{credit.artist}</strong>
      <p>{credit.scope}</p>
    </article>
  )
}

type RelationCardProps = {
  relation: TrackRelation
}

function RelationCard({ relation }: RelationCardProps) {
  return (
    <article>
      <span className="badge badge-credit">{relation.type}</span>
      <strong>{relation.target}</strong>
      <p>{relation.detail}</p>
    </article>
  )
}

type FileMetadataProps = {
  metadata: LocalFileMetadata
}

function FileMetadata({ metadata }: FileMetadataProps) {
  return (
    <dl className="detail-list">
      <div>
        <dt>Format</dt>
        <dd>{metadata.format}</dd>
      </div>
      <div>
        <dt>Path</dt>
        <dd>{metadata.path}</dd>
      </div>
      <div>
        <dt>Bitrate</dt>
        <dd>{metadata.bitrate}</dd>
      </div>
      <div>
        <dt>Sample rate</dt>
        <dd>{metadata.sampleRate}</dd>
      </div>
      <div>
        <dt>Channels</dt>
        <dd>{metadata.channels}</dd>
      </div>
      <div>
        <dt>Import state</dt>
        <dd>{metadata.importedAt}</dd>
      </div>
      <div>
        <dt>Checksum</dt>
        <dd>{metadata.checksum}</dd>
      </div>
    </dl>
  )
}

function EmptyDetailPanel() {
  return (
    <aside
      className="panel detail-panel empty-detail-panel"
      aria-labelledby="empty-track-detail-title"
      aria-live="polite"
    >
      <div className="detail-header">
        <span className="entity-type">No selection</span>
        <h2 id="empty-track-detail-title">No matching tracks.</h2>
      </div>

      <p className="detail-summary">
        Try another title, artist, release, role, version or file format.
      </p>
    </aside>
  )
}

type BadgeListProps = {
  values: string[]
  variant: 'credit' | 'tag'
}

function BadgeList({ values, variant }: BadgeListProps) {
  return (
    <span className="badge-list">
      {values.map((value) => (
        <span key={value} className={`badge badge-${variant}`}>
          {value}
        </span>
      ))}
    </span>
  )
}
