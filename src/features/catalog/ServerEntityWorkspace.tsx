import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { AppRoutePath } from '../../app/routes'
import {
  loadCatalogGraphContext,
  searchCatalog,
  type CatalogGraphContext,
  type CatalogSearchResult,
  type SearchEntityType,
} from './catalogApi'
import { GraphDetailPanel } from './CatalogGraphDetailPanel'
import { ServerCatalogTable } from './ServerCatalogControls'
import { FilterSelect } from './FilterSelect'
import { uniqueValues } from './catalogGraph'
import {
  emptyServerFilters,
  resultKey,
  type ServerCatalogFilters,
} from './catalogWorkspaceShared'
import { useDebouncedValue } from './useDebouncedValue'

const searchQueryDebounceMs = 250

type ServerEntityWorkspaceProps = {
  ariaLabel: string
  entityType?: SearchEntityType
  locationSearch: string
  placeholder: string
  queryParam: string
  routePath: AppRoutePath
  savedView?: string
  searchLabel: string
  searchRefreshKey: number
}

export function ServerEntityWorkspace({
  ariaLabel,
  entityType,
  locationSearch,
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

  useEffect(() => {
    let isCurrent = true

    queueMicrotask(() => {
      if (!isCurrent) {
        return
      }

      setQuery(initialParams.query)
      setFilters(initialParams.filters)
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
          response.items.some((item) => item.id === currentId)
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
    savedView,
    searchRefreshKey,
  ])

  const selectedResult =
    results.find((result) => result.id === selectedResultId) ??
    results[0] ??
    null

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
          onQueryChange={setQuery}
        />
        <EntityFilterBar
          filters={filters}
          results={results}
          total={total}
          visibleCount={results.length}
          onClearFilters={() => {
            setQuery('')
            setFilters(emptyServerFilters)
          }}
          onFilterChange={setFilters}
        />
        <ServerCatalogTable
          results={results}
          searchStatus={searchStatus}
          selectedResultId={selectedResult ? resultKey(selectedResult) : ''}
          onSelectResult={handleSelectResult}
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

function EntityFilterBar({
  filters,
  results,
  total,
  visibleCount,
  onClearFilters,
  onFilterChange,
}: {
  filters: ServerCatalogFilters
  results: CatalogSearchResult[]
  total: number
  visibleCount: number
  onClearFilters: () => void
  onFilterChange: (filters: ServerCatalogFilters) => void
}) {
  function updateFilter<Key extends keyof ServerCatalogFilters>(
    key: Key,
    value: ServerCatalogFilters[Key],
  ) {
    onFilterChange({ ...filters, [key]: value })
  }
  const mediaOptions = uniqueValues(
    results.flatMap((result) => result.facets.media),
  )
  const statusOptions = uniqueValues(
    results.flatMap((result) => result.facets.statuses),
  )
  const roleOptions = uniqueValues(
    results.flatMap((result) => result.facets.roles),
  )
  const tagOptions = uniqueValues(
    results.flatMap((result) => result.facets.tags),
  )

  return (
    <div className="filter-stack" aria-label="Workspace filters">
      <div className="filter-bar">
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
