import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ManualEntryPanel } from '../manualEntry/ManualEntryPanel'
import {
  createManualRecordId,
  splitCommaList,
  textOrFallback,
} from '../manualEntry/manualEntryUtils'
import { useCatalogSelection } from '../catalog/useCatalogSelection'
import { artistRecords, type ArtistRecord } from '../artists/artistsData'
import type { TrackRecord } from '../tracks/tracksData'
import {
  releaseRecords,
  type OwnedCopy,
  type ReleaseRecord,
  type ReleaseType,
} from './releasesData'

type ReleasesWorkspaceProps = {
  artists?: ArtistRecord[]
  isManualEntryOpen?: boolean
  locationSearch?: string
  onAddRelease?: (release: ReleaseRecord, tracks: TrackRecord[]) => void
  onManualEntryClose?: () => void
  releases?: ReleaseRecord[]
  tracks?: TrackRecord[]
}

export function ReleasesWorkspace({
  artists = artistRecords,
  isManualEntryOpen = false,
  locationSearch = window.location.search,
  onAddRelease,
  onManualEntryClose = () => {},
  releases: providedReleases,
  tracks = [],
}: ReleasesWorkspaceProps) {
  const [query, setQuery] = useState('')
  const [manualReleases, setManualReleases] = useState<ReleaseRecord[]>([])
  const releases = useMemo(() => {
    return providedReleases ?? [...releaseRecords, ...manualReleases]
  }, [manualReleases, providedReleases])

  const visibleReleases = useMemo(() => {
    const terms = queryTerms(query)

    return releases.filter((release) =>
      terms.every((term) => releaseSearchText(release).includes(term)),
    )
  }, [query, releases])
  const { selectedRecord: selectedRelease, selectRecord: selectRelease } =
    useCatalogSelection({
      locationSearch,
      queryParam: 'release',
      records: releases,
      routePath: '/releases',
      visibleRecords: visibleReleases,
    })

  function handleAddRelease(
    release: ReleaseRecord,
    createdTracks: TrackRecord[],
  ) {
    if (onAddRelease) {
      onAddRelease(release, createdTracks)
    } else {
      setManualReleases((currentReleases) => [...currentReleases, release])
    }

    setQuery('')
    selectRelease(release.id)
    onManualEntryClose()
  }

  return (
    <section className="catalog-layout" aria-label="Releases workspace">
      <div className="catalog-main">
        <SearchField
          label="Search releases"
          placeholder="Title, artist, label, year, medium or ownership status"
          query={query}
          onQueryChange={setQuery}
        />
        <div className="filter-bar">
          <span className="result-count">{visibleReleases.length} shown</span>
        </div>
        {isManualEntryOpen ? (
          <ReleaseEntryForm
            artists={artists}
            onCancel={onManualEntryClose}
            onSubmit={handleAddRelease}
          />
        ) : null}
        <ReleaseTable
          releases={visibleReleases}
          selectedReleaseId={selectedRelease?.id ?? ''}
          onSelectRelease={selectRelease}
        />
      </div>

      {selectedRelease ? (
        <ReleaseDetail
          release={selectedRelease}
          tracks={tracks.filter(
            (track) => track.release.id === selectedRelease.id,
          )}
        />
      ) : (
        <EmptyDetailPanel />
      )}
    </section>
  )
}

type ReleaseEntryFormProps = {
  artists: ArtistRecord[]
  onCancel: () => void
  onSubmit: (release: ReleaseRecord, tracks: TrackRecord[]) => void
}

type DraftTrackRow = {
  id: string
  title: string
  artist: string
  duration: string
  fileFormat: string
  creditRole: string
  versionNote: string
}

