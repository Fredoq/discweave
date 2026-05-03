import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ManualEntryPanel } from '../manualEntry/ManualEntryPanel'
import {
  createManualRecordId,
  splitCommaList,
  textOrFallback,
} from '../manualEntry/manualEntryUtils'
import {
  releaseRecords,
  type OwnedCopy,
  type ReleaseRecord,
  type ReleaseType,
} from './releasesData'

type ReleasesWorkspaceProps = {
  isManualEntryOpen?: boolean
  onManualEntryClose?: () => void
}

export function ReleasesWorkspace({
  isManualEntryOpen = false,
  onManualEntryClose = () => {},
}: ReleasesWorkspaceProps) {
  const [query, setQuery] = useState('')
  const [selectedReleaseId, setSelectedReleaseId] = useState(
    initialSelectedReleaseId,
  )
  const [manualReleases, setManualReleases] = useState<ReleaseRecord[]>([])
  const releases = useMemo(
    () => [...releaseRecords, ...manualReleases],
    [manualReleases],
  )

  const visibleReleases = useMemo(() => {
    const terms = queryTerms(query)

    return releases.filter((release) =>
      terms.every((term) => releaseSearchText(release).includes(term)),
    )
  }, [query, releases])

  function handleAddRelease(release: ReleaseRecord) {
    setManualReleases((currentReleases) => [...currentReleases, release])
    setQuery('')
    setSelectedReleaseId(release.id)
    onManualEntryClose()
  }

  const selectedRelease =
    visibleReleases.find((release) => release.id === selectedReleaseId) ??
    visibleReleases[0] ??
    null

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
            onCancel={onManualEntryClose}
            onSubmit={handleAddRelease}
          />
        ) : null}
        <ReleaseTable
          releases={visibleReleases}
          selectedReleaseId={selectedRelease?.id ?? ''}
          onSelectRelease={setSelectedReleaseId}
        />
      </div>

      {selectedRelease ? (
        <ReleaseDetail release={selectedRelease} />
      ) : (
        <EmptyDetailPanel />
      )}
    </section>
  )
}

type ReleaseEntryFormProps = {
  onCancel: () => void
  onSubmit: (release: ReleaseRecord) => void
}

function ReleaseEntryForm({ onCancel, onSubmit }: ReleaseEntryFormProps) {
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [year, setYear] = useState('')
  const [label, setLabel] = useState('')
  const [type, setType] = useState<ReleaseType>('Album')
  const [medium, setMedium] = useState('')
  const [status, setStatus] = useState<OwnedCopy['status'] | ''>('')
  const [tags, setTags] = useState('')
  const isValid = title.trim().length > 0

  function handleSubmit() {
    const releaseTitle = title.trim()
    const copyMedium = medium.trim()
    const copyStatus = status
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

    onSubmit({
      id: createManualRecordId('release', releaseTitle),
      title: releaseTitle,
      artist: textOrFallback(artist, 'Unknown artist'),
      type,
      year: textOrFallback(year, 'Unknown year'),
      label: textOrFallback(label, 'Unknown label'),
      genres: [],
      tags: splitCommaList(tags),
      releaseNotes: 'Manual release draft with incomplete metadata.',
      ownedCopies,
    })
  }

  return (
    <ManualEntryPanel
      title="Add release"
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
      <label>
        <span>Artist</span>
        <input
          value={artist}
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
    </ManualEntryPanel>
  )
}

function initialSelectedReleaseId() {
  const requestedReleaseId = new URLSearchParams(window.location.search).get(
    'release',
  )

  return requestedReleaseId &&
    releaseRecords.some((release) => release.id === requestedReleaseId)
    ? requestedReleaseId
    : releaseRecords[0].id
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
}

function ReleaseDetail({ release }: ReleaseDetailProps) {
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
    </aside>
  )
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
