import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { LabelRecord } from '../labels/labelsData'
import {
  loadCatalogGraphContext,
  pageSize,
  searchCatalog,
  type CatalogDictionaries,
  type CatalogGraphContext,
  type CatalogSearchResult,
} from './catalogApi'
import { GraphDetailPanel } from './CatalogGraphDetailPanel'
import { ServerCatalogTable, ServerFilterBar } from './ServerCatalogControls'
import {
  buildCatalogUrl,
  emptyServerFilters,
  parseCatalogSearchParams,
  resultKey,
  serverSavedViewParams,
  type SavedView,
  type ServerCatalogFilters,
} from './catalogWorkspaceShared'
import { SearchField } from './LocalCatalogWorkspace'

const searchPageSize = pageSize

export function ServerCatalogWorkspace({
  addEntryPanel,
  dictionaries,
  labels,
  locationSearch,
  onRemoveReleaseCover,
  onUploadReleaseCover,
  searchRefreshKey,
}: {
  addEntryPanel?: ReactNode
  dictionaries?: CatalogDictionaries
  labels: LabelRecord[]
  locationSearch: string
  onRemoveReleaseCover?: (releaseId: string) => Promise<void> | void
  onUploadReleaseCover?: (releaseId: string, file: File) => Promise<void> | void
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
  const [pageOffset, setPageOffset] = useState(0)
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
    let isCurrent = true

    queueMicrotask(() => {
      if (!isCurrent) {
        return
      }

      setQuery(initialParams.query)
      setActiveView(initialParams.activeView)
      setFilters(initialParams.filters)
      setPageOffset(0)
    })

    return () => {
      isCurrent = false
    }
  }, [initialParams])

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
          response.items.some((item) => resultKey(item) === currentId)
            ? currentId
            : response.items[0]
              ? resultKey(response.items[0])
              : '',
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
  }, [activeView, filters, pageOffset, query, searchRefreshKey])

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
        <SearchField
          query={query}
          onQueryChange={(nextQuery) => {
            setQuery(nextQuery)
            setPageOffset(0)
          }}
        />
        {addEntryPanel}
        <ServerFilterBar
          activeView={activeView}
          filters={filters}
          dictionaries={dictionaries}
          labels={labels}
          results={results}
          visibleCount={results.length}
          total={total}
          onClearFilters={() => {
            setQuery('')
            setActiveView('All')
            setFilters(emptyServerFilters)
            setPageOffset(0)
          }}
          onFilterChange={(nextFilters) => {
            setFilters(nextFilters)
            setPageOffset(0)
          }}
          onViewChange={(nextView) => {
            setActiveView(nextView)
            setPageOffset(0)
          }}
        />
        <ServerCatalogTable
          results={results}
          searchStatus={searchStatus}
          selectedResultId={selectedResult ? resultKey(selectedResult) : ''}
          dictionaries={dictionaries}
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
        dictionaries={dictionaries}
        graphStatus={graphStatus}
        onRemoveReleaseCover={onRemoveReleaseCover}
        onUploadReleaseCover={onUploadReleaseCover}
        result={selectedResult}
      />
    </section>
  )
}
