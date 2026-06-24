import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ManualEntryPanel } from '../manualEntry/ManualEntryPanel'
import {
  createManualRecordId,
  textOrFallback,
} from '../manualEntry/manualEntryUtils'
import { FilterSelect } from '../catalog/FilterSelect'
import type { CatalogLinkData } from '../catalog/catalogLinks'
import type {
  DiscogsArtistApplyRequest,
  DiscogsIntegrationStatus,
  ExternalMetadataArtistDetailDto,
} from '../catalog/catalogApi'
import { toDiscogsArtistApplyRequest } from '../catalog/catalogApi'
import { uniqueValues } from '../catalog/catalogGraph'
import type { RatingCriterion, RatingTargetType } from '../catalog/catalogApi'
import { useCatalogSelection } from '../catalog/useCatalogSelection'
import type { OwnedItemRecord } from '../ownedItems/ownedItemsData'
import type { PlaylistRecord } from '../playlists/playlistsData'
import type { ReleaseRecord } from '../releases/releasesData'
import type { RelationRecord } from '../relations/relationsData'
import type { TrackRecord } from '../tracks/tracksData'
import { ArtistDetail, EmptyDetailPanel } from './ArtistDetail'
import { DiscogsArtistLookupPanel } from './DiscogsArtistLookupPanel'
import type { ArtistRecord, ArtistType } from './artistsData'