function ReleaseEntryForm({
  artists,
  onCancel,
  onSubmit,
}: ReleaseEntryFormProps) {
  const [title, setTitle] = useState('')
  const [selectedArtistId, setSelectedArtistId] = useState('')
  const [artist, setArtist] = useState('')
  const [year, setYear] = useState('')
  const [label, setLabel] = useState('')
  const [type, setType] = useState<ReleaseType>('Album')
  const [medium, setMedium] = useState('')
  const [status, setStatus] = useState<OwnedCopy['status'] | ''>('')
  const [tags, setTags] = useState('')
  const [draftTracks, setDraftTracks] = useState<DraftTrackRow[]>([])
  const hasInvalidDraftTrack = draftTracks.some(
    (track) => isDraftTrackIncluded(track) && track.title.trim().length === 0,
  )
  const isValid = title.trim().length > 0 && !hasInvalidDraftTrack
  const requiredMessage =
    title.trim().length === 0
      ? 'Title is required.'
      : 'Draft track rows with metadata need a track title.'

  function handleSubmit() {
    const releaseTitle = title.trim()
    const selectedArtist = artists.find(
      (record) => record.id === selectedArtistId,
    )
    const releaseArtist =
      selectedArtist?.name ?? textOrFallback(artist, 'Unknown artist')
    const copyMedium = medium.trim()
    const copyStatus = status
    const releaseId = createManualRecordId('release', releaseTitle)
    const ownedCopies: OwnedCopy[] =
      copyMedium || copyStatus
        ? [
            {
              id: createManualRecordId('release-copy', releaseTitle),
              medium: textOrFallback(copyMedium, 'Unspecified medium'),
              status: copyStatus || 'Owned',
              storage: 'No storage recorded',
              condition: 'No condition recorded',
              note: 'Manual owned-copy hint from release entry.',
            },
          ]
        : []
    const release: ReleaseRecord = {
      id: releaseId,
      title: releaseTitle,
      artistId: selectedArtist?.id,
      artist: releaseArtist,
      type,
      year: textOrFallback(year, 'Unknown year'),
      label: textOrFallback(label, 'Unknown label'),
      genres: [],
      tags: splitCommaList(tags),
      releaseNotes: 'Manual release draft with incomplete metadata.',
      ownedCopies,
    }
    const createdTracks = draftTracks
      .filter((track) => track.title.trim().length > 0)
      .map((track, index): TrackRecord => {
        const trackTitle = track.title.trim()
        const trackArtist = textOrFallback(track.artist, releaseArtist)
        const role = track.creditRole.trim()
        const note = track.versionNote.trim()

        return {
          id: createManualRecordId('track', `${releaseTitle}-${trackTitle}`),
          title: trackTitle,
          artistId:
            track.artist.trim().length === 0 ? selectedArtist?.id : undefined,
          artist: trackArtist,
          release: {
            id: release.id,
            title: release.title,
            artist: release.artist,
            year: release.year,
            label: release.label,
          },
          trackNumber: String(index + 1),
          duration: textOrFallback(track.duration, 'Unknown duration'),
          versionHint: textOrFallback(note, 'No version note recorded'),
          relationHint: textOrFallback(
            note,
            'Manual track draft created with release entry.',
          ),
          tags: ['manual entry'],
          credits:
            role.length > 0
              ? [
                  {
                    role,
                    artist: trackArtist,
                    scope: 'Draft track credit from release entry.',
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
            format: textOrFallback(track.fileFormat, 'None recorded'),
            path: 'No file linked',
            bitrate: 'Not recorded',
            sampleRate: 'Not recorded',
            channels: 'Not recorded',
            importedAt: 'Manual entry',
            checksum: 'Not recorded',
          },
        }
      })

    onSubmit(release, createdTracks)
  }

  function handleDraftTrackChange(
    trackId: string,
    field: keyof Omit<DraftTrackRow, 'id'>,
    value: string,
  ) {
    setDraftTracks((currentTracks) =>
      currentTracks.map((track) =>
        track.id === trackId ? { ...track, [field]: value } : track,
      ),
    )
  }

  function addDraftTrack() {
    setDraftTracks((currentTracks) => [
      ...currentTracks,
      {
        id: createManualRecordId(
          'draft-track',
          String(currentTracks.length + 1),
        ),
        title: '',
        artist: '',
        duration: '',
        fileFormat: '',
        creditRole: '',
        versionNote: '',
      },
    ])
  }

  return (
    <ManualEntryPanel
      title="Add release"
      requiredMessage={requiredMessage}
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
        <span>Year</span>
        <input value={year} onChange={(event) => setYear(event.target.value)} />
      </label>
      <label>
        <span>Label</span>
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
      </label>
      <label>
        <span>Release type</span>
        <select
          value={type}
          onChange={(event) => setType(event.target.value as ReleaseType)}
        >
          <option>Album</option>
          <option>Single</option>
          <option>EP</option>
          <option>Compilation</option>
          <option>Other</option>
        </select>
      </label>
      <label>
        <span>Media</span>
        <input
          value={medium}
          onChange={(event) => setMedium(event.target.value)}
        />
      </label>
      <label>
        <span>Ownership status</span>
        <select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as OwnedCopy['status'] | '')
          }
        >
          <option value="">Not recorded</option>
          <option>Owned</option>
          <option>Wanted</option>
          <option>Sold</option>
          <option>Needs digitization</option>
        </select>
      </label>
      <label>
        <span>Tags</span>
        <input value={tags} onChange={(event) => setTags(event.target.value)} />
      </label>
      <section
        className="manual-entry-wide draft-track-section"
        aria-labelledby="draft-track-section-title"
      >
        <div className="draft-track-header">
          <div>
            <h3 id="draft-track-section-title">Draft tracks</h3>
            <p>Optional rows create tracks linked to this release.</p>
          </div>
          <button
            className="button button-secondary"
            type="button"
            onClick={addDraftTrack}
          >
            Add track row
          </button>
        </div>
        {draftTracks.length === 0 ? (
          <p className="draft-track-empty">No draft tracks added.</p>
        ) : (
          <div className="draft-track-list">
            {draftTracks.map((track, index) => {
              const rowNumber = index + 1

              return (
                <fieldset className="draft-track-row" key={track.id}>
                  <legend>Draft track {rowNumber}</legend>
                  <label>
                    <span>Draft track {rowNumber} title</span>
                    <input
                      aria-label={`Draft track ${rowNumber} title`}
                      value={track.title}
                      onChange={(event) =>
                        handleDraftTrackChange(
                          track.id,
                          'title',
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>Draft track {rowNumber} artist</span>
                    <input
                      aria-label={`Draft track ${rowNumber} artist`}
                      value={track.artist}
                      onChange={(event) =>
                        handleDraftTrackChange(
                          track.id,
                          'artist',
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>Draft track {rowNumber} duration</span>
                    <input
                      aria-label={`Draft track ${rowNumber} duration`}
                      value={track.duration}
                      onChange={(event) =>
                        handleDraftTrackChange(
                          track.id,
                          'duration',
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>Draft track {rowNumber} file format</span>
                    <input
                      aria-label={`Draft track ${rowNumber} file format`}
                      value={track.fileFormat}
                      onChange={(event) =>
                        handleDraftTrackChange(
                          track.id,
                          'fileFormat',
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>Draft track {rowNumber} credit role</span>
                    <input
                      aria-label={`Draft track ${rowNumber} credit role`}
                      value={track.creditRole}
                      onChange={(event) =>
                        handleDraftTrackChange(
                          track.id,
                          'creditRole',
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>Draft track {rowNumber} version note</span>
                    <input
                      aria-label={`Draft track ${rowNumber} version note`}
                      value={track.versionNote}
                      onChange={(event) =>
                        handleDraftTrackChange(
                          track.id,
                          'versionNote',
                          event.target.value,
                        )
                      }
                    />
                  </label>
                </fieldset>
              )
            })}
          </div>
        )}
      </section>
    </ManualEntryPanel>
  )
}

function isDraftTrackIncluded(track: DraftTrackRow) {
  return [
    track.title,
    track.artist,
    track.duration,
    track.fileFormat,
    track.creditRole,
    track.versionNote,
  ].some((value) => value.trim().length > 0)
}

function queryTerms(query: string) {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean)
}

function releaseSearchText(release: ReleaseRecord) {
  return [
    release.title,
    release.artist,
    release.type,
    release.year,
    release.label,
    release.releaseNotes,
    ...release.genres,
    ...release.tags,
    ...release.ownedCopies.flatMap((copy) => [
      copy.medium,
      copy.status,
      copy.storage,
      copy.condition,
      copy.note,
    ]),
  ]
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

type ReleaseTableProps = {
  releases: ReleaseRecord[]
  selectedReleaseId: string
  onSelectRelease: (releaseId: string) => void
}

function ReleaseTable({
  releases,
  selectedReleaseId,
  onSelectRelease,
}: ReleaseTableProps) {
  return (
    <section
      className="panel catalog-panel"
      aria-labelledby="release-results-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="release-results-title">Release records</h2>
          <p>Logical releases stay separate from concrete owned copies.</p>
        </div>
      </div>

      <div className="table-scroll">
        <table className="catalog-table workspace-table">
          <thead>
            <tr>
              <th scope="col">Release</th>
              <th scope="col">Artist</th>
              <th scope="col">Year</th>
              <th scope="col">Label</th>
              <th scope="col">Media</th>
              <th scope="col">Ownership</th>
            </tr>
          </thead>
          <tbody>
            {releases.map((release) => (
              <tr
                key={release.id}
                aria-selected={release.id === selectedReleaseId}
                className={
                  release.id === selectedReleaseId ? 'is-selected' : undefined
                }
              >
                <th scope="row">
                  <button
                    className="row-title"
                    type="button"
                    onClick={() => onSelectRelease(release.id)}
                  >
                    <strong>{release.title}</strong>
                    <span>{release.type}</span>
                  </button>
                </th>
                <td data-label="Artist">{release.artist}</td>
                <td data-label="Year">{release.year}</td>
                <td data-label="Label">{release.label}</td>
                <td data-label="Media">
                  <BadgeList
                    values={[
                      ...new Set(
                        release.ownedCopies.map((copy) => copy.medium),
                      ),
                    ]}
                    variant="media"
                  />
                </td>
                <td data-label="Ownership">
                  <BadgeList
                    values={[
                      ...new Set(
                        release.ownedCopies.map((copy) => copy.status),
                      ),
                    ]}
                    variant="tag"
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

type ReleaseDetailProps = {
  release: ReleaseRecord
  tracks: TrackRecord[]
}

function ReleaseDetail({ release, tracks }: ReleaseDetailProps) {
  return (
    <aside
      className="panel detail-panel"
      aria-labelledby="release-detail-title"
    >
      <div className="detail-header">
        <span className="entity-type">{release.type}</span>
        <h2 id="release-detail-title">{release.title}</h2>
        <p>{release.artist}</p>
      </div>

      <p className="detail-summary">{release.releaseNotes}</p>

      <section
        className="detail-section"
        aria-labelledby="release-metadata-title"
      >
        <h3 id="release-metadata-title">Release metadata</h3>
        <dl className="detail-list">
          <div>
            <dt>Artist</dt>
            <dd>{release.artist}</dd>
          </div>
          <div>
            <dt>Year</dt>
            <dd>{release.year}</dd>
          </div>
          <div>
            <dt>Label</dt>
            <dd>{release.label}</dd>
          </div>
          <div>
            <dt>Genres and tags</dt>
            <dd>
              <BadgeList
                values={[...release.genres, ...release.tags]}
                variant="tag"
              />
            </dd>
          </div>
        </dl>
      </section>

      <section className="detail-section" aria-labelledby="release-owned-title">
        <h3 id="release-owned-title">Owned copies</h3>
        <div className="copy-list">
          {release.ownedCopies.map((copy) => (
            <OwnedCopyCard key={copy.id} copy={copy} />
          ))}
        </div>
      </section>

      <section
        className="detail-section"
        aria-labelledby="release-tracks-title"
      >
        <h3 id="release-tracks-title">Tracks</h3>
        {tracks.length > 0 ? (
          <div className="relation-list">
            <p>
              {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
            </p>
            {tracks.map((track) => (
              <article key={track.id}>
                <a className="detail-link" href={trackHref(track.id)}>
                  {track.title}
                </a>
                <p>
                  {track.trackNumber} · {track.artist} · {track.duration}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p>No tracks linked yet.</p>
        )}
      </section>
    </aside>
  )
}

function trackHref(trackId: string) {
  return `/tracks?track=${encodeURIComponent(trackId)}`
}

type OwnedCopyCardProps = {
  copy: OwnedCopy
}

function OwnedCopyCard({ copy }: OwnedCopyCardProps) {
  return (
    <article className="copy-card">
      <div>
        <strong>{copy.medium}</strong>
        <span className="badge badge-tag">{copy.status}</span>
      </div>
      <dl className="detail-list">
        <div>
          <dt>Storage</dt>
          <dd>{copy.storage}</dd>
        </div>
        <div>
          <dt>Condition</dt>
          <dd>{copy.condition}</dd>
        </div>
      </dl>
      <p>{copy.note}</p>
    </article>
  )
}

function EmptyDetailPanel() {
  return (
    <aside
      className="panel detail-panel empty-detail-panel"
      aria-labelledby="empty-release-detail-title"
      aria-live="polite"
    >
      <div className="detail-header">
        <span className="entity-type">No selection</span>
        <h2 id="empty-release-detail-title">No matching releases.</h2>
      </div>

      <p className="detail-summary">
        Try another title, artist, label, medium or ownership status.
      </p>
    </aside>
  )
}

type BadgeListProps = {
  values: string[]
  variant: 'media' | 'tag'
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
