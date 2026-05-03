import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ManualEntryPanel } from '../manualEntry/ManualEntryPanel'
import {
  createManualRecordId,
  textOrFallback,
} from '../manualEntry/manualEntryUtils'
import { artistRecords, type ArtistRecord } from '../artists/artistsData'
import {
  catalogEntityHref,
  catalogLinkOptions,
  findCatalogOption,
  hasCatalogLink,
  type CatalogLink,
  type CatalogLinkData,
  type CatalogLinkOption,
} from '../catalog/catalogLinks'
import {
  ownedItemRecords,
  type OwnedItemRecord,
} from '../ownedItems/ownedItemsData'
import { releaseRecords, type ReleaseRecord } from '../releases/releasesData'
import { trackRecords, type TrackRecord } from '../tracks/tracksData'
import { relationRecords, type RelationRecord } from './relationsData'

type RelationsWorkspaceProps = {
  artists?: ArtistRecord[]
  isManualEntryOpen?: boolean
  onAddRelation?: (relation: RelationRecord) => void
  onManualEntryClose?: () => void
  ownedItems?: OwnedItemRecord[]
  relations?: RelationRecord[]
  releases?: ReleaseRecord[]
  tracks?: TrackRecord[]
}

export function RelationsWorkspace({
  artists = artistRecords,
  isManualEntryOpen = false,
  onAddRelation,
  onManualEntryClose = () => {},
  ownedItems = ownedItemRecords,
  relations: providedRelations,
  releases = releaseRecords,
  tracks = trackRecords,
}: RelationsWorkspaceProps) {
  const [query, setQuery] = useState('')
  const [selectedRelationId, setSelectedRelationId] = useState(
    relationRecords[0]?.id ?? '',
  )
  const [manualRelations, setManualRelations] = useState<RelationRecord[]>([])
  const relations = useMemo(() => {
    return providedRelations ?? [...relationRecords, ...manualRelations]
  }, [manualRelations, providedRelations])
  const catalogData = useMemo(
    () => ({ artists, releases, tracks, ownedItems }),
    [artists, ownedItems, releases, tracks],
  )
  const linkOptions = useMemo(
    () => catalogLinkOptions(catalogData),
    [catalogData],
  )

  const visibleRelations = useMemo(
    () => filterRelations(query, relations),
    [query, relations],
  )

  function handleQueryChange(nextQuery: string) {
    const nextVisibleRelations = filterRelations(nextQuery, relations)

    setQuery(nextQuery)
    setSelectedRelationId((currentRelationId) =>
      nextVisibleRelations.some((relation) => relation.id === currentRelationId)
        ? currentRelationId
        : (nextVisibleRelations[0]?.id ?? ''),
    )
  }

  function handleAddRelation(relation: RelationRecord) {
    if (onAddRelation) {
      onAddRelation(relation)
    } else {
      setManualRelations((currentRelations) => [...currentRelations, relation])
    }

    setQuery('')
    setSelectedRelationId(relation.id)
    onManualEntryClose()
  }

  const selectedRelation =
    visibleRelations.find((relation) => relation.id === selectedRelationId) ??
    visibleRelations[0] ??
    null

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
          <span className="result-count">{visibleRelations.length} shown</span>
        </div>
        {isManualEntryOpen ? (
          <RelationEntryForm
            linkOptions={linkOptions}
            onCancel={onManualEntryClose}
            onSubmit={handleAddRelation}
          />
        ) : null}
        <RelationsTable
          relations={visibleRelations}
          selectedRelationId={selectedRelation?.id ?? ''}
          onSelectRelation={setSelectedRelationId}
        />
      </div>

      {selectedRelation ? (
        <RelationDetail catalogData={catalogData} relation={selectedRelation} />
      ) : (
        <EmptyDetailPanel />
      )}
    </section>
  )
}

type RelationEntryFormProps = {
  linkOptions: CatalogLinkOption[]
  onCancel: () => void
  onSubmit: (relation: RelationRecord) => void
}

function RelationEntryForm({
  linkOptions,
  onCancel,
  onSubmit,
}: RelationEntryFormProps) {
  const [selectedSourceValue, setSelectedSourceValue] = useState('')
  const [source, setSource] = useState('')
  const [selectedTargetValue, setSelectedTargetValue] = useState('')
  const [target, setTarget] = useState('')
  const [relationType, setRelationType] = useState('')
  const [role, setRole] = useState('')
  const [selectedLinkedEntityValue, setSelectedLinkedEntityValue] = useState('')
  const [linkedEntity, setLinkedEntity] = useState('')
  const [context, setContext] = useState('')
  const selectedSource = findCatalogOption(linkOptions, selectedSourceValue)
  const selectedTarget = findCatalogOption(linkOptions, selectedTargetValue)
  const selectedLinkedEntity = findCatalogOption(
    linkOptions,
    selectedLinkedEntityValue,
  )
  const sourceName = selectedSource?.name ?? source.trim()
  const targetName = selectedTarget?.name ?? target.trim()
  const isValid = sourceName.length > 0 && targetName.length > 0

  function handleSubmit() {
    const type = textOrFallback(relationType, 'Unspecified relation')
    const roleName = textOrFallback(role, 'Unspecified role')
    const evidence = textOrFallback(context, 'No context or evidence recorded.')
    const linkedEntityName =
      selectedLinkedEntity?.name ??
      textOrFallback(linkedEntity, selectedTarget?.name ?? targetName)
    const linkedEntityLink = selectedLinkedEntity ?? selectedTarget ?? undefined

    onSubmit({
      id: createManualRecordId('relation', `${sourceName}-${targetName}`),
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
      title="Add relation"
      requiredMessage="Source and target are required."
      isValid={isValid}
      onCancel={onCancel}
      onSubmit={handleSubmit}
    >
      <label>
        <span>Existing source</span>
        <CatalogEntitySelect
          options={linkOptions}
          value={selectedSourceValue}
          onChange={setSelectedSourceValue}
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
          onChange={setSelectedTargetValue}
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
      <label>
        <span>Role</span>
        <input value={role} onChange={(event) => setRole(event.target.value)} />
      </label>
      <label>
        <span>Existing linked entity</span>
        <CatalogEntitySelect
          options={linkOptions}
          value={selectedLinkedEntityValue}
          onChange={setSelectedLinkedEntityValue}
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
  relation: RelationRecord
}

function RelationDetail({ catalogData, relation }: RelationDetailProps) {
  return (
    <aside className="panel detail-panel" aria-labelledby="relation-title">
      <div className="detail-header">
        <span className="entity-type">{relation.relationType}</span>
        <h2 id="relation-title">
          {relation.source} to {relation.target}
        </h2>
        <p>{relation.role}</p>
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
