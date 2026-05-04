import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ManualEntryPanel } from '../manualEntry/ManualEntryPanel'
import {
  createManualRecordId,
  isManualSessionRecord,
  textOrFallback,
} from '../manualEntry/manualEntryUtils'
import {
  catalogEntityHref,
  findCatalogTextLink,
  hasCatalogLink,
  type CatalogLinkData,
  type CatalogEntityKind,
} from '../catalog/catalogLinks'
import { FilterSelect } from '../catalog/FilterSelect'
import {
  playlistTouchesArtist,
  relationTouchesLink,
  uniqueValues,
} from '../catalog/catalogGraph'
import { useCatalogSelection } from '../catalog/useCatalogSelection'
import type { OwnedItemRecord } from '../ownedItems/ownedItemsData'
import type { PlaylistRecord } from '../playlists/playlistsData'
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
  onUpdateArtist?: (artist: ArtistRecord) => void
  onManualEntryClose?: () => void
  ownedItems?: OwnedItemRecord[]
  playlists?: PlaylistRecord[]
  relations?: RelationRecord[]
  releases?: ReleaseRecord[]
  tracks?: TrackRecord[]
}

export function ArtistsWorkspace({
  artists: providedArtists,
  isManualEntryOpen = false,
  locationSearch = window.location.search,
  onAddArtist,
  onUpdateArtist,
  onManualEntryClose = () => {},
  ownedItems = [],
  playlists = [],
  relations = [],
  releases = [],
  tracks = [],
}: ArtistsWorkspaceProps) {
  const [query, setQuery] = useState('')
  const [manualArtists, setManualArtists] = useState<ArtistRecord[]>([])
  const [editingArtistId, setEditingArtistId] = useState('')
  const artists = useMemo(() => {
    return providedArtists ?? [...artistRecords, ...manualArtists]
  }, [manualArtists, providedArtists])
  const catalogData = useMemo(
    () => ({ artists, ownedItems, playlists, relations, releases, tracks }),
    [artists, ownedItems, playlists, relations, releases, tracks],
  )
  const [filters, setFilters] = useState({
    type: '',
    creditRole: '',
    relationType: '',
  })

  const visibleArtists = useMemo(() => {
    const terms = queryTerms(query)

    return artists.filter(
      (artist) =>
        terms.every((term) => artistSearchText(artist).includes(term)) &&
        (!filters.type || artist.type === filters.type) &&
        (!filters.creditRole ||
          artist.credits.some((credit) => credit.role === filters.creditRole) ||
          artist.creditHint.includes(filters.creditRole)) &&
        (!filters.relationType ||
          artist.relations.some(
            (relation) => relation.type === filters.relationType,
          )),
    )
  }, [artists, filters, query])
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

  function handleUpdateArtist(artist: ArtistRecord) {
    if (onUpdateArtist) {
      onUpdateArtist(artist)
    } else {
      setManualArtists((currentArtists) =>
        currentArtists.map((currentArtist) =>
          currentArtist.id === artist.id ? artist : currentArtist,
        ),
      )
    }

    setQuery('')
    selectArtist(artist.id)
    setEditingArtistId('')
  }

  function handleCancelEdit() {
    setEditingArtistId('')
  }

  const editingArtist = artists.find((artist) => artist.id === editingArtistId)

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
          <FilterSelect
            label="Artist type"
            value={filters.type}
            values={uniqueValues(artists.map((artist) => artist.type))}
            onChange={(type) => setFilters((current) => ({ ...current, type }))}
          />
          <FilterSelect
            label="Credit role"
            value={filters.creditRole}
            values={uniqueValues(
              artists.flatMap((artist) =>
                artist.credits.map((credit) => credit.role),
              ),
            )}
            onChange={(creditRole) =>
              setFilters((current) => ({ ...current, creditRole }))
            }
          />
          <FilterSelect
            label="Relation type"
            value={filters.relationType}
            values={uniqueValues(
              artists.flatMap((artist) =>
                artist.relations.map((relation) => relation.type),
              ),
            )}
            onChange={(relationType) =>
              setFilters((current) => ({ ...current, relationType }))
            }
          />
          <span className="result-count">{visibleArtists.length} shown</span>
        </div>
        {isManualEntryOpen ? (
          <ArtistEntryForm
            artists={artists}
            onCancel={onManualEntryClose}
            onSubmit={handleAddArtist}
          />
        ) : null}
        {editingArtist && isManualSessionRecord(editingArtist.id) ? (
          <ArtistEntryForm
            artists={artists}
            initialArtist={editingArtist}
            key={editingArtist.id}
            onCancel={handleCancelEdit}
            onSubmit={handleUpdateArtist}
          />
        ) : null}
        <ArtistTable
          artists={visibleArtists}
          selectedArtistId={selectedArtist?.id ?? ''}
          onSelectArtist={selectArtist}
        />
      </div>

      {selectedArtist ? (
        <ArtistDetail
          artist={selectedArtist}
          catalogData={catalogData}
          onEdit={
            isManualSessionRecord(selectedArtist.id)
              ? () => setEditingArtistId(selectedArtist.id)
              : undefined
          }
        />
      ) : (
        <EmptyDetailPanel title="No matching artists." />
      )}
    </section>
  )
}

