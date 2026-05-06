import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DeleteSessionRecordButton } from '../manualEntry/DeleteSessionRecordButton'
import { ManualEntryPanel } from '../manualEntry/ManualEntryPanel'
import {
  createManualRecordId,
  textOrFallback,
} from '../manualEntry/manualEntryUtils'
import type { ArtistRecord } from '../artists/artistsData'
import {
  catalogEntityHref,
  catalogLinkOptions,
  findCatalogOption,
  hasCatalogLink,
  type CatalogLink,
  type CatalogLinkData,
  type CatalogLinkOption,
} from '../catalog/catalogLinks'
import { FilterSelect } from '../catalog/FilterSelect'
import { uniqueValues } from '../catalog/catalogGraph'
import { useCatalogSelection } from '../catalog/useCatalogSelection'
import type { OwnedItemRecord } from '../ownedItems/ownedItemsData'
import type { PlaylistRecord } from '../playlists/playlistsData'
import type { ReleaseRecord } from '../releases/releasesData'
import type { TrackRecord } from '../tracks/tracksData'
import type { RelationRecord } from './relationsData'

type RelationsWorkspaceProps = {
  artists?: ArtistRecord[]
  isManualEntryOpen?: boolean
  locationSearch?: string
  onAddRelation?: (relation: RelationRecord) => void
  onDeleteRelation?: (relationId: string) => void
  onUpdateRelation?: (relation: RelationRecord) => void
  onManualEntryClose?: () => void
  ownedItems?: OwnedItemRecord[]
  playlists?: PlaylistRecord[]
  relations?: RelationRecord[]
  releases?: ReleaseRecord[]
  tracks?: TrackRecord[]
}

