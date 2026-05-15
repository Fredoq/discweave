import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DeleteSessionRecordButton } from '../manualEntry/DeleteSessionRecordButton'
import { ManualEntryPanel } from '../manualEntry/ManualEntryPanel'
import {
  createManualRecordId,
  textOrFallback,
} from '../manualEntry/manualEntryUtils'
import { type CatalogLinkData } from '../catalog/catalogLinks'
import { FilterSelect } from '../catalog/FilterSelect'
import { relationTouchesLink, uniqueValues } from '../catalog/catalogGraph'
import type { RatingCriterion, RatingTargetType } from '../catalog/catalogApi'
import { useCatalogSelection } from '../catalog/useCatalogSelection'
import { RatingsPanel } from '../ratings/RatingsPanel'
import type { OwnedItemRecord } from '../ownedItems/ownedItemsData'
import type { PlaylistRecord } from '../playlists/playlistsData'
import { ReleaseCoverThumbnail } from '../releases/ReleaseCoverThumbnail'
import type { ReleaseCoverImage, ReleaseRecord } from '../releases/releasesData'
import type { RelationRecord } from '../relations/relationsData'
import type { TrackRecord } from '../tracks/tracksData'
import type { ArtistRecord, ArtistType } from './artistsData'

type ArtistsWorkspaceProps = {
  artists?: ArtistRecord[]
  isManualEntryOpen?: boolean
  locationSearch?: string
  onAddArtist?: (artist: ArtistRecord) => void
  onDeleteArtist?: (artistId: string) => void
  onUpdateArtist?: (artist: ArtistRecord) => void
  onManualEntryClose?: () => void
  ownedItems?: OwnedItemRecord[]
  playlists?: PlaylistRecord[]
  relations?: RelationRecord[]
  releases?: ReleaseRecord[]
  tracks?: TrackRecord[]
  ratingCriteria?: RatingCriterion[]
  onDeleteRating?: (
    targetType: RatingTargetType,
    targetId: string,
    criterionId: string,
  ) => void
  onRateTarget?: (
    targetType: RatingTargetType,
    targetId: string,
    criterionId: string,
    value: number,
  ) => void
}

