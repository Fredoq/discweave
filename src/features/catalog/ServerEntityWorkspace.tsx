import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { AppRoutePath } from '../../app/routes'
import {
  loadCatalogGraphContext,
  loadRelationDetail,
  pageSize,
  searchCatalog,
  type CatalogDictionaries,
  type CatalogGraphContext,
  type CatalogSearchResult,
  type SearchEntityType,
} from './catalogApi'
import { GraphDetailPanel } from './CatalogGraphDetailPanel'
import { ServerCatalogTable } from './ServerCatalogControls'
import { EntityFilterBar } from './ServerEntityFilters'
import type { CatalogLinkData } from './catalogLinks'
import {
  emptyServerFilters,
  resultKey,
  type ServerCatalogFilters,
} from './catalogWorkspaceShared'
import { useDebouncedValue } from './useDebouncedValue'
import { RelationDetail } from '../relations/RelationDetail'
import type { RelationRecord } from '../relations/relationsData'

const searchQueryDebounceMs = 250
const searchPageSize = pageSize

const emptyRelationCatalogData: CatalogLinkData = {
  artists: [],
  labels: [],
  ownedItems: [],
  playlists: [],
  relations: [],
  releases: [],
  tracks: [],
}

type ServerEntityWorkspaceProps = {
  ariaLabel: string
  dictionaries?: CatalogDictionaries
  entityType?: SearchEntityType
  locationSearch: string
  onRemoveReleaseCover?: (releaseId: string) => Promise<void> | void
  onUploadReleaseCover?: (releaseId: string, file: File) => Promise<void> | void
  placeholder: string
  queryParam: string
  routePath: AppRoutePath
  savedView?: string
  searchLabel: string
  searchRefreshKey: number
}