export function RelationsWorkspace({
  artists = [],
  isManualEntryOpen = false,
  locationSearch = window.location.search,
  onAddRelation,
  onDeleteRelation,
  onUpdateRelation,
  onManualEntryClose = () => {},
  ownedItems = [],
  playlists = [],
  relations: providedRelations,
  releases = [],
  tracks = [],
}: RelationsWorkspaceProps) {
  const [query, setQuery] = useState('')
  const [manualRelations, setManualRelations] = useState<RelationRecord[]>([])
  const [editingRelationId, setEditingRelationId] = useState('')
  const relations = useMemo(() => {
    return [...(providedRelations ?? []), ...manualRelations]
  }, [manualRelations, providedRelations])
  const catalogData = useMemo(
    () => ({ artists, releases, tracks, ownedItems, relations, playlists }),
    [artists, ownedItems, playlists, relations, releases, tracks],
  )
  const linkOptions = useMemo(
    () => catalogLinkOptions(catalogData),
    [catalogData],
  )

  const [filters, setFilters] = useState({
    relationType: '',
    sourceKind: '',
    targetKind: '',
    linkedKind: '',
  })
  const visibleRelations = useMemo(() => {
    return filterRelations(query, relations).filter(
      (relation) =>
        (!filters.relationType ||
          relation.relationType === filters.relationType) &&
        (!filters.sourceKind || relation.sourceType === filters.sourceKind) &&
        (!filters.targetKind || relation.targetType === filters.targetKind) &&
        (!filters.linkedKind ||
          relation.linkedEntityType === filters.linkedKind),
    )
  }, [filters, query, relations])
  const { selectedRecord: selectedRelation, selectRecord: selectRelation } =
    useCatalogSelection({
      locationSearch,
      queryParam: 'relation',
      records: relations,
      routePath: '/relations',
      visibleRecords: visibleRelations,
    })

  function handleQueryChange(nextQuery: string) {
    setQuery(nextQuery)
  }

  function handleAddRelation(relation: RelationRecord) {
    if (onAddRelation) {
      onAddRelation(relation)
    } else {
      setManualRelations((currentRelations) => [...currentRelations, relation])
    }

    setQuery('')
    selectRelation(relation.id)
    onManualEntryClose()
  }

  function handleUpdateRelation(relation: RelationRecord) {
    if (onUpdateRelation) {
      onUpdateRelation(relation)
    } else {
      setManualRelations((currentRelations) =>
        currentRelations.map((currentRelation) =>
          currentRelation.id === relation.id ? relation : currentRelation,
        ),
      )
    }

    setQuery('')
    selectRelation(relation.id)
    setEditingRelationId('')
  }

  function handleDeleteRelation(relationId: string) {
    if (onDeleteRelation) {
      onDeleteRelation(relationId)
    } else {
      setManualRelations((currentRelations) =>
        currentRelations
          .map((relation) =>
            relation.id === relationId
              ? relation
              : clearRelationLink(relation, {
                  kind: 'relation',
                  id: relationId,
                }),
          )
          .filter((relation) => relation.id !== relationId),
      )
    }

    setQuery('')
    setEditingRelationId('')
  }

  const editingRelation = relations.find(
    (relation) => relation.id === editingRelationId,
  )

  return (
    <section className="catalog-layout" aria-label="Relations workspace">
      <div className="catalog-main">
        <SearchField
          label="Search relations"
          placeholder="Source, target, type, role, release, track or context"
          query={query}
          onQueryChange={handleQueryChange}
        />
        <div className="filter-bar">
          <FilterSelect
            label="Relation type"
            value={filters.relationType}
            values={uniqueValues(
              relations.map((relation) => relation.relationType),
            )}
            onChange={(relationType) =>
              setFilters((current) => ({ ...current, relationType }))
            }
          />
          <FilterSelect
            label="Source kind"
            value={filters.sourceKind}
            values={uniqueValues(
              relations.map((relation) => relation.sourceType),
            )}
            onChange={(sourceKind) =>
              setFilters((current) => ({ ...current, sourceKind }))
            }
          />
          <FilterSelect
            label="Target kind"
            value={filters.targetKind}
            values={uniqueValues(
              relations.map((relation) => relation.targetType),
            )}
            onChange={(targetKind) =>
              setFilters((current) => ({ ...current, targetKind }))
            }
          />
          <FilterSelect
            label="Linked entity kind"
            value={filters.linkedKind}
            values={uniqueValues(
              relations.map((relation) => relation.linkedEntityType),
            )}
            onChange={(linkedKind) =>
              setFilters((current) => ({ ...current, linkedKind }))
            }
          />
          <span className="result-count">{visibleRelations.length} shown</span>
        </div>
        {isManualEntryOpen ? (
          <RelationEntryForm
            linkOptions={linkOptions}
            relations={relations}
            onCancel={onManualEntryClose}
            onSubmit={handleAddRelation}
          />
        ) : null}
        {editingRelation ? (
          <RelationEntryForm
            initialRelation={editingRelation}
            key={editingRelation.id}
            linkOptions={linkOptions}
            relations={relations}
            onCancel={() => setEditingRelationId('')}
            onSubmit={handleUpdateRelation}
          />
        ) : null}
        <RelationsTable
          relations={visibleRelations}
          selectedRelationId={selectedRelation?.id ?? ''}
          onSelectRelation={selectRelation}
        />
      </div>

      {selectedRelation ? (
        <RelationDetail
          catalogData={catalogData}
          onEdit={() => setEditingRelationId(selectedRelation.id)}
          onDelete={() => handleDeleteRelation(selectedRelation.id)}
          relation={selectedRelation}
        />
      ) : (
        <EmptyDetailPanel />
      )}
    </section>
  )
}

type RelationEntryFormProps = {
  initialRelation?: RelationRecord
  linkOptions: CatalogLinkOption[]
  relations: RelationRecord[]
  onCancel: () => void
  onSubmit: (relation: RelationRecord) => void
}

