import { Search } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ArtistRecord } from '../artists/artistsData'
import type { LabelRecord } from '../labels/labelsData'
import type { OwnedItemRecord } from '../ownedItems/ownedItemsData'
import type { PlaylistRecord } from '../playlists/playlistsData'
import type { ReleaseRecord } from '../releases/releasesData'
import type { RelationRecord } from '../relations/relationsData'
import type { TrackRecord } from '../tracks/tracksData'
import {
  loadCatalogGraphContext,
  searchCatalog,
  type CatalogGraphContext,
  type CatalogGraphLink,
  type CatalogSearchResult,
  type SearchEntityType,
} from './catalogApi'
import { FilterSelect } from './FilterSelect'
import { catalogEntityHref } from './catalogLinks'
import {
  buildCatalogEntries,
  matchesTerms,
  uniqueValues,
  type CatalogEntry,
  type CatalogEntityType,
} from './catalogGraph'

const savedViewDefinitions = [
  { label: 'All', urlValue: 'all', apiSavedView: 'all' },
  {
    label: 'Owned',
    urlValue: 'owned',
    apiSavedView: 'all',
    status: 'owned',
  },
  {
    label: 'Physical without digital',
    urlValue: 'physicalWithoutDigital',
    apiSavedView: 'physicalWithoutDigital',
  },
  {
    label: 'Lossy without lossless',
    urlValue: 'lossyWithoutLossless',
    apiSavedView: 'lossyWithoutLossless',
  },
  {
    label: 'Wanted not owned',
    urlValue: 'wantedNotOwned',
    apiSavedView: 'wantedNotOwned',
  },
  {
    label: 'Needs digitization',
    urlValue: 'needsDigitization',
    apiSavedView: 'needsDigitization',
  },
  { label: 'Credits', urlValue: 'credits', apiSavedView: 'credits' },
  { label: 'Remixes', urlValue: 'remixes', apiSavedView: 'remixes' },
  {
    label: 'Productions',
    urlValue: 'productions',
    apiSavedView: 'productions',
  },
  { label: 'Labels', urlValue: 'labels', apiSavedView: 'labels' },
] as const

type SavedViewDefinition = (typeof savedViewDefinitions)[number]
type SavedView = SavedViewDefinition['label']

type CatalogWorkspaceProps = {
  addEntryPanel?: ReactNode
  artists: ArtistRecord[]
  labels?: LabelRecord[]
  locationSearch?: string
  releases: ReleaseRecord[]
  tracks: TrackRecord[]
  ownedItems: OwnedItemRecord[]
  relations: RelationRecord[]
  playlists: PlaylistRecord[]
  searchRefreshKey?: number
  serverBacked?: boolean
}

type CatalogFilters = {
  entityType: '' | CatalogEntityType
  media: string
  status: string
  role: string
  label: string
  tag: string
  format: string
}

const savedViews: SavedView[] = savedViewDefinitions.map(
  (definition) => definition.label,
)

const emptyFilters: CatalogFilters = {
  entityType: '',
  media: '',
  status: '',
  role: '',
  label: '',
  tag: '',
  format: '',
}

export function CatalogWorkspace(props: CatalogWorkspaceProps) {
  if (props.serverBacked) {
    return (
      <ServerCatalogWorkspace
        addEntryPanel={props.addEntryPanel}
        labels={props.labels ?? []}
        locationSearch={props.locationSearch ?? window.location.search}
        searchRefreshKey={props.searchRefreshKey ?? 0}
      />
    )
  }

  return <LocalCatalogWorkspace {...props} />
}

function LocalCatalogWorkspace({
  addEntryPanel,
  artists,
  releases,
  tracks,
  ownedItems,
  relations,
  playlists,
}: CatalogWorkspaceProps) {
  const [query, setQuery] = useState('')
  const [activeView, setActiveView] = useState<SavedView>('All')
  const [filters, setFilters] = useState<CatalogFilters>(emptyFilters)
  const entries = useMemo(
    () =>
      buildCatalogEntries({
        artists,
        releases,
        tracks,
        ownedItems,
        relations,
        playlists,
      }),
    [artists, ownedItems, playlists, relations, releases, tracks],
  )
  const [selectedEntryId, setSelectedEntryId] = useState(entries[0]?.id ?? '')

  const filterOptions = useMemo(() => buildFilterOptions(entries), [entries])
  const visibleEntries = useMemo(() => {
    return entries
      .filter((entry) => matchesSavedView(entry, activeView))
      .filter((entry) => matchesFilters(entry, filters))
      .filter((entry) => matchesTerms(entry.searchText, query))
  }, [activeView, entries, filters, query])

  const selectedEntry =
    visibleEntries.find((entry) => entry.id === selectedEntryId) ??
    visibleEntries[0] ??
    null

  return (
    <section className="catalog-layout" aria-label="Catalog workspace">
      <div className="catalog-main">
        <SearchField query={query} onQueryChange={setQuery} />
        {addEntryPanel}
        <FilterBar
          activeView={activeView}
          filters={filters}
          filterOptions={filterOptions}
          visibleCount={visibleEntries.length}
          onClearFilters={() => {
            setActiveView('All')
            setFilters(emptyFilters)
          }}
          onFilterChange={(nextFilters) => setFilters(nextFilters)}
          onViewChange={setActiveView}
        />
        <CatalogTable
          entries={visibleEntries}
          selectedEntryId={selectedEntry?.id ?? ''}
          onSelectEntry={setSelectedEntryId}
        />
      </div>

      {selectedEntry ? (
        <DetailPanel entry={selectedEntry} />
      ) : (
        <EmptyDetailPanel />
      )}
    </section>
  )
}

