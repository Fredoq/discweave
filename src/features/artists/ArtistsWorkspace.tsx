import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ManualEntryPanel } from '../manualEntry/ManualEntryPanel'
import {
  createManualRecordId,
  textOrFallback,
} from '../manualEntry/manualEntryUtils'
import { FilterSelect } from '../catalog/FilterSelect'
import type { ExternalMetadataArtistDetailDto } from '../catalog/catalogApi'
import { uniqueValues } from '../catalog/catalogGraph'
import type { RatingCriterion, RatingTargetType } from '../catalog/catalogApi'
import { useCatalogSelection } from '../catalog/useCatalogSelection'
import type { OwnedItemRecord } from '../ownedItems/ownedItemsData'
import type { PlaylistRecord } from '../playlists/playlistsData'
import type { ReleaseRecord } from '../releases/releasesData'
import type { RelationRecord } from '../relations/relationsData'
import type { TrackRecord } from '../tracks/tracksData'
import { ArtistDetail, EmptyDetailPanel } from './ArtistDetail'
import {
  DiscogsArtistLookupPanel,
  type DiscogsArtistApplyGroups,
} from './DiscogsArtistLookupPanel'
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
  const [discogsLookupArtistId, setDiscogsLookupArtistId] = useState('')
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
    setDiscogsLookupArtistId('')
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
    setDiscogsLookupArtistId('')
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
    setDiscogsLookupArtistId('')
  }

  function handleCancelEdit() {
    setEditingArtistId('')
    setDiscogsLookupArtistId('')
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
            initialShowDiscogsLookup={
              editingArtist.id === discogsLookupArtistId
            }
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
          onEdit={() => {
            setEditingArtistId(selectedArtist.id)
            setDiscogsLookupArtistId('')
          }}
          onUpdateViaDiscogs={() => {
            setEditingArtistId(selectedArtist.id)
            setDiscogsLookupArtistId(selectedArtist.id)
          }}
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

export type ArtistEntryFormProps = {
  artists: ArtistRecord[]
  initialArtist?: ArtistRecord
  initialShowDiscogsLookup?: boolean
  onCancel: () => void
  onSubmit: (artist: ArtistRecord) => void
}

export function ArtistEntryForm({
  artists,
  initialArtist,
  initialShowDiscogsLookup,
  onCancel,
  onSubmit,
}: ArtistEntryFormProps) {
  const [name, setName] = useState(initialArtist?.name ?? '')
  const [type, setType] = useState<ArtistType>(initialArtist?.type ?? 'Person')
  const [relationHint, setRelationHint] = useState(
    initialArtist?.relationHint ?? '',
  )
  const [notes, setNotes] = useState(initialArtist?.summary ?? '')
  const [externalSources, setExternalSources] = useState(
    initialArtist?.externalSources,
  )
  const [discogsLookupOpenPreference, setDiscogsLookupOpenPreference] =
    useState<boolean | null>(null)
  const isDiscogsLookupOpen =
    discogsLookupOpenPreference ?? Boolean(initialShowDiscogsLookup)
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
      externalSources,
    })
  }

  function handleApplyDiscogsDraft(
    detail: ExternalMetadataArtistDetailDto,
    groups: DiscogsArtistApplyGroups,
  ) {
    if (groups.core) {
      setName(detail.draft.name)
    }

    if (groups.externalSource) {
      setExternalSources(
        detail.draft.externalSources.map((source) => ({
          ...source,
          appliedAt: new Date().toISOString(),
        })),
      )
    }
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
      <DiscogsArtistLookupPanel
        current={{
          externalSourceCount: externalSources?.length ?? 0,
          name,
          type,
        }}
        isOpen={isDiscogsLookupOpen}
        mode={initialArtist ? 'update' : 'create'}
        searchSeed={name}
        onApplyDraft={handleApplyDiscogsDraft}
        onOpenChange={setDiscogsLookupOpenPreference}
      />
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

function joinOrEmpty(values: string[]) {
  return values.length > 0 ? values.join(', ') : 'None recorded'
}