function RelationEntryForm({
  initialRelation,
  linkOptions,
  relations,
  onCancel,
  onSubmit,
}: RelationEntryFormProps) {
  const [selectedSourceValue, setSelectedSourceValue] = useState(
    initialRelation?.sourceLink
      ? `${initialRelation.sourceLink.kind}:${initialRelation.sourceLink.id}`
      : '',
  )
  const [source, setSource] = useState(
    initialRelation?.sourceLink ? '' : (initialRelation?.source ?? ''),
  )
  const [selectedTargetValue, setSelectedTargetValue] = useState(
    initialRelation?.targetLink
      ? `${initialRelation.targetLink.kind}:${initialRelation.targetLink.id}`
      : '',
  )
  const [target, setTarget] = useState(
    initialRelation?.targetLink ? '' : (initialRelation?.target ?? ''),
  )
  const [relationType, setRelationType] = useState(
    initialRelation?.relationType ?? '',
  )
  const [role, setRole] = useState(initialRelation?.role ?? '')
  const [selectedLinkedEntityValue, setSelectedLinkedEntityValue] = useState(
    initialRelation?.linkedEntityLink
      ? `${initialRelation.linkedEntityLink.kind}:${initialRelation.linkedEntityLink.id}`
      : '',
  )
  const [linkedEntity, setLinkedEntity] = useState(
    initialRelation?.linkedEntityLink
      ? ''
      : (initialRelation?.linkedEntity ?? ''),
  )
  const [context, setContext] = useState(initialRelation?.context ?? '')
  const selectedSource = findCatalogOption(linkOptions, selectedSourceValue)
  const selectedTarget = findCatalogOption(linkOptions, selectedTargetValue)
  const selectedLinkedEntity = findCatalogOption(
    linkOptions,
    selectedLinkedEntityValue,
  )
  const sourceName = selectedSource?.name ?? source.trim()
  const targetName = selectedTarget?.name ?? target.trim()
  const isValid = sourceName.length > 0 && targetName.length > 0
  const relationTypeName = textOrFallback(relationType, 'Unspecified relation')
  const duplicateRelation = relations.find(
    (relation) =>
      relation.id !== initialRelation?.id &&
      relation.source.toLowerCase() === sourceName.toLowerCase() &&
      relation.target.toLowerCase() === targetName.toLowerCase() &&
      relation.relationType.toLowerCase() === relationTypeName.toLowerCase(),
  )
  const formTitle = initialRelation ? 'Edit relation' : 'Add relation'

  function handleSubmit() {
    const type = relationTypeName
    const roleName = textOrFallback(role, 'Unspecified role')
    const evidence = textOrFallback(context, 'No context or evidence recorded.')
    const linkedEntityName =
      selectedLinkedEntity?.name ??
      textOrFallback(linkedEntity, selectedTarget?.name ?? targetName)
    const linkedEntityLink = selectedLinkedEntity ?? selectedTarget ?? undefined

    onSubmit({
      id:
        initialRelation?.id ??
        createManualRecordId('relation', `${sourceName}-${targetName}`),
      source: sourceName,
      sourceLink: selectedSource ? linkFromOption(selectedSource) : undefined,
      sourceType: selectedSource?.typeLabel ?? 'Manual source',
      target: targetName,
      targetLink: selectedTarget ? linkFromOption(selectedTarget) : undefined,
      targetType: selectedTarget?.typeLabel ?? 'Manual target',
      relationType: type,
      role: roleName,
      context: evidence,
      evidence,
      linkedEntity: linkedEntityName,
      linkedEntityLink: linkedEntityLink
        ? linkFromOption(linkedEntityLink)
        : undefined,
      linkedEntityType: relationLinkedEntityType(linkedEntityLink),
      direction: 'Manual relation',
      searchHints: [
        sourceName,
        targetName,
        linkedEntityName,
        type,
        roleName,
        evidence,
      ],
    })
  }

  return (
    <ManualEntryPanel
      title={formTitle}
      requiredMessage="Source and target are required."
      isValid={isValid}
      onCancel={onCancel}
      onSubmit={handleSubmit}
      submitLabel={initialRelation ? 'Save record' : 'Add record'}
    >
      <label>
        <span>Existing source</span>
        <CatalogEntitySelect
          options={linkOptions}
          value={selectedSourceValue}
          onChange={(nextValue) => {
            setSelectedSourceValue(nextValue)

            if (nextValue.length > 0) {
              setSource('')
            }
          }}
        />
      </label>
      <label>
        <span>Source</span>
        <input
          value={source}
          disabled={selectedSourceValue.length > 0}
          onChange={(event) => setSource(event.target.value)}
          required={selectedSourceValue.length === 0}
        />
      </label>
      <label>
        <span>Existing target</span>
        <CatalogEntitySelect
          options={linkOptions}
          value={selectedTargetValue}
          onChange={(nextValue) => {
            setSelectedTargetValue(nextValue)

            if (nextValue.length > 0) {
              setTarget('')
            }
          }}
        />
      </label>
      <label>
        <span>Target</span>
        <input
          value={target}
          disabled={selectedTargetValue.length > 0}
          onChange={(event) => setTarget(event.target.value)}
          required={selectedTargetValue.length === 0}
        />
      </label>
      <label>
        <span>Relation type</span>
        <input
          value={relationType}
          onChange={(event) => setRelationType(event.target.value)}
        />
      </label>
      {duplicateRelation ? (
        <p className="manual-entry-warning manual-entry-wide" role="status">
          Likely duplicate relation: {duplicateRelation.source} to{' '}
          {duplicateRelation.target} ({duplicateRelation.relationType}). Submit
          is still allowed for this session.
        </p>
      ) : null}
      <label>
        <span>Role</span>
        <input value={role} onChange={(event) => setRole(event.target.value)} />
      </label>
      <label>
        <span>Existing linked entity</span>
        <CatalogEntitySelect
          options={linkOptions}
          value={selectedLinkedEntityValue}
          onChange={(nextValue) => {
            setSelectedLinkedEntityValue(nextValue)

            if (nextValue.length > 0) {
              setLinkedEntity('')
            }
          }}
        />
      </label>
      <label>
        <span>Linked entity</span>
        <input
          value={linkedEntity}
          disabled={selectedLinkedEntityValue.length > 0}
          onChange={(event) => setLinkedEntity(event.target.value)}
        />
      </label>
      <label className="manual-entry-wide">
        <span>Context/evidence</span>
        <textarea
          value={context}
          onChange={(event) => setContext(event.target.value)}
          rows={3}
        />
      </label>
    </ManualEntryPanel>
  )
}

