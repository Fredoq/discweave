import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { relationRecords, type RelationRecord } from './relationsData'

export function RelationsWorkspace() {
  const [query, setQuery] = useState('')
  const [selectedRelationId, setSelectedRelationId] = useState(
    relationRecords[0].id,
  )

  const visibleRelations = useMemo(() => filterRelations(query), [query])

  function handleQueryChange(nextQuery: string) {
    const nextVisibleRelations = filterRelations(nextQuery)

    setQuery(nextQuery)
    setSelectedRelationId((currentRelationId) =>
      nextVisibleRelations.some((relation) => relation.id === currentRelationId)
        ? currentRelationId
        : (nextVisibleRelations[0]?.id ?? ''),
    )
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
        <RelationsTable
          relations={visibleRelations}
          selectedRelationId={selectedRelation?.id ?? ''}
          onSelectRelation={setSelectedRelationId}
        />
      </div>

      {selectedRelation ? (
        <RelationDetail relation={selectedRelation} />
      ) : (
        <EmptyDetailPanel />
      )}
    </section>
  )
}

function queryTerms(query: string) {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean)
}

function filterRelations(query: string) {
  const terms = queryTerms(query)

  return relationRecords.filter((relation) =>
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
  relation: RelationRecord
}

function RelationDetail({ relation }: RelationDetailProps) {
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
              {relation.source} · {relation.sourceType}
            </dd>
          </div>
          <div>
            <dt>Target</dt>
            <dd>
              <a className="detail-link" href={targetHref(relation)}>
                {relation.target}
              </a>{' '}
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
            <dd>{relation.linkedEntity}</dd>
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

function targetHref(relation: RelationRecord) {
  switch (relation.targetType) {
    case 'Alias':
    case 'Artist':
      return '/artists'
    case 'Release':
      return '/releases'
    default:
      return '/tracks'
  }
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
