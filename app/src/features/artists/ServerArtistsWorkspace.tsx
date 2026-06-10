import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { FilterSelect } from '../catalog/FilterSelect'
import { uniqueValues } from '../catalog/catalogGraph'
import {
  loadCatalogGraphContext,
  searchCatalog,
  type CatalogGraphContext,
  type CatalogSearchResult,
} from '../catalog/catalogApi'
import { GraphDetailPanel } from '../catalog/CatalogGraphDetailPanel'
import { resultKey } from '../catalog/catalogWorkspaceShared'
import { useDebouncedValue } from '../catalog/useDebouncedValue'
import { ArtistEntryForm } from './ArtistsWorkspace'
import type { ArtistRecord } from './artistsData'

const searchQueryDebounceMs = 250

type ServerArtistsWorkspaceProps = {
  isManualEntryOpen?: boolean
  locationSearch?: string
  onAddArtist?: (artist: ArtistRecord) => void
  onManualEntryClose?: () => void
  searchRefreshKey: number
}

type ArtistFilters = {
  type: string
  role: string
  tag: string
}

const emptyArtistFilters: ArtistFilters = {
  type: '',
  role: '',
  tag: '',
}

export function ServerArtistsWorkspace({
  isManualEntryOpen = false,
  locationSearch = window.location.search,
  onAddArtist,
  onManualEntryClose = () => {},
  searchRefreshKey,
}: ServerArtistsWorkspaceProps) {
  const initialParams = useMemo(
    () => parseArtistSearchParams(locationSearch),
    [locationSearch],
  )
  const [query, setQuery] = useState(initialParams.query)
  const debouncedQuery = useDebouncedValue(query, searchQueryDebounceMs)
  const [filters, setFilters] = useState<ArtistFilters>(initialParams.filters)
  const [results, setResults] = useState<CatalogSearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [searchStatus, setSearchStatus] = useState<
    'loading' | 'ready' | 'error'
  >('loading')
  const [searchError, setSearchError] = useState('')
  const [selectedResultId, setSelectedResultId] = useState(
    initialParams.artistId,
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
      setSelectedResultId(initialParams.artistId)
    })

    return () => {
      isCurrent = false
    }
  }, [initialParams])

  useEffect(() => {
    const nextUrl = buildArtistsUrl(query, filters, selectedResultId)
    const currentUrl = `${window.location.pathname}${window.location.search}`

    if (currentUrl !== nextUrl) {
      window.history.replaceState({}, '', nextUrl)
    }
  }, [filters, query, selectedResultId])

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
      entityType: 'artist',
      role: filters.role,
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
            : 'Artist search failed. Try again.',
        )
      })

    return () => {
      isCurrent = false
    }
  }, [debouncedQuery, filters.role, filters.tag, searchRefreshKey])

  const visibleResults = useMemo(() => {
    return results.filter(
      (result) => !filters.type || result.subtitle === filters.type,
    )
  }, [filters.type, results])

  const selectedResult =
    visibleResults.find((result) => result.id === selectedResultId) ??
    visibleResults[0] ??
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

    void loadCatalogGraphContext('artist', selectedResult.id)
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

  function handleAddArtist(artist: ArtistRecord) {
    onAddArtist?.(artist)
    setQuery('')
    onManualEntryClose()
  }

  function updateFilter<Key extends keyof ArtistFilters>(
    key: Key,
    value: ArtistFilters[Key],
  ) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  return (
    <section
      className="catalog-layout artists-layout"
      aria-label="Artists workspace"
    >
      <div className="catalog-main">
        <ServerArtistSearchField query={query} onQueryChange={setQuery} />
        <ServerArtistsFilterBar
          filters={filters}
          results={results}
          total={total}
          visibleCount={visibleResults.length}
          onClearFilters={() => {
            setQuery('')
            setFilters(emptyArtistFilters)
          }}
          onFilterChange={updateFilter}
        />
        {isManualEntryOpen ? (
          <ArtistEntryForm
            artists={[]}
            onCancel={onManualEntryClose}
            onSubmit={handleAddArtist}
          />
        ) : null}
        <ServerArtistsTable
          results={visibleResults}
          searchStatus={searchStatus}
          selectedResultId={selectedResult ? resultKey(selectedResult) : ''}
          onSelectResult={(result) => setSelectedResultId(result.id)}
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

function ServerArtistSearchField({
  query,
  onQueryChange,
}: {
  query: string
  onQueryChange: (query: string) => void
}) {
  return (
    <label className="search-field">
      <span className="search-icon" aria-hidden="true">
        <Search size={17} strokeWidth={2.2} />
      </span>
      <span className="visually-hidden">Search artists</span>
      <input
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Name, alias, member, role or relation"
      />
    </label>
  )
}

function ServerArtistsFilterBar({
  filters,
  results,
  total,
  visibleCount,
  onClearFilters,
  onFilterChange,
}: {
  filters: ArtistFilters
  results: CatalogSearchResult[]
  total: number
  visibleCount: number
  onClearFilters: () => void
  onFilterChange: <Key extends keyof ArtistFilters>(
    key: Key,
    value: ArtistFilters[Key],
  ) => void
}) {
  const typeOptions = uniqueValues(
    results.map((result) => result.subtitle ?? '').filter(Boolean),
  )
  const roleOptions = uniqueValues(
    results.flatMap((result) => result.facets.roles),
  )
  const tagOptions = uniqueValues(
    results.flatMap((result) => result.facets.tags),
  )

  return (
    <div className="filter-stack" aria-label="Artist filters">
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
          label="Artist type"
          value={filters.type}
          values={typeOptions}
          onChange={(value) => onFilterChange('type', value)}
        />
        <FilterSelect
          label="Credit or relation role"
          value={filters.role}
          values={roleOptions}
          onChange={(value) => onFilterChange('role', value)}
        />
        <FilterSelect
          label="Tag"
          value={filters.tag}
          values={tagOptions}
          onChange={(value) => onFilterChange('tag', value)}
        />
      </div>
    </div>
  )
}

function ServerArtistsTable({
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
        <p role="status">Searching artists…</p>
      </section>
    )
  }

  if (results.length === 0) {
    return (
      <section className="panel catalog-panel" aria-live="polite">
        <div className="panel-heading">
          <div>
            <h2>Artist index</h2>
            <p>No matching artists.</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="panel catalog-panel" aria-labelledby="artist-title">
      <div className="panel-heading">
        <div>
          <h2 id="artist-title">Artist index</h2>
          <p>Server-ranked artists with roles and relationship context.</p>
        </div>
      </div>

      <div className="table-scroll">
        <table className="catalog-table workspace-table artists-table">
          <thead>
            <tr>
              <th scope="col">Artist</th>
              <th scope="col">Type</th>
              <th scope="col">Context</th>
              <th scope="col">Roles</th>
              <th scope="col">Tags</th>
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
                      aria-label={`Select artist ${result.title}`}
                      onClick={() => onSelectResult(result)}
                    >
                      <strong>{result.title}</strong>
                      <span>{result.snippets[0] ?? 'Artist'}</span>
                    </button>
                  </th>
                  <td data-label="Type">{result.subtitle ?? 'Artist'}</td>
                  <td data-label="Context">
                    {result.summary ?? result.snippets[0] ?? 'No context'}
                  </td>
                  <td data-label="Roles">{joinOrEmpty(result.facets.roles)}</td>
                  <td data-label="Tags">{joinOrEmpty(result.facets.tags)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function parseArtistSearchParams(locationSearch: string) {
  const params = new URLSearchParams(locationSearch)

  return {
    artistId: params.get('artist') ?? '',
    query: params.get('query') ?? params.get('q') ?? '',
    filters: {
      type: params.get('type') ?? '',
      role: params.get('role') ?? '',
      tag: params.get('tag') ?? '',
    },
  }
}

function buildArtistsUrl(
  query: string,
  filters: ArtistFilters,
  artistId: string,
) {
  const params = new URLSearchParams()
  const trimmedQuery = query.trim()

  if (artistId) {
    params.set('artist', artistId)
  }
  if (trimmedQuery) {
    params.set('query', trimmedQuery)
  }
  if (filters.type) {
    params.set('type', filters.type)
  }
  if (filters.role) {
    params.set('role', filters.role)
  }
  if (filters.tag) {
    params.set('tag', filters.tag)
  }

  const search = params.toString()
  return search ? `/artists?${search}` : '/artists'
}

function joinOrEmpty(values: string[]) {
  return values.length > 0 ? values.join(', ') : 'None recorded'
}