type ServerCatalogFilters = {
  entityType: '' | SearchEntityType
  media: string
  status: string
  role: string
  labelId: string
  tag: string
}

const emptyServerFilters: ServerCatalogFilters = {
  entityType: '',
  media: '',
  status: '',
  role: '',
  labelId: '',
  tag: '',
}

const serverFilterOptions = {
  entityTypes: ['artist', 'release', 'track', 'ownedItem', 'label', 'playlist'],
  media: ['digital', 'vinyl', 'cd', 'cassette', 'other'],
  statuses: ['owned', 'wanted', 'sold', 'needsDigitization'],
  roles: [
    'mainArtist',
    'featuredArtist',
    'remixer',
    'producer',
    'composer',
    'performer',
    'engineer',
    'memberOf',
  ],
}

function ServerCatalogWorkspace({
  addEntryPanel,
  labels,
  locationSearch,
  searchRefreshKey,
}: {
  addEntryPanel?: ReactNode
  labels: LabelRecord[]
  locationSearch: string
  searchRefreshKey: number
}) {
  const initialParams = useMemo(
    () => parseCatalogSearchParams(locationSearch),
    [locationSearch],
  )
  const [query, setQuery] = useState(initialParams.query)
  const [activeView, setActiveView] = useState<SavedView>(
    initialParams.activeView,
  )
  const [filters, setFilters] = useState<ServerCatalogFilters>(
    initialParams.filters,
  )
  const [results, setResults] = useState<CatalogSearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [searchStatus, setSearchStatus] = useState<
    'loading' | 'ready' | 'error'
  >('loading')
  const [searchError, setSearchError] = useState('')
  const [selectedResultId, setSelectedResultId] = useState('')
  const [graphContext, setGraphContext] = useState<CatalogGraphContext | null>(
    null,
  )
  const [graphStatus, setGraphStatus] = useState<
    'idle' | 'loading' | 'ready' | 'missing' | 'error'
  >('idle')

  useEffect(() => {
    const nextUrl = buildCatalogUrl(query, activeView, filters)
    const currentUrl = `${window.location.pathname}${window.location.search}`

    if (currentUrl !== nextUrl) {
      window.history.replaceState({}, '', nextUrl)
    }
  }, [activeView, filters, query])

  useEffect(() => {
    let isCurrent = true

    queueMicrotask(() => {
      if (!isCurrent) {
        return
      }

      setSearchStatus('loading')
      setSearchError('')
    })

    const viewParams = serverSavedViewParams(activeView)
    void searchCatalog({
      query,
      savedView: viewParams.savedView,
      entityType: filters.entityType,
      media: filters.media,
      status: filters.status || viewParams.status,
      role: filters.role,
      labelId: filters.labelId,
      tag: filters.tag,
      limit: 100,
      offset: 0,
    })
      .then((response) => {
        if (!isCurrent) {
          return
        }

        setResults(response.items)
        setTotal(response.total)
        setSearchStatus('ready')
        setSelectedResultId((currentId) =>
          response.items.some((item) => resultKey(item) === currentId)
            ? currentId
            : (resultKey(response.items[0]) ?? ''),
        )
      })
      .catch((error: unknown) => {
        if (!isCurrent) {
          return
        }

        setResults([])
        setTotal(0)
        setSearchStatus('error')
        setSearchError(
          error instanceof Error
            ? error.message
            : 'Search request failed. Try again.',
        )
      })

    return () => {
      isCurrent = false
    }
  }, [activeView, filters, query, searchRefreshKey])

  const selectedResult =
    results.find((result) => resultKey(result) === selectedResultId) ??
    results[0] ??
    null

  useEffect(() => {
    if (!selectedResult) {
      queueMicrotask(() => {
        setGraphContext(null)
        setGraphStatus('idle')
      })
      return
    }

    let isCurrent = true
    queueMicrotask(() => {
      if (!isCurrent) {
        return
      }

      setGraphContext(null)
      setGraphStatus('loading')
    })

    void loadCatalogGraphContext(selectedResult.type, selectedResult.id)
      .then((context) => {
        if (!isCurrent) {
          return
        }

        if (!context) {
          setGraphStatus('missing')
          return
        }

        setGraphContext(context)
        setGraphStatus('ready')
      })
      .catch(() => {
        if (isCurrent) {
          setGraphStatus('error')
        }
      })

    return () => {
      isCurrent = false
    }
  }, [selectedResult])

  return (
    <section className="catalog-layout" aria-label="Catalog workspace">
      <div className="catalog-main">
        <SearchField query={query} onQueryChange={setQuery} />
        {addEntryPanel}
        <ServerFilterBar
          activeView={activeView}
          filters={filters}
          labels={labels}
          results={results}
          visibleCount={results.length}
          total={total}
          onClearFilters={() => {
            setQuery('')
            setActiveView('All')
            setFilters(emptyServerFilters)
          }}
          onFilterChange={setFilters}
          onViewChange={setActiveView}
        />
        <ServerCatalogTable
          results={results}
          searchStatus={searchStatus}
          selectedResultId={selectedResult ? resultKey(selectedResult) : ''}
          onSelectResult={(result) => setSelectedResultId(resultKey(result))}
        />
        {searchStatus === 'error' ? (
          <section className="panel section-panel" role="alert">
            {searchError}
          </section>
        ) : null}
      </div>

      <GraphDetailPanel
        context={graphContext}
        graphStatus={graphStatus}
        result={selectedResult}
      />
    </section>
  )
}