type ArtistEntryFormProps = {
  artists: ArtistRecord[]
  initialArtist?: ArtistRecord
  onCancel: () => void
  onSubmit: (artist: ArtistRecord) => void
}

function ArtistEntryForm({
  artists,
  initialArtist,
  onCancel,
  onSubmit,
}: ArtistEntryFormProps) {
  const [name, setName] = useState(initialArtist?.name ?? '')
  const [type, setType] = useState<ArtistType>(initialArtist?.type ?? 'Person')
  const [creditRole, setCreditRole] = useState(initialArtist?.creditHint ?? '')
  const [relationHint, setRelationHint] = useState(
    initialArtist?.relationHint ?? '',
  )
  const [notes, setNotes] = useState(initialArtist?.summary ?? '')
  const isValid = name.trim().length > 0
  const duplicateArtist = artists.find(
    (artist) =>
      artist.id !== initialArtist?.id &&
      artist.name.toLowerCase() === name.trim().toLowerCase(),
  )
  const formTitle = initialArtist ? 'Edit artist' : 'Add artist'

  function handleSubmit() {
    const artistName = name.trim()
    const summary = textOrFallback(
      notes,
      'Manual artist draft with incomplete metadata.',
    )
    const credit = creditRole.trim()
    const relation = relationHint.trim()

    onSubmit({
      id: initialArtist?.id ?? createManualRecordId('artist', artistName),
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
      title={formTitle}
      requiredMessage="Name is required."
      isValid={isValid}
      onCancel={onCancel}
      onSubmit={handleSubmit}
      submitLabel={initialArtist ? 'Save record' : 'Add record'}
    >
      <label>
        <span>Name</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </label>
      {duplicateArtist ? (
        <p className="manual-entry-warning manual-entry-wide" role="status">
          Likely duplicate artist: {duplicateArtist.name}. Submit is still
          allowed for this session.
        </p>
      ) : null}
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
  onEdit?: () => void
}

function ArtistDetail({ artist, catalogData, onEdit }: ArtistDetailProps) {
  const {
    linkedOwnedItems,
    linkedPlaylists,
    linkedRelations,
    linkedReleases,
    linkedTracks,
  } = useMemo(() => {
    const artistLink = { kind: 'artist', id: artist.id } as const
    const artistName = artist.name.toLowerCase()
    const releaseCreditTargets = new Set(
      artist.credits
        .filter((credit) => credit.scope.toLowerCase().includes('release'))
        .map((credit) => credit.target.toLowerCase()),
    )
    const trackCreditTargets = new Set(
      artist.credits
        .filter((credit) => credit.scope.toLowerCase().includes('track'))
        .map((credit) => credit.target.toLowerCase()),
    )
    const releases = catalogData.releases.filter(
      (release) =>
        release.artistId === artist.id ||
        release.artist.toLowerCase() === artistName ||
        releaseCreditTargets.has(release.title.toLowerCase()),
    )
    const releaseIds = new Set(releases.map((release) => release.id))
    const tracks = catalogData.tracks.filter(
      (track) =>
        track.artistId === artist.id ||
        track.artist.toLowerCase() === artistName ||
        track.credits.some(
          (credit) => credit.artist.toLowerCase() === artistName,
        ) ||
        trackCreditTargets.has(track.title.toLowerCase()),
    )
    const ownedItems = catalogData.ownedItems.filter(
      (item) =>
        item.artist.toLowerCase() === artistName ||
        (item.releaseId ? releaseIds.has(item.releaseId) : false),
    )
    const relations = (catalogData.relations ?? []).filter(
      (relation) =>
        relationTouchesLink(relation, artistLink) ||
        relation.source.toLowerCase() === artistName ||
        relation.target.toLowerCase() === artistName ||
        relation.linkedEntity.toLowerCase() === artistName,
    )
    const playlists = (catalogData.playlists ?? []).filter((playlist) =>
      playlistTouchesArtist(playlist, artist),
    )

    return {
      linkedOwnedItems: ownedItems,
      linkedPlaylists: playlists,
      linkedRelations: relations,
      linkedReleases: releases,
      linkedTracks: tracks,
    }
  }, [artist, catalogData])

  return (
    <aside className="panel detail-panel" aria-labelledby="artist-detail-title">
      <div className="detail-header">
        <div className="detail-title-row">
          <span className="entity-type">{artist.type}</span>
          {onEdit ? (
            <span className="badge badge-tag">
              Session-only editable record
            </span>
          ) : null}
        </div>
        <h2 id="artist-detail-title">{artist.name}</h2>
        <p>{artist.summary}</p>
        {onEdit ? (
          <div className="detail-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={onEdit}
            >
              Edit session record
            </button>
          </div>
        ) : null}
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

      <GraphBacklinks
        title="Graph backlinks"
        emptyText="No related releases, tracks, owned items, relations or playlists yet."
        links={[
          ...linkedReleases.map((release) => ({
            href: `/releases?release=${encodeURIComponent(release.id)}`,
            label: release.title,
            meta: `Release · ${release.year} · ${release.label}`,
          })),
          ...linkedTracks.map((track) => ({
            href: `/tracks?track=${encodeURIComponent(track.id)}`,
            label: track.title,
            meta: `Track · ${track.release.title}`,
          })),
          ...linkedOwnedItems.map((item) => ({
            href: `/owned-items?ownedItem=${encodeURIComponent(item.id)}`,
            label: item.title,
            meta: `${item.medium} · ${item.status}`,
          })),
          ...linkedRelations.map((relation) => ({
            href: `/relations?relation=${encodeURIComponent(relation.id)}`,
            label: `${relation.source} to ${relation.target}`,
            meta: `${relation.relationType} · ${relation.role}`,
          })),
          ...linkedPlaylists.map((playlist) => ({
            href: `/playlists?playlist=${encodeURIComponent(playlist.id)}`,
            label: playlist.name,
            meta: `${playlist.type} playlist`,
          })),
        ]}
      />
    </aside>
  )
}

type GraphBacklinksProps = {
  emptyText: string
  links: Array<{ href: string; label: string; meta: string }>
  title: string
}

function GraphBacklinks({ emptyText, links, title }: GraphBacklinksProps) {
  const headingId = `${title.toLowerCase().replace(/\s+/g, '-')}-title`

  return (
    <section className="detail-section" aria-labelledby={headingId}>
      <h3 id={headingId}>{title}</h3>
      {links.length > 0 ? (
        <div className="relation-list">
          {links.map((link) => (
            <article key={`${link.href}-${link.label}`}>
              <a className="detail-link" href={link.href}>
                {link.label}
              </a>
              <p>{link.meta}</p>
            </article>
          ))}
        </div>
      ) : (
        <p>{emptyText}</p>
      )}
    </section>
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