export function ArtistsWorkspace({
  artists: providedArtists = [],
  isManualEntryOpen = false,
  locationSearch = window.location.search,
  onAddArtist,
  onDeleteArtist,
  onUpdateArtist,
  onManualEntryClose = () => {},
  ownedItems = [],
  playlists = [],
  relations = [],
  releases = [],
  tracks = [],
  ratingCriteria = [],
  onDeleteRating,
  onRateTarget,
}: ArtistsWorkspaceProps) {
  const [query, setQuery] = useState('')
  const [manualArtists, setManualArtists] = useState<ArtistRecord[]>([])
  const [editingArtistId, setEditingArtistId] = useState('')
  const artists = useMemo(() => {
    return [...providedArtists, ...manualArtists]
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

  function handleDeleteArtist(artistId: string) {
    if (onDeleteArtist) {
      onDeleteArtist(artistId)
    } else {
      setManualArtists((currentArtists) =>
        currentArtists.filter((artist) => artist.id !== artistId),
      )
    }

    setQuery('')
    setEditingArtistId('')
  }

  function handleCancelEdit() {
    setEditingArtistId('')
  }

  const editingArtist = artists.find((artist) => artist.id === editingArtistId)

  return (
    <section
      className="catalog-layout artists-layout"
      aria-label="Artists workspace"
    >
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
        {editingArtist ? (
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
          onEdit={() => setEditingArtistId(selectedArtist.id)}
          onDelete={() => handleDeleteArtist(selectedArtist.id)}
          ratingCriteria={ratingCriteria}
          onDeleteRating={onDeleteRating}
          onRateTarget={onRateTarget}
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
    const relation = relationHint.trim()
    const isEditing = Boolean(initialArtist)
    const hasExplicitRelation =
      relation.length > 0 && relation !== 'No relation hint recorded'

    onSubmit({
      id: initialArtist?.id ?? createManualRecordId('artist', artistName),
      name: artistName,
      type,
      aliases: [],
      members: [],
      relationHint: textOrFallback(relation, 'No relation hint recorded'),
      creditHint: isEditing
        ? (initialArtist?.creditHint ?? 'No credit appearances recorded')
        : 'No credit appearances recorded',
      relations: hasExplicitRelation
        ? [
            {
              type: 'Relation hint',
              target: relation,
              detail: summary,
            },
          ]
        : [],
      credits: isEditing ? (initialArtist?.credits ?? []) : [],
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
      <label>
        <span>Type</span>
        <select
          value={type}
          disabled={Boolean(initialArtist)}
          onChange={(event) => setType(event.target.value as ArtistType)}
        >
          <option>Person</option>
          <option>Band</option>
          <option>Project</option>
          <option>Alias</option>
          <option>Collective</option>
        </select>
      </label>
      {duplicateArtist ? (
        <p className="manual-entry-warning manual-entry-wide" role="status">
          Likely duplicate artist: {duplicateArtist.name}. Submit is still
          allowed for this session.
        </p>
      ) : null}
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
        <table className="catalog-table workspace-table artists-table">
          <thead>
            <tr>
              <th scope="col">Artist</th>
              <th scope="col">Type</th>
              <th scope="col">Aliases and members</th>
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
  onDelete?: () => void
  onEdit?: () => void
  ratingCriteria: RatingCriterion[]
  onDeleteRating?: (
    targetType: RatingTargetType,
    targetId: string,
    criterionId: string,
  ) => void
  onRateTarget?: (
    targetType: RatingTargetType,
    targetId: string,
    criterionId: string,
    value: number,
  ) => void
}

function ArtistDetail({
  artist,
  catalogData,
  onDelete,
  onEdit,
  ratingCriteria,
  onDeleteRating,
  onRateTarget,
}: ArtistDetailProps) {
  const {
    creditRoles,
    ownedCopyAppearances,
    relationAppearances,
    releaseAppearances,
    trackAppearances,
  } = useMemo(
    () => buildArtistInsights(artist, catalogData),
    [artist, catalogData],
  )

  return (
    <aside
      className="panel detail-panel artist-detail-panel"
      aria-labelledby="artist-detail-title"
    >
      <div className="detail-header">
        <div className="detail-title-row">
          <span className="entity-type">{artist.type}</span>
          {onEdit ? (
            <span className="badge badge-tag">Editable collection record</span>
          ) : null}
        </div>
        <h2 id="artist-detail-title">{artist.name}</h2>
        {artist.summary ? <p>{artist.summary}</p> : null}
        {onEdit ? (
          <div className="detail-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={onEdit}
            >
              Edit record
            </button>
            {onDelete ? (
              <DeleteSessionRecordButton
                confirmationMessage="Delete this artist and remove their credits and relations?"
                onDelete={onDelete}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      <RatingsPanel
        criteria={ratingCriteria}
        ratings={artist.ratings}
        targetId={artist.id}
        targetType="artist"
        onDeleteRating={onDeleteRating}
        onRateTarget={onRateTarget}
      />

      <section
        className="detail-section"
        aria-labelledby="artist-relations-title"
      >
        <h3 id="artist-relations-title">Relations and credits</h3>
        <ArtistStats
          releases={releaseAppearances.length}
          tracks={trackAppearances.length}
          copies={ownedCopyAppearances.length}
          roles={creditRoles.length}
        />
        <BadgeList values={creditRoles} emptyText="No credit roles recorded" />
        <AppearanceList
          emptyText="No direct artist relations recorded."
          items={relationAppearances}
        />
      </section>

      <section
        className="detail-section"
        aria-labelledby="artist-credits-title"
      >
        <h3 id="artist-credits-title">Credit appearances</h3>
        <div className="artist-appearance-groups">
          <AppearanceGroup
            title="Releases"
            emptyText="No release appearances recorded."
            items={releaseAppearances}
          />
          <AppearanceGroup
            title="Tracks"
            emptyText="No track appearances recorded."
            items={trackAppearances}
          />
        </div>
      </section>

      <section className="detail-section" aria-labelledby="artist-copies-title">
        <h3 id="artist-copies-title">Collection copies</h3>
        <AppearanceList
          emptyText="No owned copies linked to this artist yet."
          items={ownedCopyAppearances}
        />
      </section>

      <section
        className="detail-section"
        aria-labelledby="artist-aliases-title"
      >
        <h3 id="artist-aliases-title">Aliases, members and tags</h3>
        <BadgeList
          values={[...artist.aliases, ...artist.members, ...artist.tags]}
          emptyText="No aliases, members or tags recorded"
        />
      </section>
    </aside>
  )
}

type ArtistAppearance = {
  context: string
  coverImage?: ReleaseCoverImage
  href?: string
  key: string
  label: string
  meta: string
  roles: string[]
  thumbnailTitle?: string
}

function buildArtistInsights(
  artist: ArtistRecord,
  catalogData: CatalogLinkData,
) {
  const artistLink = { kind: 'artist', id: artist.id } as const
  const artistName = normalizeText(artist.name)
  const creditRoles = uniqueValues(artist.credits.map((credit) => credit.role))

  const releaseAppearances = catalogData.releases.flatMap((release) => {
    const roles = new Set<string>()

    if (
      release.artistId === artist.id ||
      normalizeText(release.artist) === artistName
    ) {
      roles.add('Main artist')
    }

    for (const credit of release.artistCredits ?? []) {
      if (artistCreditMatches(credit, artist, artistName)) {
        roles.add(credit.role)
      }
    }

    for (const credit of matchingTargetCredits(artist, release.title)) {
      roles.add(credit.role)
    }

    if (roles.size === 0) {
      return []
    }

    return [
      {
        key: `release-${release.id}`,
        coverImage: release.coverImage,
        href: `/releases?release=${encodeURIComponent(release.id)}`,
        label: release.title,
        roles: [...roles],
        thumbnailTitle: release.title,
        meta: [release.type, release.year, release.label]
          .filter(Boolean)
          .join(' · '),
        context: release.genres.join(', ') || release.releaseNotes,
      },
    ]
  })

  const releaseIds = new Set(
    releaseAppearances.map((appearance) =>
      appearance.href?.replace('/releases?release=', ''),
    ),
  )

  const trackAppearances = catalogData.tracks.flatMap((track) => {
    const roles = new Set<string>()

    if (
      track.artistId === artist.id ||
      normalizeText(track.artist) === artistName
    ) {
      roles.add('Main artist')
    }

    for (const credit of track.credits) {
      if (artistCreditMatches(credit, artist, artistName)) {
        roles.add(credit.role)
      }
    }

    for (const credit of matchingTargetCredits(artist, track.title)) {
      roles.add(credit.role)
    }

    if (roles.size === 0) {
      return []
    }

    if (track.release.id) {
      releaseIds.add(encodeURIComponent(track.release.id))
    }

    for (const appearance of track.releaseAppearances) {
      if (appearance.releaseId) {
        releaseIds.add(encodeURIComponent(appearance.releaseId))
      }
    }

    return [
      {
        key: `track-${track.id}`,
        href: `/tracks?track=${encodeURIComponent(track.id)}`,
        label: track.title,
        roles: [...roles],
        meta: [
          track.trackNumber ? `Track ${track.trackNumber}` : '',
          track.release.title,
          track.duration,
        ]
          .filter(Boolean)
          .join(' · '),
        context: track.versionHint || track.relationHint,
      },
    ]
  })

  const ownedCopyAppearances = catalogData.ownedItems.flatMap((item) => {
    const itemReleaseId = item.releaseId
      ? encodeURIComponent(item.releaseId)
      : undefined

    if (
      normalizeText(item.artist) !== artistName &&
      (!itemReleaseId || !releaseIds.has(itemReleaseId))
    ) {
      return []
    }

    return [
      {
        key: `owned-item-${item.id}`,
        href: `/owned-items?ownedItem=${encodeURIComponent(item.id)}`,
        label: item.title,
        roles: [item.status],
        meta: [item.medium, item.fileFormat].filter(Boolean).join(' · '),
        context: [item.storage, item.condition].filter(Boolean).join(' · '),
      },
    ]
  })

  const catalogRelations = (catalogData.relations ?? []).filter(
    (relation) =>
      relationTouchesLink(relation, artistLink) ||
      normalizeText(relation.source) === artistName ||
      normalizeText(relation.target) === artistName ||
      normalizeText(relation.linkedEntity) === artistName,
  )

  const relationAppearances = [
    ...artist.relations.map((relation) => ({
      key: `artist-relation-${relation.type}-${relation.target}`,
      label: relation.target,
      roles: [relation.type],
      meta: 'Artist relation',
      context: relation.detail,
    })),
    ...catalogRelations.map((relation) => ({
      key: `catalog-relation-${relation.id}`,
      href: `/relations?relation=${encodeURIComponent(relation.id)}`,
      label: `${relation.source} to ${relation.target}`,
      roles: [relation.relationType, relation.role].filter(Boolean),
      meta: relation.linkedEntity
        ? `${relation.linkedEntityType} · ${relation.linkedEntity}`
        : relation.direction,
      context: relation.context,
    })),
  ]

  return {
    creditRoles,
    ownedCopyAppearances,
    relationAppearances: dedupeAppearances(relationAppearances),
    releaseAppearances: dedupeAppearances(releaseAppearances),
    trackAppearances: dedupeAppearances(trackAppearances),
  }
}

function matchingTargetCredits(artist: ArtistRecord, target: string) {
  const normalizedTarget = normalizeText(target)

  return artist.credits.filter(
    (credit) => normalizeText(credit.target) === normalizedTarget,
  )
}

function artistCreditMatches(
  credit: { artistId?: string; artist: string },
  artist: ArtistRecord,
  artistName: string,
) {
  return (
    credit.artistId === artist.id || normalizeText(credit.artist) === artistName
  )
}

function dedupeAppearances(appearances: ArtistAppearance[]) {
  const merged = new Map<string, ArtistAppearance>()

  for (const appearance of appearances) {
    const existing = merged.get(appearance.key)

    if (!existing) {
      merged.set(appearance.key, appearance)
      continue
    }

    merged.set(appearance.key, {
      ...existing,
      coverImage: existing.coverImage ?? appearance.coverImage,
      roles: uniqueValues([...existing.roles, ...appearance.roles]),
      thumbnailTitle: existing.thumbnailTitle ?? appearance.thumbnailTitle,
    })
  }

  return [...merged.values()]
}

function normalizeText(value: string) {
  return value.trim().toLowerCase()
}

type ArtistStatsProps = {
  copies: number
  releases: number
  roles: number
  tracks: number
}

function ArtistStats({ copies, releases, roles, tracks }: ArtistStatsProps) {
  return (
    <dl className="artist-stat-grid">
      <div>
        <dt>Releases</dt>
        <dd>{releases}</dd>
      </div>
      <div>
        <dt>Tracks</dt>
        <dd>{tracks}</dd>
      </div>
      <div>
        <dt>Copies</dt>
        <dd>{copies}</dd>
      </div>
      <div>
        <dt>Roles</dt>
        <dd>{roles}</dd>
      </div>
    </dl>
  )
}

type AppearanceGroupProps = {
  emptyText: string
  items: ArtistAppearance[]
  title: string
}

function AppearanceGroup({ emptyText, items, title }: AppearanceGroupProps) {
  return (
    <div className="artist-appearance-group">
      <div className="artist-appearance-heading">
        <strong>{title}</strong>
        <span>{items.length}</span>
      </div>
      <AppearanceList emptyText={emptyText} items={items} />
    </div>
  )
}

type AppearanceListProps = {
  emptyText: string
  items: ArtistAppearance[]
}

function AppearanceList({ emptyText, items }: AppearanceListProps) {
  if (items.length === 0) {
    return <p className="detail-empty">{emptyText}</p>
  }

  return (
    <div className="artist-appearance-list">
      {items.map((item) => (
        <article
          className={
            item.thumbnailTitle
              ? 'artist-appearance-card artist-appearance-card-with-thumbnail'
              : 'artist-appearance-card'
          }
          key={item.key}
        >
          {item.thumbnailTitle ? (
            <ReleaseCoverThumbnail
              coverImage={item.coverImage}
              title={item.thumbnailTitle}
            />
          ) : null}
          <div className="artist-appearance-card-body">
            <div className="artist-appearance-card-header">
              {item.href ? (
                <a className="detail-link" href={item.href}>
                  {item.label}
                </a>
              ) : (
                <strong>{item.label}</strong>
              )}
              <BadgeList values={item.roles} />
            </div>
            <p>{item.meta}</p>
            {item.context ? <p>{item.context}</p> : null}
          </div>
        </article>
      ))}
    </div>
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
  emptyText?: string
  values: string[]
}

function BadgeList({ emptyText = 'None recorded', values }: BadgeListProps) {
  if (values.length === 0) {
    return <span className="detail-empty">{emptyText}</span>
  }

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