function ServerFilterBar({
  activeView,
  filters,
  labels,
  results,
  visibleCount,
  total,
  onClearFilters,
  onFilterChange,
  onViewChange,
}: {
  activeView: SavedView
  filters: ServerCatalogFilters
  labels: LabelRecord[]
  results: CatalogSearchResult[]
  visibleCount: number
  total: number
  onClearFilters: () => void
  onFilterChange: (filters: ServerCatalogFilters) => void
  onViewChange: (view: SavedView) => void
}) {
  function updateFilter<Key extends keyof ServerCatalogFilters>(
    key: Key,
    value: ServerCatalogFilters[Key],
  ) {
    onFilterChange({ ...filters, [key]: value })
  }
  const mediaOptions = uniqueValues([
    ...serverFilterOptions.media,
    ...results.flatMap((result) => result.facets.media),
  ])
  const statusOptions = uniqueValues([
    ...serverFilterOptions.statuses,
    ...results.flatMap((result) => result.facets.statuses),
  ])
  const roleOptions = uniqueValues([
    ...serverFilterOptions.roles,
    ...results.flatMap((result) => result.facets.roles),
  ])
  const tagOptions = uniqueValues(
    results.flatMap((result) => result.facets.tags),
  )

  return (
    <div className="filter-stack" aria-label="Catalog filters">
      <div className="filter-bar">
        <div className="saved-views" role="list" aria-label="Saved views">
          {savedViews.map((view) => (
            <button
              key={view}
              className="view-pill"
              type="button"
              aria-pressed={activeView === view}
              onClick={() => onViewChange(view)}
            >
              {view}
            </button>
          ))}
        </div>
        <button
          className="button button-secondary"
          type="button"
          onClick={onClearFilters}
        >
          Clear filters
        </button>
        <span className="result-count">
          {visibleCount} shown · {total} total
        </span>
      </div>

      <div className="filter-grid">
        <FilterSelect
          label="Catalog entity type"
          value={filters.entityType}
          values={serverFilterOptions.entityTypes}
          onChange={(value) =>
            updateFilter(
              'entityType',
              value as ServerCatalogFilters['entityType'],
            )
          }
        />
        <FilterSelect
          label="Media type"
          value={filters.media}
          values={mediaOptions}
          onChange={(value) => updateFilter('media', value)}
        />
        <FilterSelect
          label="Ownership status"
          value={filters.status}
          values={statusOptions}
          onChange={(value) => updateFilter('status', value)}
        />
        <FilterSelect
          label="Credit or relation role"
          value={filters.role}
          values={roleOptions}
          onChange={(value) => updateFilter('role', value)}
        />
        <LabelFilterSelect
          value={filters.labelId}
          labels={labels}
          onChange={(value) => updateFilter('labelId', value)}
        />
        <FilterSelect
          label="Tag"
          value={filters.tag}
          values={tagOptions}
          onChange={(value) => updateFilter('tag', value)}
        />
      </div>
    </div>
  )
}

