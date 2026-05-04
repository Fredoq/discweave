import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ManualEntryPanel } from '../manualEntry/ManualEntryPanel'
import {
  createManualRecordId,
  textOrFallback,
} from '../manualEntry/manualEntryUtils'
import {
  catalogEntityHref,
  findCatalogTextLink,
  hasCatalogLink,
  type CatalogLinkData,
  type CatalogEntityKind,
} from '../catalog/catalogLinks'
import { useCatalogSelection } from '../catalog/useCatalogSelection'
import type { OwnedItemRecord } from '../ownedItems/ownedItemsData'
import type { ReleaseRecord } from '../releases/releasesData'
import type { RelationRecord } from '../relations/relationsData'
import type { TrackRecord } from '../tracks/tracksData'
import {
  artistRecords,
  type ArtistRecord,
  type ArtistType,
} from './artistsData'

type ArtistsWorkspaceProps = {
  artists?: ArtistRecord[]
  isManualEntryOpen?: boolean
  locationSearch?: string
  onAddArtist?: (artist: ArtistRecord) => void
  onManualEntryClose?: () => void
  ownedItems?: OwnedItemRecord[]
  relations?: RelationRecord[]
  releases?: ReleaseRecord[]
  tracks?: TrackRecord[]
}

export function ArtistsWorkspace({
  artists: providedArtists,
  isManualEntryOpen = false,
  locationSearch = window.location.search,
  onAddArtist,
  onManualEntryClose = () => {},
  ownedItems = [],
  relations = [],
  releases = [],
  tracks = [],
}: ArtistsWorkspaceProps) {
  const [query, setQuery] = useState('')
  const [manualArtists, setManualArtists] = useState<ArtistRecord[]>([])
  const artists = useMemo(() => {
    return providedArtists ?? [...artistRecords, ...manualArtists]
  }, [manualArtists, providedArtists])
  const catalogData = useMemo(
    () => ({ artists, ownedItems, relations, releases, tracks }),
    [artists, ownedItems, relations, releases, tracks],
  )

  const visibleArtists = useMemo(() => {
    const terms = queryTerms(query)

    return artists.filter((artist) =>
      terms.every((term) => artistSearchText(artist).includes(term)),
    )
  }, [artists, query])
  const { selectedRecord: selectedArtist, selectRecord: selectArtist } =
    useCatalogSelection({
      locationSearch,
      queryParam: 'artist',
      records: artists,
      routePath: '/artists',
      visibleRecords: visibleArtists,
    })

  function handleAddArtist(artist: ArtistRecord) {
    if (onAddArtist) {
      onAddArtist(artist)
    } else {
      setManualArtists((currentArtists) => [...currentArtists, artist])
    }

    setQuery('')
    selectArtist(artist.id)
    onManualEntryClose()
  }

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
        {isManualEntryOpen ? (
          <ArtistEntryForm
            onCancel={onManualEntryClose}
            onSubmit={handleAddArtist}
          />
        ) : null}
        <ArtistTable
          artists={visibleArtists}
          selectedArtistId={selectedArtist?.id ?? ''}
          onSelectArtist={selectArtist}
        />
      </div>

      {selectedArtist ? (
        <ArtistDetail artist={selectedArtist} catalogData={catalogData} />
      ) : (
        <EmptyDetailPanel title="No matching artists." />
      )}
    </section>
  )
}

type ArtistEntryFormProps = {
  onCancel: () => void
  onSubmit: (artist: ArtistRecord) => void
}

function ArtistEntryForm({ onCancel, onSubmit }: ArtistEntryFormProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<ArtistType>('Person')
  const [creditRole, setCreditRole] = useState('')
  const [relationHint, setRelationHint] = useState('')
  const [notes, setNotes] = useState('')
  const isValid = name.trim().length > 0

  function handleSubmit() {
    const artistName = name.trim()
    const summary = textOrFallback(
      notes,
      'Manual artist draft with incomplete metadata.',
    )
    const credit = creditRole.trim()
    const relation = relationHint.trim()

    onSubmit({
      id: createManualRecordId('artist', artistName),
      name: artistName,
      type,
      aliases: [],
      members: [],
      relationHint: textOrFallback(relation, 'No relation hint recorded'),
      creditHint: textOrFallback(credit, 'No primary credit role recorded'),
      relations:
        relation.length > 0
          ? [
              {
                type: 'Relation hint',
                target: relation,
                detail: summary,
              },
            ]
          : [],
      credits:
        credit.length > 0
          ? [
              {
                role: credit,
                target: 'Manual catalog entry',
                scope: 'Draft credit hint',
              },
            ]
          : [],
      tags: ['manual entry'],
      summary,
    })
  }

  return (
    <ManualEntryPanel
      title="Add artist"
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
          onChange={(event) => setType(event.target.value as ArtistType)}
        >
          <option>Person</option>
          <option>Band</option>
          <option>Project</option>
          <option>Alias</option>
          <option>Collective</option>
        </select>
      </label>
      <label>
        <span>Primary credit role</span>
        <input
          value={creditRole}
          onChange={(event) => setCreditRole(event.target.value)}
        />
      </label>
      <label>
        <span>Relation hint</span>
        <input
          value={relationHint}
          onChange={(event) => setRelationHint(event.target.value)}
        />
      </label>
      <label className="manual-entry-wide">
        <span>Notes</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
        />
      </label>
    </ManualEntryPanel>
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
  catalogData: CatalogLinkData
}

function ArtistDetail({ artist, catalogData }: ArtistDetailProps) {
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
              <strong>
                <LinkedCatalogText
                  catalogData={catalogData}
                  preferredKinds={['artist', 'release', 'track', 'ownedItem']}
                  text={relation.target}
                />
              </strong>
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
              <strong>
                <LinkedCatalogText
                  catalogData={catalogData}
                  preferredKinds={creditPreferredKinds(credit.scope)}
                  text={credit.target}
                />
              </strong>
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

type LinkedCatalogTextProps = {
  catalogData: CatalogLinkData
  preferredKinds: CatalogEntityKind[]
  text: string
}

function LinkedCatalogText({
  catalogData,
  preferredKinds,
  text,
}: LinkedCatalogTextProps) {
  const link = findCatalogTextLink(catalogData, text, preferredKinds)

  if (!link || !hasCatalogLink(catalogData, link)) {
    return <>{text}</>
  }

  return (
    <a className="detail-link" href={catalogEntityHref(link)}>
      {text}
    </a>
  )
}

function creditPreferredKinds(scope: string): CatalogEntityKind[] {
  const normalizedScope = scope.toLowerCase()

  if (normalizedScope.includes('track')) {
    return ['track', 'release', 'artist', 'ownedItem']
  }

  if (normalizedScope.includes('release')) {
    return ['release', 'track', 'artist', 'ownedItem']
  }

  return ['release', 'track', 'artist', 'ownedItem']
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