export function ServerEntityWorkspace({
  ariaLabel,
  dictionaries,
  entityType,
  locationSearch,
  onRemoveReleaseCover,
  onUploadReleaseCover,
  placeholder,
  queryParam,
  routePath,
  savedView,
  searchLabel,
  searchRefreshKey,
}: ServerEntityWorkspaceProps) {
  const initialParams = useMemo(
    () => parseEntitySearchParams(locationSearch, queryParam),
    [locationSearch, queryParam],
  )
  const [query, setQuery] = useState(initialParams.query)
  const debouncedQuery = useDebouncedValue(query, searchQueryDebounceMs)
  const [filters, setFilters] = useState<ServerCatalogFilters>(
    initialParams.filters,
  )
  const [results, setResults] = useState<CatalogSearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [pageOffset, setPageOffset] = useState(0)
  const [searchStatus, setSearchStatus] = useState<
    'loading' | 'ready' | 'error'
  >('loading')
  const [searchError, setSearchError] = useState('')
  const [selectedResultId, setSelectedResultId] = useState(
    initialParams.selectedId,
  )
  const [graphContext, setGraphContext] = useState<CatalogGraphContext | null>(
    null,
  )
  const [graphStatus, setGraphStatus] = useState<
    'idle' | 'loading' | 'ready' | 'missing' | 'error'
  >('idle')
  const [relationDetail, setRelationDetail] = useState<RelationRecord | null>(
    null,
  )
  const [relationStatus, setRelationStatus] = useState<
    'idle' | 'loading' | 'ready' | 'missing' | 'error'
  >('idle')
  const isRelationWorkspace = routePath === '/relations'

  useEffect(() => {
    let isCurrent = true

    queueMicrotask(() => {
      if (!isCurrent) {
        return
      }

      setQuery(initialParams.query)
      setFilters(initialParams.filters)
      setPageOffset(0)
      setSelectedResultId(initialParams.selectedId)
    })

    return () => {
      isCurrent = false
    }
  }, [initialParams])

  useEffect(() => {
    let isCurrent = true

    queueMicrotask(() => {
      if (!isCurrent) {
        return
      }

      setSearchStatus('loading')
      setSearchError('')
    })

    void searchCatalog({
      query: debouncedQuery,
      savedView,
      entityType: entityType ?? filters.entityType,
      media: filters.media,
      status: filters.status,
      role: filters.role,
      labelId: filters.labelId,
      tag: filters.tag,
      limit: searchPageSize,
      offset: pageOffset,
    })
      .then((response) => {
        if (!isCurrent) {
          return
        }

        setResults(response.items)
        setTotal(response.total)
        setSearchStatus('ready')
        setSelectedResultId((currentId) =>
          response.items.some((item) => item.id === currentId)
            ? currentId
            : isRelationWorkspace && currentId && response.items.length === 0
              ? currentId
              : (response.items[0]?.id ?? ''),
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
  }, [
    debouncedQuery,
    entityType,
    filters.entityType,
    filters.labelId,
    filters.media,
    filters.role,
    filters.status,
    filters.tag,
    isRelationWorkspace,
    pageOffset,
    savedView,
    searchRefreshKey,
  ])

  const selectedSearchResult =
    results.find((result) => result.id === selectedResultId) ?? null
  const selectedResult =
    selectedSearchResult ??
    (selectedResultId && isRelationWorkspace ? null : (results[0] ?? null))
  const isRelationDetailSelection = Boolean(
    isRelationWorkspace && selectedResultId && !selectedSearchResult,
  )

  useEffect(() => {
    const nextUrl = buildEntityUrl(
      routePath,
      queryParam,
      selectedResult?.id ?? selectedResultId,
      query,
      filters,
    )
    const currentUrl = `${window.location.pathname}${window.location.search}`

    if (currentUrl !== nextUrl) {
      window.history.replaceState({}, '', nextUrl)
    }
  }, [filters, query, queryParam, routePath, selectedResult, selectedResultId])

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

  useEffect(() => {
    if (!isRelationDetailSelection) {
      queueMicrotask(() => {
        setRelationDetail(null)
        setRelationStatus('idle')
      })
      return
    }

    let isCurrent = true
    queueMicrotask(() => {
      if (!isCurrent) {
        return
      }

      setRelationDetail(null)
      setRelationStatus('loading')
    })

    void loadRelationDetail(selectedResultId)
      .then((relation) => {
        if (!isCurrent) {
          return
        }

        if (!relation) {
          setRelationStatus('missing')
          return
        }

        setRelationDetail(relation)
        setRelationStatus('ready')
      })
      .catch(() => {
        if (isCurrent) {
          setRelationStatus('error')
        }
      })

    return () => {
      isCurrent = false
    }
  }, [isRelationDetailSelection, selectedResultId])

  function handleSelectResult(result: CatalogSearchResult) {
    setSelectedResultId(result.id)
    pushSelectionUrl(routePath, queryParam, result.id, query, filters)
  }

  return (
    <section className="catalog-layout" aria-label={ariaLabel}>
      <div className="catalog-main">
        <EntitySearchField
          label={searchLabel}
          placeholder={placeholder}
          query={query}
          onQueryChange={(nextQuery) => {
            setQuery(nextQuery)
            setPageOffset(0)
          }}
        />
        <EntityFilterBar
          filters={filters}
          dictionaries={dictionaries}
          results={results}
          total={total}
          visibleCount={results.length}
          onClearFilters={() => {
            setQuery('')
            setFilters(emptyServerFilters)
            setPageOffset(0)
          }}
          onFilterChange={(nextFilters) => {
            setFilters(nextFilters)
            setPageOffset(0)
          }}
        />
        <ServerCatalogTable
          results={results}
          searchStatus={searchStatus}
          selectedResultId={selectedResult ? resultKey(selectedResult) : ''}
          dictionaries={dictionaries}
          showContext={false}
          showEntityType={false}
          total={total}
          pageLimit={searchPageSize}
          pageOffset={pageOffset}
          onNextPage={() => {
            setPageOffset((currentOffset) => currentOffset + searchPageSize)
          }}
          onPreviousPage={() => {
            setPageOffset((currentOffset) =>
              Math.max(0, currentOffset - searchPageSize),
            )
          }}
          onSelectResult={handleSelectResult}
        />
        {searchStatus === 'error' ? (
          <section className="panel section-panel" role="alert">
            {searchError}
          </section>
        ) : null}
      </div>

      {isRelationDetailSelection ? (
        <RelationRouteDetailPanel
          relation={relationDetail}
          relationId={selectedResultId}
          status={relationStatus}
        />
      ) : (
        <GraphDetailPanel
          context={graphContext}
          dictionaries={dictionaries}
          graphStatus={graphStatus}
          onRemoveReleaseCover={onRemoveReleaseCover}
          onUploadReleaseCover={onUploadReleaseCover}
          result={selectedResult}
        />
      )}
    </section>
  )
}

function RelationRouteDetailPanel({
  relation,
  relationId,
  status,
}: {
  relation: RelationRecord | null
  relationId: string
  status: 'idle' | 'loading' | 'ready' | 'missing' | 'error'
}) {
  if (status === 'loading' || status === 'idle') {
    return (
      <aside className="panel detail-panel" aria-live="polite">
        <div className="detail-header">
          <span className="entity-type">Relation</span>
          <h2>Loading relation</h2>
          <p role="status">Loading relation detail...</p>
        </div>
      </aside>
    )
  }

  if (status === 'missing') {
    return (
      <aside className="panel detail-panel" aria-live="polite">
        <div className="detail-header">
          <span className="entity-type">No access</span>
          <h2>Relation not available</h2>
          <p className="detail-summary">
            Relation {relationId} is no longer available in the active
            collection.
          </p>
        </div>
      </aside>
    )
  }

  if (status === 'error' || !relation) {
    return (
      <aside className="panel detail-panel" aria-live="polite">
        <div className="detail-header">
          <span className="entity-type">Relation</span>
          <h2>Relation detail failed</h2>
          <p className="detail-summary">Relation detail could not be loaded.</p>
        </div>
      </aside>
    )
  }

  return (
    <RelationDetail
      catalogData={emptyRelationCatalogData}
      relation={relation}
      trustProvidedLinks
    />
  )
}

function EntitySearchField({
  label,
  placeholder,
  query,
  onQueryChange,
}: {
  label: string
  placeholder: string
  query: string
  onQueryChange: (query: string) => void
}) {
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

function parseEntitySearchParams(
  locationSearch: string,
  queryParam: string,
): {
  selectedId: string
  query: string
  filters: ServerCatalogFilters
} {
  const params = new URLSearchParams(locationSearch)

  return {
    selectedId: params.get(queryParam) ?? '',
    query: params.get('query') ?? params.get('q') ?? '',
    filters: {
      ...emptyServerFilters,
      media: params.get('media') ?? '',
      status: params.get('status') ?? '',
      role: params.get('role') ?? '',
      labelId: params.get('labelId') ?? '',
      tag: params.get('tag') ?? '',
    },
  }
}

function buildEntityUrl(
  routePath: AppRoutePath,
  queryParam: string,
  selectedId: string,
  query: string,
  filters: ServerCatalogFilters,
) {
  const params = new URLSearchParams()
  const trimmedQuery = query.trim()

  if (selectedId) {
    params.set(queryParam, selectedId)
  }
  if (trimmedQuery) {
    params.set('query', trimmedQuery)
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
  return search ? `${routePath}?${search}` : routePath
}

function pushSelectionUrl(
  routePath: AppRoutePath,
  queryParam: string,
  selectedId: string,
  query: string,
  filters: ServerCatalogFilters,
) {
  const nextUrl = buildEntityUrl(
    routePath,
    queryParam,
    selectedId,
    query,
    filters,
  )
  const currentUrl = `${window.location.pathname}${window.location.search}`

  if (currentUrl !== nextUrl) {
    window.history.pushState({}, '', nextUrl)
    window.dispatchEvent(new Event('cratebase:navigation'))
  }
}
