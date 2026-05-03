import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { artistRecords, type ArtistRecord } from './artistsData'

export function ArtistsWorkspace() {
  const [query, setQuery] = useState('')
  const [selectedArtistId, setSelectedArtistId] = useState(artistRecords[0].id)

  const visibleArtists = useMemo(() => {
    const terms = queryTerms(query)

    return artistRecords.filter((artist) =>
      terms.every((term) => artistSearchText(artist).includes(term)),
    )
  }, [query])

  const selectedArtist =
    visibleArtists.find((artist) => artist.id === selectedArtistId) ??
    visibleArtists[0] ??
    null

  return (
    <section className="catalog-layout" aria-label="Artists workspace">
      <div className="catalog-main">
        <SearchField
          label="Search artists"
          placeholder="Name, type, alias, member, role or relation"
          query={query}
          onQueryChange={setQuery}
        />
        <div className="filter-bar">
          <span className="result-count">{visibleArtists.length} shown</span>
        </div>
        <ArtistTable
          artists={visibleArtists}
          selectedArtistId={selectedArtist?.id ?? ''}
          onSelectArtist={setSelectedArtistId}
        />
      </div>

      {selectedArtist ? (
        <ArtistDetail artist={selectedArtist} />
      ) : (
        <EmptyDetailPanel title="No matching artists." />
      )}
    </section>
  )
}

function queryTerms(query: string) {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean)
}

function artistSearchText(artist: ArtistRecord) {
  return [
    artist.name,
    artist.type,
    artist.relationHint,
    artist.creditHint,
    artist.summary,
    ...artist.aliases,
    ...artist.members,
    ...artist.tags,
    ...artist.relations.flatMap((relation) => [
      relation.type,
      relation.target,
      relation.detail,
    ]),
    ...artist.credits.flatMap((credit) => [
      credit.role,
      credit.target,
      credit.scope,
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

type ArtistTableProps = {
  artists: ArtistRecord[]
  selectedArtistId: string
  onSelectArtist: (artistId: string) => void
}

function ArtistTable({
  artists,
  selectedArtistId,
  onSelectArtist,
}: ArtistTableProps) {
  return (
    <section
      className="panel catalog-panel"
      aria-labelledby="artist-results-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="artist-results-title">Artist index</h2>
          <p>Projects, aliases, members and credit hints for graph lookup.</p>
        </div>
      </div>

      <div className="table-scroll">
        <table className="catalog-table workspace-table">
          <thead>
            <tr>
              <th scope="col">Artist</th>
              <th scope="col">Type</th>
              <th scope="col">Aliases and members</th>
              <th scope="col">Credits</th>
              <th scope="col">Relation hint</th>
            </tr>
          </thead>
          <tbody>
            {artists.map((artist) => (
              <tr
                key={artist.id}
                aria-selected={artist.id === selectedArtistId}
                className={
                  artist.id === selectedArtistId ? 'is-selected' : undefined
                }
              >
                <th scope="row">
                  <button
                    className="row-title"
                    type="button"
                    onClick={() => onSelectArtist(artist.id)}
                  >
                    <strong>{artist.name}</strong>
                    <span>{artist.tags.join(', ')}</span>
                  </button>
                </th>
                <td data-label="Type">{artist.type}</td>
                <td data-label="Aliases">
                  {joinOrEmpty([...artist.aliases, ...artist.members])}
                </td>
                <td data-label="Credits">{artist.creditHint}</td>
                <td data-label="Relations">{artist.relationHint}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

type ArtistDetailProps = {
  artist: ArtistRecord
}

function ArtistDetail({ artist }: ArtistDetailProps) {
  return (
    <aside className="panel detail-panel" aria-labelledby="artist-detail-title">
      <div className="detail-header">
        <span className="entity-type">{artist.type}</span>
        <h2 id="artist-detail-title">{artist.name}</h2>
        <p>{artist.summary}</p>
      </div>

      <section
        className="detail-section"
        aria-labelledby="artist-relations-title"
      >
        <h3 id="artist-relations-title">Relations and credits</h3>
        <div className="relation-list">
          {artist.relations.map((relation) => (
            <article key={`${relation.type}-${relation.target}`}>
              <span className="badge badge-credit">{relation.type}</span>
              <strong>{relation.target}</strong>
              <p>{relation.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="detail-section"
        aria-labelledby="artist-credits-title"
      >
        <h3 id="artist-credits-title">Credit appearances</h3>
        <div className="relation-list">
          {artist.credits.map((credit) => (
            <article key={`${credit.role}-${credit.target}`}>
              <span className="badge badge-credit">{credit.role}</span>
              <strong>{credit.target}</strong>
              <p>{credit.scope}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="detail-section"
        aria-labelledby="artist-aliases-title"
      >
        <h3 id="artist-aliases-title">Aliases, members and tags</h3>
        <BadgeList
          values={[...artist.aliases, ...artist.members, ...artist.tags]}
        />
      </section>
    </aside>
  )
}

type EmptyDetailPanelProps = {
  title: string
}

function EmptyDetailPanel({ title }: EmptyDetailPanelProps) {
  return (
    <aside
      className="panel detail-panel empty-detail-panel"
      aria-labelledby="empty-detail-title"
      aria-live="polite"
    >
      <div className="detail-header">
        <span className="entity-type">No selection</span>
        <h2 id="empty-detail-title">{title}</h2>
      </div>

      <p className="detail-summary">
        Try another artist, alias, member or role.
      </p>
    </aside>
  )
}

type BadgeListProps = {
  values: string[]
}

function BadgeList({ values }: BadgeListProps) {
  return (
    <span className="badge-list">
      {values.map((value) => (
        <span key={value} className="badge badge-tag">
          {value}
        </span>
      ))}
    </span>
  )
}

function joinOrEmpty(values: string[]) {
  return values.length > 0 ? values.join(', ') : 'None recorded'
}