type ArtistsWorkspaceProps = {
  artists?: ArtistRecord[]
  isManualEntryOpen?: boolean
  locationSearch?: string
  onAddArtist?: (
    artist: ArtistRecord,
    discogsArtist?: DiscogsArtistApplyRequest | null,
  ) => void
  onDeleteArtist?: (artistId: string) => void
  onUpdateArtist?: (
    artist: ArtistRecord,
    discogsArtist?: DiscogsArtistApplyRequest | null,
  ) => void
  onManualEntryClose?: () => void
  ownedItems?: OwnedItemRecord[]
  playlists?: PlaylistRecord[]
  relations?: RelationRecord[]
  releases?: ReleaseRecord[]
  tracks?: TrackRecord[]
  ratingCriteria?: RatingCriterion[]
  discogsIntegrationStatus?: DiscogsIntegrationStatus
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
  discogsIntegrationStatus,
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
  const canUseDiscogs = discogsIntegrationStatus?.configured !== false
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

  function handleAddArtist(
    artist: ArtistRecord,
    discogsArtist?: DiscogsArtistApplyRequest | null,
  ) {
    if (onAddArtist) {
      onAddArtist(artist, discogsArtist)
    } else {
      setManualArtists((currentArtists) => [...currentArtists, artist])
    }

    setQuery('')
    selectArtist(artist.id)
    onManualEntryClose()
    setDiscogsLookupArtistId('')
  }

  function handleUpdateArtist(
    artist: ArtistRecord,
    discogsArtist?: DiscogsArtistApplyRequest | null,
  ) {
    if (onUpdateArtist) {
      onUpdateArtist(artist, discogsArtist)
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
        <ArtistMasterList
          artists={visibleArtists}
          catalogData={catalogData}
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
          canUpdateViaDiscogs={canUseDiscogs}
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
  onSubmit: (
    artist: ArtistRecord,
    discogsArtist?: DiscogsArtistApplyRequest | null,
  ) => void
}

export function ArtistEntryForm({
  artists,
  initialArtist,
  initialShowDiscogsLookup,
  onCancel,
  onSubmit,
}: ArtistEntryFormProps) {
  const [name, setName] = useState(initialArtist?.name ?? '')
  const [type, setType] = useState<ArtistType>(
    normalizeEditableArtistType(initialArtist?.type),
  )
  const [relationHint, setRelationHint] = useState(
    initialArtist?.relationHint ?? '',
  )
  const [notes, setNotes] = useState(initialArtist?.summary ?? '')
  const [externalSources, setExternalSources] = useState(
    initialArtist?.externalSources,
  )
  const [selectedDiscogsArtist, setSelectedDiscogsArtist] =
    useState<ExternalMetadataArtistDetailDto | null>(null)
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

    onSubmit(
      {
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
      },
      selectedDiscogsArtist
        ? toDiscogsArtistApplyRequest(selectedDiscogsArtist)
        : null,
    )
  }

  function handleApplyDiscogsDraft(detail: ExternalMetadataArtistDetailDto) {
    setSelectedDiscogsArtist(detail)
    setName(detail.draft.name)
    setType(artistTypeFromDiscogsDetail(detail))
    setExternalSources((currentSources) =>
      upsertExternalSources(currentSources, detail.draft.externalSources),
    )
  }

  function handleTypeChange(nextType: ArtistType) {
    if (
      selectedDiscogsArtist &&
      nextType !== artistTypeFromDiscogsDetail(selectedDiscogsArtist)
    ) {
      setSelectedDiscogsArtist(null)
    }

    setType(nextType)
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
          onChange={(event) =>
            handleTypeChange(event.target.value as ArtistType)
          }
        >
          {persistedArtistTypeOptions.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>
      <DiscogsArtistLookupPanel
        current={{
          externalSourceCount: externalSources?.length ?? 0,
          name,
          type,
        }}
        isOpen={isDiscogsLookupOpen}
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

type ArtistMasterListProps = {
  artists: ArtistRecord[]
  catalogData: CatalogLinkData
  selectedArtistId: string
  onSelectArtist: (artistId: string) => void
}

function ArtistMasterList({
  artists,
  catalogData,
  selectedArtistId,
  onSelectArtist,
}: ArtistMasterListProps) {
  return (
    <section
      className="panel catalog-panel"
      aria-labelledby="artist-results-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="artist-results-title">Artist master list</h2>
          <p>Aliases, memberships and collection activity for graph lookup.</p>
        </div>
      </div>

      <div
        className="artist-master-list"
        role="list"
        aria-label="Artist master list"
      >
        {artists.map((artist) => (
          <ArtistMasterRow
            key={artist.id}
            artist={artist}
            catalogData={catalogData}
            isSelected={artist.id === selectedArtistId}
            onSelect={() => onSelectArtist(artist.id)}
          />
        ))}
      </div>
    </section>
  )
}

type ArtistMasterRowProps = {
  artist: ArtistRecord
  catalogData: CatalogLinkData
  isSelected: boolean
  onSelect: () => void
}

function ArtistMasterRow({
  artist,
  catalogData,
  isSelected,
  onSelect,
}: ArtistMasterRowProps) {
  const summary = buildArtistMasterRowSummary(artist, catalogData)
  const hasRelationshipGroups =
    summary.aliases.length > 0 ||
    summary.members.length > 0 ||
    summary.memberships.length > 0 ||
    summary.otherRelations.length > 0

  return (
    <div role="listitem">
      <button
        className={
          isSelected
            ? 'artist-master-row is-selected'
            : 'artist-master-row'
        }
        type="button"
        aria-label={`${artist.name} artist row`}
        aria-selected={isSelected}
        onClick={onSelect}
      >
        <span className="artist-master-row-main">
          <span className="artist-master-row-title">
            <strong>{artist.name}</strong>
            <span className="badge badge-tag">{artist.type}</span>
            {artist.tags.length > 0 ? (
              <span className="artist-master-tags">
                {artist.tags.join(', ')}
              </span>
            ) : null}
          </span>

          {hasRelationshipGroups ? (
            <span className="artist-master-groups">
              <ArtistMasterChipGroup label="Aliases" values={summary.aliases} />
              <ArtistMasterChipGroup label="Members" values={summary.members} />
              <ArtistMasterChipGroup
                label="Memberships"
                values={summary.memberships}
              />
              <ArtistMasterChipGroup
                label="Relations"
                values={summary.otherRelations}
              />
            </span>
          ) : (
            <span className="artist-master-empty">
              No aliases, members or relations recorded
            </span>
          )}
        </span>

        <span className="artist-master-activity" aria-label="Activity counts">
          <ArtistActivityCount label="Releases" value={summary.releases} />
          <ArtistActivityCount label="Tracks" value={summary.tracks} />
          <ArtistActivityCount label="Copies" value={summary.copies} />
        </span>
      </button>
    </div>
  )
}

function ArtistMasterChipGroup({
  label,
  values,
}: {
  label: string
  values: string[]
}) {
  if (values.length === 0) {
    return null
  }

  return (
    <span className="artist-master-chip-group">
      <span className="artist-master-chip-label">{label}</span>
      {values.map((value) => (
        <span className="badge badge-tag" key={value}>
          {value}
        </span>
      ))}
    </span>
  )
}

function ArtistActivityCount({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <span className="artist-master-count">
      <span>{label}</span>
      <strong>{value}</strong>
    </span>
  )
}

function buildArtistMasterRowSummary(
  artist: ArtistRecord,
  catalogData: CatalogLinkData,
) {
  const artistName = normalizeText(artist.name)
  const releaseIds = new Set<string>()
  const releases = catalogData.releases.filter((release) => {
    const matches =
      release.artistId === artist.id ||
      normalizeText(release.artist) === artistName ||
      (release.artistCredits ?? []).some((credit) =>
        artistCreditMatches(credit, artist, artistName),
      ) ||
      artist.credits.some(
        (credit) =>
          normalizeText(credit.target) === normalizeText(release.title) &&
          normalizeText(credit.scope) === 'release',
      )

    if (matches) {
      releaseIds.add(release.id)
    }

    return matches
  })
  const tracks = catalogData.tracks.filter((track) => {
    const matches =
      track.artistId === artist.id ||
      normalizeText(track.artist) === artistName ||
      track.credits.some((credit) =>
        artistCreditMatches(credit, artist, artistName),
      ) ||
      artist.credits.some(
        (credit) =>
          normalizeText(credit.target) === normalizeText(track.title) &&
          normalizeText(credit.scope) === 'track',
      )

    if (matches && track.release.id) {
      releaseIds.add(track.release.id)
    }

    return matches
  })
  const copies = catalogData.ownedItems.filter(
    (item) =>
      normalizeText(item.artist) === artistName ||
      (item.releaseId ? releaseIds.has(item.releaseId) : false),
  )

  return {
    aliases: uniqueNonEmpty(artist.aliases),
    members: uniqueNonEmpty(artist.members),
    memberships: shouldShowMemberships(artist)
      ? relationshipLabels(artist, 'member of')
      : [],
    otherRelations: otherRelationshipLabels(artist),
    copies: copies.length,
    releases: releases.length,
    tracks: tracks.length,
  }
}

function shouldShowMemberships(artist: ArtistRecord) {
  return (
    artist.type !== 'Band' &&
    artist.type !== 'Project' &&
    artist.type !== 'Collective'
  )
}

function relationshipLabels(artist: ArtistRecord, type: string) {
  const normalizedType = normalizeText(type)

  return uniqueNonEmpty(
    artist.relations
      .filter((relation) => normalizeText(relation.type) === normalizedType)
      .map((relation) => relationLabel(relation.type, relation.target)),
  )
}

function otherRelationshipLabels(artist: ArtistRecord) {
  const aliases = new Set(artist.aliases.map(normalizeText))
  const members = new Set(artist.members.map(normalizeText))
  const skippedTypes = new Set(['alias', 'member', 'member of'])

  return uniqueNonEmpty(
    artist.relations
      .filter((relation) => {
        const normalizedType = normalizeText(relation.type)
        const normalizedTarget = normalizeText(relation.target)

        if (skippedTypes.has(normalizedType)) {
          return false
        }

        return !aliases.has(normalizedTarget) && !members.has(normalizedTarget)
      })
      .map((relation) => relationLabel(relation.type, relation.target)),
  )
}

function relationLabel(type: string, target: string) {
  const normalizedType = normalizeText(type)

  if (normalizedType === 'member of') {
    return `Member of ${target}`
  }

  return `${type} ${target}`
}

function uniqueNonEmpty(values: string[]) {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const trimmed = value.trim()
    const key = normalizeText(trimmed)

    if (!trimmed || seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(trimmed)
  }

  return result
}

function normalizeText(value: string) {
  return value.trim().toLowerCase()
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

const persistedArtistTypeOptions: ArtistType[] = ['Person', 'Band']

function normalizeEditableArtistType(type: ArtistType | undefined): ArtistType {
  if (type === 'Band' || type === 'Project' || type === 'Collective') {
    return 'Band'
  }

  return 'Person'
}

function artistTypeFromDiscogsDetail(
  detail: ExternalMetadataArtistDetailDto,
): ArtistType {
  return detail.members.some((member) => member.trim().length > 0)
    ? 'Band'
    : 'Person'
}

function upsertExternalSources(
  currentSources: ArtistRecord['externalSources'],
  nextSources: ArtistRecord['externalSources'],
) {
  const appliedAt = new Date().toISOString()
  const appliedSources = (nextSources ?? []).map((source) => ({
    ...source,
    appliedAt,
  }))

  return [
    ...(currentSources ?? []).filter(
      (source) =>
        !appliedSources.some((appliedSource) =>
          hasSameExternalSourceIdentity(source, appliedSource),
        ),
    ),
    ...appliedSources,
  ]
}

function hasSameExternalSourceIdentity(
  source: NonNullable<ArtistRecord['externalSources']>[number],
  other: NonNullable<ArtistRecord['externalSources']>[number],
) {
  return (
    source.providerName.toLowerCase() === other.providerName.toLowerCase() &&
    source.resourceType.toLowerCase() === other.resourceType.toLowerCase() &&
    source.externalId === other.externalId
  )
}