type CatalogEntitySelectProps = {
  options: CatalogLinkOption[]
  value: string
  onChange: (value: string) => void
}

function CatalogEntitySelect({
  options,
  value,
  onChange,
}: CatalogEntitySelectProps) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Free text</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

function linkFromOption(option: CatalogLinkOption): CatalogLink {
  return {
    kind: option.kind,
    id: option.id,
  }
}

function clearRelationLink(
  relation: RelationRecord,
  link: CatalogLink,
): RelationRecord {
  const sourceMatches = linkMatches(relation.sourceLink, link)
  const targetMatches = linkMatches(relation.targetLink, link)
  const linkedEntityMatches = linkMatches(relation.linkedEntityLink, link)

  return {
    ...relation,
    sourceLink: sourceMatches ? undefined : relation.sourceLink,
    sourceType: sourceMatches ? 'Manual source' : relation.sourceType,
    targetLink: targetMatches ? undefined : relation.targetLink,
    targetType: targetMatches ? 'Manual target' : relation.targetType,
    linkedEntityLink: linkedEntityMatches
      ? undefined
      : relation.linkedEntityLink,
  }
}

function linkMatches(left: CatalogLink | undefined, right: CatalogLink) {
  return left?.kind === right.kind && left.id === right.id
}

function relationLinkedEntityType(
  option: CatalogLinkOption | null | undefined,
): RelationRecord['linkedEntityType'] {
  if (!option) {
    return 'Artist'
  }

  switch (option.kind) {
    case 'artist':
      return 'Artist'
    case 'release':
      return 'Release'
    case 'track':
      return 'Track'
    case 'ownedItem':
      return 'Owned item'
    case 'relation':
      return 'Relation'
    case 'playlist':
      return 'Playlist'
  }
}

function queryTerms(query: string) {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean)
}

function filterRelations(query: string, relations: RelationRecord[]) {
  const terms = queryTerms(query)

  return relations.filter((relation) =>
    terms.every((term) => relationSearchText(relation).includes(term)),
  )
}

