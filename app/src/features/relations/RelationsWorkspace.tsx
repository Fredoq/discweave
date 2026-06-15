import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ArtistRecord } from '../artists/artistsData'
import { catalogLinkOptions, type CatalogLink } from '../catalog/catalogLinks'
import { FilterSelect } from '../catalog/FilterSelect'
import {
  defaultCatalogDictionaries,
  type CatalogDictionaries,
} from '../catalog/catalogApi'
import { uniqueValues } from '../catalog/catalogGraph'
import { useCatalogSelection } from '../catalog/useCatalogSelection'
import type { OwnedItemRecord } from '../ownedItems/ownedItemsData'
import type { PlaylistRecord } from '../playlists/playlistsData'
import type { ReleaseRecord } from '../releases/releasesData'
import type { TrackRecord } from '../tracks/tracksData'
import { RelationDetail, EmptyDetailPanel } from './RelationDetail'
import { RelationEntryForm } from './RelationEntryForm'
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
  dictionaries?: CatalogDictionaries
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
  dictionaries = defaultCatalogDictionaries,
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
            dictionaries={dictionaries}
            linkOptions={linkOptions}
            relations={relations}
            onCancel={onManualEntryClose}
            onSubmit={handleAddRelation}
          />
        ) : null}
        {editingRelation ? (
          <RelationEntryForm
            dictionaries={dictionaries}
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
                <td data-label="Role">{relationRoleDisplay(relation)}</td>
                <td data-label="Source">{relation.sourceType}</td>
                <td data-label="Target">{relation.targetType}</td>
                <td data-label="Evidence">
                  {textOrNotRecorded(relation.evidence)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function relationRoleDisplay(relation: RelationRecord) {
  return relation.role.trim().toLowerCase() ===
    relation.relationType.trim().toLowerCase()
    ? 'Same as type'
    : textOrNotRecorded(relation.role)
}

function textOrNotRecorded(value: string) {
  return value.trim() || 'Not recorded'
}