function LabelFilterSelect({
  labels,
  value,
  onChange,
}: {
  labels: LabelRecord[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="filter-control">
      <span>Label</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">All</option>
        {labels.map((label) => (
          <option key={label.id} value={label.id}>
            {label.name}
          </option>
        ))}
      </select>
    </label>
  )
}

function ServerCatalogTable({
  results,
  searchStatus,
  selectedResultId,
  onSelectResult,
}: {
  results: CatalogSearchResult[]
  searchStatus: 'loading' | 'ready' | 'error'
  selectedResultId: string
  onSelectResult: (result: CatalogSearchResult) => void
}) {
  if (searchStatus === 'loading') {
    return (
      <section className="panel catalog-panel" aria-live="polite">
        <p role="status">Searching catalog…</p>
      </section>
    )
  }

  if (results.length === 0) {
    return (
      <section className="panel catalog-panel" aria-live="polite">
        <div className="panel-heading">
          <div>
            <h2>Catalog results</h2>
            <p>No matching catalog entries.</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="panel catalog-panel" aria-labelledby="results-title">
      <div className="panel-heading">
        <div>
          <h2 id="results-title">Catalog results</h2>
          <p>Server-ranked matches with facets and relationship context.</p>
        </div>
      </div>

      <div className="table-scroll">
        <table className="catalog-table">
          <thead>
            <tr>
              <th scope="col">Title</th>
              <th scope="col">Type</th>
              <th scope="col">Context</th>
              <th scope="col">Media</th>
              <th scope="col">Status</th>
              <th scope="col">Matched fields</th>
              <th scope="col">Signals</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => {
              const key = resultKey(result)

              return (
                <tr
                  key={key}
                  aria-selected={key === selectedResultId}
                  className={
                    key === selectedResultId ? 'is-selected' : undefined
                  }
                >
                  <th scope="row">
                    <button
                      className="row-title"
                      type="button"
                      aria-label={`Select catalog ${displayEntityType(
                        result.type,
                      ).toLowerCase()} ${result.title}`}
                      onClick={() => onSelectResult(result)}
                    >
                      <strong>{result.title}</strong>
                      <span>
                        {result.subtitle ?? result.summary ?? 'Catalog entity'}
                      </span>
                    </button>
                    <a
                      className="detail-link row-link"
                      href={catalogEntityHref({
                        kind: result.type,
                        id: result.id,
                      })}
                      aria-label={`Open ${result.title}`}
                    >
                      Open
                    </a>
                  </th>
                  <td data-label="Type">{displayEntityType(result.type)}</td>
                  <td data-label="Context">
                    {result.summary ?? result.snippets[0] ?? 'No context'}
                  </td>
                  <td data-label="Media">
                    <BadgeList values={result.facets.media} variant="media" />
                  </td>
                  <td data-label="Status">
                    <BadgeList values={result.facets.statuses} variant="tag" />
                  </td>
                  <td data-label="Matched fields">
                    <BadgeList values={result.matchedFields} variant="credit" />
                  </td>
                  <td data-label="Signals">
                    <BadgeList
                      values={formatCollectorSignals(
                        result.facets.collectorSignals,
                      )}
                      variant="tag"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function GraphDetailPanel({
  context,
  graphStatus,
  result,
}: {
  context: CatalogGraphContext | null
  graphStatus: 'idle' | 'loading' | 'ready' | 'missing' | 'error'
  result: CatalogSearchResult | null
}) {
  if (!result) {
    return <EmptyDetailPanel />
  }

  if (graphStatus === 'loading') {
    return (
      <aside className="panel detail-panel" aria-live="polite">
        <div className="detail-header">
          <span className="entity-type">{displayEntityType(result.type)}</span>
          <h2>{result.title}</h2>
          <p role="status">Loading relationship context…</p>
        </div>
      </aside>
    )
  }

  if (graphStatus === 'missing') {
    return (
      <aside className="panel detail-panel" aria-live="polite">
        <div className="detail-header">
          <span className="entity-type">No access</span>
          <h2>{result.title}</h2>
          <p className="detail-summary">
            This catalog entity is no longer available in the active collection.
          </p>
        </div>
      </aside>
    )
  }

  if (graphStatus === 'error') {
    return (
      <aside className="panel detail-panel" aria-live="polite">
        <div className="detail-header">
          <span className="entity-type">{displayEntityType(result.type)}</span>
          <h2>{result.title}</h2>
          <p className="detail-summary">
            Relationship context could not be loaded.
          </p>
        </div>
      </aside>
    )
  }

  if (!context) {
    return <EmptyDetailPanel />
  }

  return (
    <aside
      className="panel detail-panel"
      aria-labelledby="detail-title"
      aria-label={context.entity.title}
    >
      <div className="detail-header">
        <span className="entity-type">
          {displayEntityType(context.entity.type)}
        </span>
        <h2 id="detail-title">{context.entity.title}</h2>
        <p>{context.entity.subtitle ?? result.subtitle ?? 'Catalog entity'}</p>
      </div>

      {context.entity.summary ? (
        <p className="detail-summary">{context.entity.summary}</p>
      ) : null}

      <section className="detail-section" aria-labelledby="catalog-open-title">
        <h3 id="catalog-open-title">Workspace link</h3>
        <a
          className="detail-link"
          href={catalogEntityHref({
            kind: context.entity.type,
            id: context.entity.id,
          })}
        >
          Open in workspace
        </a>
      </section>

      <GraphSection title="Credits" links={context.sections.credits} />
      <GraphSection title="Artists" links={context.sections.artists} />
      <GraphSection title="Relations" links={context.sections.relations} />
      <GraphSection title="Appearances" links={context.sections.releases} />
      <GraphSection title="Tracks" links={context.sections.tracks} />
      <GraphSection title="Owned copies" links={context.sections.ownedCopies} />
      <GraphSection title="Labels" links={context.sections.labels} />
      <GraphSection title="Playlists" links={context.sections.playlists} />
      <GraphSection title="Media coverage" links={context.sections.media} />
      <section className="detail-section" aria-labelledby="signals-title">
        <h3 id="signals-title">Collector signals</h3>
        <BadgeList
          values={formatCollectorSignals(context.collectorSignals)}
          variant="tag"
        />
      </section>
    </aside>
  )
}

function GraphSection({
  links,
  title,
}: {
  links: CatalogGraphLink[]
  title: string
}) {
  const id = `${title.toLowerCase().replaceAll(' ', '-')}-title`

  return (
    <section className="detail-section" aria-labelledby={id}>
      <h3 id={id}>{title}</h3>
      {links.length === 0 ? (
        <p className="detail-summary">None recorded.</p>
      ) : (
        <ul className="graph-link-list">
          {links.map((link) => (
            <li key={`${link.type}:${link.id}:${link.relation ?? title}`}>
              <a
                className="detail-link"
                href={catalogEntityHref({ kind: link.type, id: link.id })}
              >
                {link.title}
              </a>
              <span>
                {[link.subtitle, link.relation].filter(Boolean).join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function parseCatalogSearchParams(locationSearch: string) {
  const params = new URLSearchParams(locationSearch)
  const savedView = params.get('savedView') ?? ''

  return {
    query: params.get('query') ?? params.get('q') ?? '',
    activeView: viewFromSavedView(savedView),
    filters: {
      entityType: readEntityType(params.get('entityType')),
      media: params.get('media') ?? '',
      status: params.get('status') ?? '',
      role: params.get('role') ?? '',
      labelId: params.get('labelId') ?? '',
      tag: params.get('tag') ?? '',
    },
  }
}

function buildCatalogUrl(
  query: string,
  view: SavedView,
  filters: ServerCatalogFilters,
) {
  const params = new URLSearchParams()
  const trimmedQuery = query.trim()

  if (trimmedQuery) {
    params.set('query', trimmedQuery)
  }
  if (view !== 'All') {
    params.set('savedView', savedViewFromView(view))
  }
  if (filters.entityType) {
    params.set('entityType', filters.entityType)
  }
  if (filters.media) {
    params.set('media', filters.media)
  }
  if (filters.status) {
    params.set('status', filters.status)
  }
  if (filters.role) {
    params.set('role', filters.role)
  }
  if (filters.labelId) {
    params.set('labelId', filters.labelId)
  }
  if (filters.tag) {
    params.set('tag', filters.tag)
  }

  const search = params.toString()
  return search ? `/catalog?${search}` : '/catalog'
}

function serverSavedViewParams(view: SavedView) {
  const definition = savedViewDefinition(view)

  return {
    savedView: definition.apiSavedView,
    status: 'status' in definition ? definition.status : undefined,
  }
}

function savedViewFromView(view: SavedView) {
  return savedViewDefinition(view).urlValue
}

function viewFromSavedView(savedView: string): SavedView {
  const normalizedSavedView = savedView.trim().toLowerCase()

  return (
    savedViewDefinitions.find(
      (definition) => definition.urlValue.toLowerCase() === normalizedSavedView,
    )?.label ?? 'All'
  )
}

function savedViewDefinition(view: SavedView) {
  return (
    savedViewDefinitions.find((definition) => definition.label === view) ??
    savedViewDefinitions[0]
  )
}

function readEntityType(
  value: string | null,
): ServerCatalogFilters['entityType'] {
  return serverFilterOptions.entityTypes.includes(value ?? '')
    ? (value as SearchEntityType)
    : ''
}

function resultKey(result: CatalogSearchResult | undefined) {
  return result ? `${result.type}:${result.id}` : ''
}

function displayEntityType(type: SearchEntityType) {
  switch (type) {
    case 'artist':
      return 'Artist'
    case 'release':
      return 'Release'
    case 'track':
      return 'Track'
    case 'ownedItem':
      return 'Owned item'
    case 'label':
      return 'Label'
    case 'playlist':
      return 'Playlist'
  }
}

function buildFilterOptions(entries: CatalogEntry[]) {
  return {
    entityTypes: uniqueValues(entries.map((entry) => entry.type)),
    media: uniqueValues(entries.flatMap((entry) => entry.media)),
    statuses: uniqueValues(entries.flatMap((entry) => entry.statuses)),
    roles: uniqueValues(entries.flatMap((entry) => entry.credits)),
    labels: uniqueValues(entries.map((entry) => entry.label)),
    tags: uniqueValues(entries.flatMap((entry) => entry.tags)),
    formats: uniqueValues(entries.map((entry) => entry.fileFormat)).filter(
      (format) => format !== 'Not recorded',
    ),
  }
}

function matchesSavedView(entry: CatalogEntry, view: SavedView) {
  switch (view) {
    case 'All':
      return true
    case 'Owned':
      return entry.statuses.includes('Owned')
    case 'Physical without digital':
      return (
        entry.media.some(isPhysicalMedium) &&
        !entry.media.some(isDigitalMedium) &&
        !isDigitalMedium(entry.fileFormat)
      )
    case 'Lossy without lossless':
      return (
        isLossyFileFormat(entry.fileFormat) &&
        !isLosslessFileFormat(entry.fileFormat)
      )
    case 'Wanted not owned':
      return (
        entry.statuses.includes('Wanted') && !entry.statuses.includes('Owned')
      )
    case 'Needs digitization':
      return entry.statuses.includes('Needs digitization')
    case 'Credits':
      return entry.credits.length > 0 || entry.type === 'Relation'
    case 'Remixes':
      return entry.credits.some((credit) => /remix/i.test(credit))
    case 'Productions':
      return entry.credits.some((credit) => /producer|production/i.test(credit))
    case 'Labels':
      return (
        (entry.type === 'Release' || entry.type === 'Track') &&
        entry.label !== 'Not recorded'
      )
  }
}

function isDigitalMedium(medium: string) {
  const tokens = mediumLabelTokens(medium)

  return tokens.some((token) => DIGITAL_MEDIUM_TOKENS.has(token))
}

function isPhysicalMedium(medium: string) {
  const normalizedMedium = normalizeMediumLabel(medium)
  const tokens = mediumLabelTokens(medium)

  return (
    tokens.some((token) => PHYSICAL_MEDIUM_TOKENS.has(token)) ||
    normalizedMedium.includes('compact disc') ||
    /(^|[^a-z0-9])(?:\d+\s*x\s*)?cds?($|[^a-z0-9])/.test(normalizedMedium)
  )
}

function mediumLabelTokens(label: string) {
  return normalizeMediumLabel(label)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

function normalizeMediumLabel(label: string) {
  return label.trim().toLowerCase()
}

const DIGITAL_MEDIUM_TOKENS = new Set([
  'aac',
  'aiff',
  'alac',
  'digital',
  'download',
  'downloads',
  'file',
  'files',
  'flac',
  'folder',
  'm4a',
  'mp3',
  'ogg',
  'wav',
])

const PHYSICAL_MEDIUM_TOKENS = new Set([
  'cassette',
  'cd',
  'lp',
  'other',
  'record',
  'records',
  'tape',
  'tapes',
  'vinyl',
])

function isLossyFileFormat(format: string) {
  return ['mp3', 'ogg', 'm4a'].includes(format.trim().toLowerCase())
}

function isLosslessFileFormat(format: string) {
  return ['flac', 'wav', 'aiff', 'alac'].includes(format.trim().toLowerCase())
}

function matchesFilters(entry: CatalogEntry, filters: CatalogFilters) {
  return (
    (!filters.entityType || entry.type === filters.entityType) &&
    (!filters.media || entry.media.includes(filters.media)) &&
    (!filters.status || entry.statuses.includes(filters.status)) &&
    (!filters.role || entry.credits.includes(filters.role)) &&
    (!filters.label || entry.label === filters.label) &&
    (!filters.tag || entry.tags.includes(filters.tag)) &&
    (!filters.format || entry.fileFormat === filters.format)
  )
}

type SearchFieldProps = {
  query: string
  onQueryChange: (query: string) => void
}

function SearchField({ query, onQueryChange }: SearchFieldProps) {
  return (
    <label className="search-field">
      <span className="search-icon" aria-hidden="true">
        <Search size={17} strokeWidth={2.2} />
      </span>
      <span className="visually-hidden">Search collection</span>
      <input
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Artist, release, track, label, role, medium, tag or status"
      />
    </label>
  )
}

type FilterBarProps = {
  activeView: SavedView
  filters: CatalogFilters
  filterOptions: ReturnType<typeof buildFilterOptions>
  visibleCount: number
  onClearFilters: () => void
  onFilterChange: (filters: CatalogFilters) => void
  onViewChange: (view: SavedView) => void
}

function FilterBar({
  activeView,
  filters,
  filterOptions,
  visibleCount,
  onClearFilters,
  onFilterChange,
  onViewChange,
}: FilterBarProps) {
  function updateFilter<Key extends keyof CatalogFilters>(
    key: Key,
    value: CatalogFilters[Key],
  ) {
    onFilterChange({ ...filters, [key]: value })
  }

  return (
    <div className="filter-stack" aria-label="Catalog filters">
      <div className="filter-bar">
        <div className="saved-views" role="list" aria-label="Saved views">
          {savedViews.map((view) => (
            <button
              key={view}
              className="view-pill"
              type="button"
              aria-pressed={activeView === view}
              onClick={() => onViewChange(view)}
            >
              {view}
            </button>
          ))}
        </div>

        <button
          className="button button-secondary"
          type="button"
          onClick={onClearFilters}
        >
          Clear filters
        </button>
        <span className="result-count">{visibleCount} shown</span>
      </div>

      <div className="filter-grid">
        <FilterSelect
          label="Catalog entity type"
          value={filters.entityType}
          values={filterOptions.entityTypes}
          onChange={(value) =>
            updateFilter('entityType', value as CatalogFilters['entityType'])
          }
        />
        <FilterSelect
          label="Media type"
          value={filters.media}
          values={filterOptions.media}
          onChange={(value) => updateFilter('media', value)}
        />
        <FilterSelect
          label="Ownership status"
          value={filters.status}
          values={filterOptions.statuses}
          onChange={(value) => updateFilter('status', value)}
        />
        <FilterSelect
          label="Credit or relation role"
          value={filters.role}
          values={filterOptions.roles}
          onChange={(value) => updateFilter('role', value)}
        />
        <FilterSelect
          label="Label"
          value={filters.label}
          values={filterOptions.labels}
          onChange={(value) => updateFilter('label', value)}
        />
        <FilterSelect
          label="Tag"
          value={filters.tag}
          values={filterOptions.tags}
          onChange={(value) => updateFilter('tag', value)}
        />
        <FilterSelect
          label="File format"
          value={filters.format}
          values={filterOptions.formats}
          onChange={(value) => updateFilter('format', value)}
        />
      </div>
    </div>
  )
}

type CatalogTableProps = {
  entries: CatalogEntry[]
  selectedEntryId: string
  onSelectEntry: (entryId: string) => void
}

function CatalogTable({
  entries,
  selectedEntryId,
  onSelectEntry,
}: CatalogTableProps) {
  return (
    <section className="panel catalog-panel" aria-labelledby="results-title">
      <div className="panel-heading">
        <div>
          <h2 id="results-title">Catalog results</h2>
          <p>Rows combine releases, tracks and ownership signals.</p>
        </div>
      </div>

      <div className="table-scroll">
        <table className="catalog-table">
          <thead>
            <tr>
              <th scope="col">Title</th>
              <th scope="col">Type</th>
              <th scope="col">Year</th>
              <th scope="col">Label</th>
              <th scope="col">Media</th>
              <th scope="col">Status</th>
              <th scope="col">Relation hint</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                aria-selected={entry.id === selectedEntryId}
                className={
                  entry.id === selectedEntryId ? 'is-selected' : undefined
                }
              >
                <th scope="row">
                  <button
                    className="row-title"
                    type="button"
                    aria-label={`Select catalog ${entry.type.toLowerCase()} ${entry.title}`}
                    onClick={() => onSelectEntry(entry.id)}
                  >
                    <strong>{entry.title}</strong>
                    <span>{entry.artist}</span>
                  </button>
                  <a
                    className="detail-link row-link"
                    href={entry.href}
                    aria-label={`Open ${entry.title}`}
                  >
                    Open
                  </a>
                </th>
                <td data-label="Type">{entry.type}</td>
                <td data-label="Year">{entry.year}</td>
                <td data-label="Label">{entry.label}</td>
                <td data-label="Media">
                  <BadgeList values={entry.media} variant="media" />
                </td>
                <td data-label="Status">
                  <StatusBadge tone={entry.statusTone}>
                    {entry.status}
                  </StatusBadge>
                </td>
                <td data-label="Relation">{entry.relationHint}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

type DetailPanelProps = {
  entry: CatalogEntry
}

function DetailPanel({ entry }: DetailPanelProps) {
  return (
    <aside
      className="panel detail-panel"
      aria-labelledby="detail-title"
      aria-label={entry.title}
    >
      <div className="detail-header">
        <span className="entity-type">{entry.type}</span>
        <h2 id="detail-title">{entry.title}</h2>
        <p>{entry.artist}</p>
      </div>

      <StatusBadge tone={entry.statusTone}>{entry.status}</StatusBadge>

      {entry.summary ? <p className="detail-summary">{entry.summary}</p> : null}

      <section className="detail-section" aria-labelledby="catalog-open-title">
        <h3 id="catalog-open-title">Workspace link</h3>
        <a className="detail-link" href={entry.href}>
          Open in workspace
        </a>
      </section>

      <section className="detail-section" aria-labelledby="owned-copies-title">
        <h3 id="owned-copies-title">Media and ownership</h3>
        <dl className="detail-list">
          <div>
            <dt>Media</dt>
            <dd>
              <BadgeList values={entry.media} variant="media" />
            </dd>
          </div>
          <div>
            <dt>Storage</dt>
            <dd>{entry.storage || 'No storage recorded'}</dd>
          </div>
          <div>
            <dt>Condition</dt>
            <dd>{entry.condition || 'No condition recorded'}</dd>
          </div>
        </dl>
      </section>

      <section className="detail-section" aria-labelledby="credits-title">
        <h3 id="credits-title">Credits and relations</h3>
        <BadgeList values={entry.credits} variant="credit" />
        <p>{entry.relationHint}</p>
      </section>

      <section className="detail-section" aria-labelledby="tags-title">
        <h3 id="tags-title">Tags</h3>
        <BadgeList values={entry.tags} variant="tag" />
      </section>
    </aside>
  )
}

function EmptyDetailPanel() {
  return (
    <aside
      className="panel detail-panel empty-detail-panel"
      aria-labelledby="empty-detail-title"
      aria-live="polite"
    >
      <div className="detail-header">
        <span className="entity-type">No selection</span>
        <h2 id="empty-detail-title">No matching catalog entries.</h2>
      </div>

      <p className="detail-summary">Try another search term or filter.</p>
    </aside>
  )
}

type BadgeListProps = {
  values: string[]
  variant: 'media' | 'credit' | 'tag'
}

const collectorSignalLabels: Record<string, string> = {
  physicalwithoutdigital: 'Physical media without digital copy',
  lossywithoutlossless: 'Lossy without lossless',
  wantednotowned: 'Wanted not owned',
  needsdigitization: 'Needs digitization',
  owned: 'Owned',
  wanted: 'Wanted',
  sold: 'Sold',
  digital: 'Digital',
  vinyl: 'Vinyl',
  cd: 'CD',
  cassette: 'Cassette',
  other: 'Other',
}

function formatCollectorSignals(values: string[]) {
  return values.map(formatCollectorSignal)
}

function formatCollectorSignal(value: string) {
  const trimmedValue = value.trim()
  const normalizedValue = trimmedValue.toLowerCase()
  const knownLabel = collectorSignalLabels[normalizedValue]

  if (knownLabel) {
    return knownLabel
  }

  if (trimmedValue.includes(' ')) {
    return trimmedValue
  }

  return trimmedValue
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/^./, (firstLetter) => firstLetter.toUpperCase())
}

function BadgeList({ values, variant }: BadgeListProps) {
  const unique = uniqueValues(values)

  if (unique.length === 0) {
    return <span>None recorded</span>
  }

  return (
    <span className="badge-list">
      {unique.map((value) => (
        <span key={value} className={`badge badge-${variant}`}>
          {value}
        </span>
      ))}
    </span>
  )
}

type StatusBadgeProps = {
  children: string
  tone: CatalogEntry['statusTone']
}

function StatusBadge({ children, tone }: StatusBadgeProps) {
  return <span className={`badge status-badge status-${tone}`}>{children}</span>
}