function relationSearchText(relation: RelationRecord) {
  return [
    relation.source,
    relation.sourceType,
    relation.target,
    relation.targetType,
    relation.relationType,
    relation.role,
    relation.context,
    relation.evidence,
    relation.linkedEntity,
    relation.linkedEntityType,
    relation.direction,
    ...relation.searchHints,
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

type RelationsTableProps = {
  relations: RelationRecord[]
  selectedRelationId: string
  onSelectRelation: (relationId: string) => void
}

function RelationsTable({
  relations,
  selectedRelationId,
  onSelectRelation,
}: RelationsTableProps) {
  return (
    <section
      className="panel catalog-panel"
      aria-labelledby="relations-results-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="relations-results-title">Relation graph</h2>
          <p>
            Typed connections make credits, aliases and versions searchable.
          </p>
        </div>
      </div>

      <div className="table-scroll">
        <table className="catalog-table workspace-table">
          <thead>
            <tr>
              <th scope="col">Relation</th>
              <th scope="col">Type</th>
              <th scope="col">Role</th>
              <th scope="col">Source</th>
              <th scope="col">Target</th>
              <th scope="col">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {relations.map((relation) => (
              <tr
                key={relation.id}
                aria-label={`${relation.source} ${relation.target}`}
                aria-selected={relation.id === selectedRelationId}
                className={
                  relation.id === selectedRelationId ? 'is-selected' : undefined
                }
              >
                <th scope="row">
                  <button
                    className="row-title"
                    type="button"
                    aria-label={`${relation.source} ${relation.target}`}
                    onClick={() => onSelectRelation(relation.id)}
                  >
                    <strong>
                      {relation.source} to {relation.target}
                    </strong>
                    <span>{relation.direction}</span>
                  </button>
                </th>
                <td data-label="Type">{relation.relationType}</td>
                <td data-label="Role">{relation.role}</td>
                <td data-label="Source">{relation.sourceType}</td>
                <td data-label="Target">{relation.targetType}</td>
                <td data-label="Evidence">{relation.evidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

type RelationDetailProps = {
  catalogData: CatalogLinkData
  onDelete?: () => void
  onEdit?: () => void
  relation: RelationRecord
}

function RelationDetail({
  catalogData,
  onDelete,
  onEdit,
  relation,
}: RelationDetailProps) {
  const backlinks = [
    ...catalogData.artists
      .filter((artist) =>
        [relation.source, relation.target, relation.linkedEntity].some(
          (value) => value.toLowerCase() === artist.name.toLowerCase(),
        ),
      )
      .map((artist) => ({
        href: `/artists?artist=${encodeURIComponent(artist.id)}`,
        label: artist.name,
        meta: `Artist · ${artist.type}`,
      })),
    ...catalogData.releases
      .filter((release) =>
        [relation.source, relation.target, relation.linkedEntity].some(
          (value) => value.toLowerCase() === release.title.toLowerCase(),
        ),
      )
      .map((release) => ({
        href: `/releases?release=${encodeURIComponent(release.id)}`,
        label: release.title,
        meta: `Release · ${release.artist}`,
      })),
    ...catalogData.tracks
      .filter((track) =>
        [relation.source, relation.target, relation.linkedEntity].some(
          (value) => value.toLowerCase() === track.title.toLowerCase(),
        ),
      )
      .map((track) => ({
        href: `/tracks?track=${encodeURIComponent(track.id)}`,
        label: track.title,
        meta: `Track · ${track.artist}`,
      })),
    ...catalogData.ownedItems
      .filter((item) =>
        [relation.source, relation.target, relation.linkedEntity].some(
          (value) => value.toLowerCase() === item.title.toLowerCase(),
        ),
      )
      .map((item) => ({
        href: `/owned-items?ownedItem=${encodeURIComponent(item.id)}`,
        label: item.title,
        meta: `${item.medium} · ${item.status}`,
      })),
    ...(catalogData.playlists ?? [])
      .filter((playlist) =>
        relation.searchHints.some((hint) =>
          playlist.name.toLowerCase().includes(hint.toLowerCase()),
        ),
      )
      .map((playlist) => ({
        href: `/playlists?playlist=${encodeURIComponent(playlist.id)}`,
        label: playlist.name,
        meta: `${playlist.type} playlist`,
      })),
  ]

  return (
    <aside className="panel detail-panel" aria-labelledby="relation-title">
      <div className="detail-header">
        <div className="detail-title-row">
          <span className="entity-type">{relation.relationType}</span>
          {onEdit ? (
            <span className="badge badge-tag">Editable collection record</span>
          ) : null}
        </div>
        <h2 id="relation-title">
          {relation.source} to {relation.target}
        </h2>
        <p>{relation.role}</p>
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
                confirmationMessage="Delete this relation? This cannot be undone."
                onDelete={onDelete}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="detail-summary">{relation.context}</p>

      <section className="detail-section" aria-labelledby="relation-endpoints">
        <h3 id="relation-endpoints">Endpoints</h3>
        <dl className="detail-list">
          <div>
            <dt>Source</dt>
            <dd>
              <LinkedEntityText
                catalogData={catalogData}
                link={relation.sourceLink}
                text={relation.source}
              />{' '}
              · <span>{relation.sourceType}</span>
            </dd>
          </div>
          <div>
            <dt>Target</dt>
            <dd>
              <LinkedEntityText
                catalogData={catalogData}
                link={relation.targetLink}
                text={relation.target}
              />{' '}
              · <span>{relation.targetType}</span>
            </dd>
          </div>
        </dl>
      </section>

      <section className="detail-section" aria-labelledby="relation-context">
        <h3 id="relation-context">Relation context</h3>
        <dl className="detail-list">
          <div>
            <dt>Type</dt>
            <dd>{relation.relationType}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{relation.role}</dd>
          </div>
          <div>
            <dt>Direction</dt>
            <dd>{relation.direction}</dd>
          </div>
        </dl>
      </section>

      <section className="detail-section" aria-labelledby="relation-evidence">
        <h3 id="relation-evidence">Linked evidence</h3>
        <dl className="detail-list">
          <div>
            <dt>{relation.linkedEntityType}</dt>
            <dd>
              <LinkedEntityText
                catalogData={catalogData}
                link={relation.linkedEntityLink}
                text={relation.linkedEntity}
              />
            </dd>
          </div>
          <div>
            <dt>Evidence</dt>
            <dd>{relation.evidence}</dd>
          </div>
        </dl>
      </section>

      <section className="detail-section" aria-labelledby="relation-hints">
        <h3 id="relation-hints">Search hints</h3>
        <BadgeList values={relation.searchHints} />
      </section>

      <section className="detail-section" aria-labelledby="relation-backlinks">
        <h3 id="relation-backlinks">Related catalog records</h3>
        {backlinks.length > 0 ? (
          <div className="relation-list">
            {backlinks.map((link) => (
              <article key={`${link.href}-${link.label}`}>
                <a className="detail-link" href={link.href}>
                  {link.label}
                </a>
                <p>{link.meta}</p>
              </article>
            ))}
          </div>
        ) : (
          <p>No related catalog records found yet.</p>
        )}
      </section>
    </aside>
  )
}

type LinkedEntityTextProps = {
  catalogData: CatalogLinkData
  link?: CatalogLink
  text: string
}

function LinkedEntityText({ catalogData, link, text }: LinkedEntityTextProps) {
  if (!link || !hasCatalogLink(catalogData, link)) {
    return <span>{text}</span>
  }

  return (
    <a className="detail-link" href={catalogEntityHref(link)}>
      {text}
    </a>
  )
}

type BadgeListProps = {
  values: string[]
}

function BadgeList({ values }: BadgeListProps) {
  return (
    <span className="badge-list">
      {values.map((value, index) => (
        <span key={`${value}-${index}`} className="badge badge-tag">
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
      aria-labelledby="empty-relation-detail-title"
      aria-live="polite"
    >
      <div className="detail-header">
        <span className="entity-type">No selection</span>
        <h2 id="empty-relation-detail-title">No matching relations.</h2>
      </div>

      <p className="detail-summary">
        Try another source, target, type, role, release or track.
      </p>
    </aside>
  )
}
