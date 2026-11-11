import { ChevronDown, ExternalLink, RefreshCw, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLabelDiscogs } from './useLabelDiscogs'
import { catalogPrefixOptions, filterDiscogsCatalog } from './labelDiscogsModel'
import { LabelDiscogsReleaseList } from './LabelDiscogsReleaseList'
import { LabelDiscogsChooser } from './LabelDiscogsChooser'
import { LabelCatalogPrefixPopover } from './LabelCatalogPrefixPopover'
import { LabelCatalogFeedback, LabelCatalogFooter } from './LabelCatalogStatus'
import './label-discogs.css'

const emptyPrefixes: string[] = []

export function LabelDiscogsCatalog({
  labelId,
  labelName,
  onNavigate,
}: Readonly<{
  labelId: string
  labelName: string
  onNavigate: (url: string) => boolean
}>) {
  const catalog = useLabelDiscogs(labelId, onNavigate)
  const [query, setQuery] = useState('')
  const [chooserOpen, setChooserOpen] = useState(false)
  const [prefixOpen, setPrefixOpen] = useState(false)
  const [showOther, setShowOther] = useState(false)
  const preferences = catalog.preferences
  const prefixes = preferences?.prefixes ?? emptyPrefixes
  const options = useMemo(
    () => catalogPrefixOptions(catalog.items, prefixes),
    [catalog.items, prefixes],
  )
  const visible = useMemo(
    () => filterDiscogsCatalog(catalog.items, showOther ? [] : prefixes, query),
    [catalog.items, prefixes, query, showOther],
  )
  const selectedId = preferences?.discogsLabelId

  function openChooser() {
    catalog.resetSearch()
    setChooserOpen(true)
    void catalog.search(labelName)
  }
  function closeChooser() {
    if (catalog.pending) catalog.cancel()
    catalog.resetSearch()
    setChooserOpen(false)
  }
  function closePrefixes() {
    if (catalog.pending) catalog.cancel()
    setPrefixOpen(false)
  }
  async function applyLabel(id: string) {
    const saved = await catalog.save(id, id === selectedId ? prefixes : [])
    if (saved) {
      setChooserOpen(false)
      setQuery('')
      setShowOther(false)
    }
    return saved
  }
  async function applyPrefixes(next: string[]) {
    if (!selectedId) return false
    const saved = await catalog.save(selectedId, next)
    if (saved) {
      setPrefixOpen(false)
      setShowOther(false)
    }
    return saved
  }

  return (
    <section className="label-discogs" aria-label="Discogs label catalog">
      <LabelCatalogFeedback
        catalog={catalog}
        hidden={chooserOpen || prefixOpen}
      />
      {preferences && !selectedId ? (
        <div className="label-discogs-empty">
          <h3>Explore this label on Discogs</h3>
          <p>
            Choose its Discogs page to compare releases with your collection.
            Your existing records stay unchanged.
          </p>
          <button
            type="button"
            className="button button-primary"
            disabled={catalog.pending}
            onClick={openChooser}
          >
            Choose Discogs label
          </button>
        </div>
      ) : null}
      {selectedId ? (
        <>
          <div className="label-discogs-identity">
            <a
              href={`https://www.discogs.com/label/${encodeURIComponent(selectedId)}`}
              target="_blank"
              rel="noreferrer"
            >
              {preferences.discogsLabelName} · Discogs #{selectedId}{' '}
              <ExternalLink size={14} aria-hidden="true" />
            </a>
            <span className="label-discogs-identity-actions">
              <button
                type="button"
                className="label-text-button"
                disabled={catalog.pending}
                onClick={openChooser}
              >
                Change label
              </button>
              <button
                type="button"
                className="label-text-button"
                aria-label="Disconnect catalog"
                disabled={catalog.pending}
                onClick={() => {
                  void catalog.save(null, [])
                  setQuery('')
                  setShowOther(false)
                }}
              >
                Disconnect<span className="visually-hidden"> catalog</span>
              </button>
            </span>
          </div>
          <div className="label-discogs-toolbar">
            <label className="search-field label-discogs-search">
              <span className="search-icon" aria-hidden="true">
                <Search size={15} />
              </span>
              <span className="visually-hidden">Search loaded releases</span>
              <input
                type="search"
                value={query}
                placeholder="Search loaded releases"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div className="label-prefix-anchor">
              <button
                type="button"
                className="button button-secondary"
                disabled={catalog.pending}
                aria-expanded={prefixOpen}
                aria-haspopup="dialog"
                onClick={() => setPrefixOpen(!prefixOpen)}
              >
                Catalog prefixes ({prefixes.length || 'all'}){' '}
                <ChevronDown size={14} aria-hidden="true" />
              </button>
              {prefixOpen ? (
                <LabelCatalogPrefixPopover
                  initialPrefixes={prefixes}
                  options={options}
                  pending={catalog.pending}
                  error={catalog.error}
                  onApply={applyPrefixes}
                  onCancel={closePrefixes}
                />
              ) : null}
            </div>
            <button
              type="button"
              className="button button-secondary label-discogs-refresh"
              aria-label="Reload catalog"
              title="Reload catalog"
              disabled={catalog.pending}
              onClick={() => void catalog.retry()}
            >
              <RefreshCw size={14} />
            </button>
          </div>
          {prefixes.length > 0 ? (
            <div className="label-discogs-applied">
              <span>Prefixes:</span>
              {prefixes.map((prefix) => (
                <span className="label-prefix-chip" key={prefix}>
                  {prefix}
                  <button
                    type="button"
                    aria-label={`Remove prefix ${prefix}`}
                    disabled={catalog.pending}
                    onClick={() =>
                      void applyPrefixes(
                        prefixes.filter((value) => value !== prefix),
                      )
                    }
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </span>
              ))}
              <button
                type="button"
                className="label-text-button"
                disabled={catalog.pending}
                onClick={() => void applyPrefixes([])}
              >
                Clear filters
              </button>
              <button
                type="button"
                className="label-text-button"
                aria-pressed={showOther}
                onClick={() => setShowOther(!showOther)}
              >
                {showOther ? 'Hide other prefixes' : 'Show other prefixes'}
              </button>
            </div>
          ) : null}
          <LabelDiscogsReleaseList
            items={visible}
            busy={catalog.pending}
            onWanted={(id) => void catalog.wanted(id)}
          />
          {!catalog.pending && catalog.page && visible.length === 0 ? (
            <p className="label-discogs-empty">
              No loaded releases match these filters.
            </p>
          ) : null}
          <LabelCatalogFooter
            page={catalog.page}
            loadedCount={catalog.loadedCount}
            visibleCount={visible.length}
            pending={catalog.pending}
            onLoadMore={() => void catalog.loadMore()}
          />
        </>
      ) : null}
      {chooserOpen ? (
        <LabelDiscogsChooser
          candidates={catalog.candidates}
          searchTotal={catalog.searchTotal}
          searched={catalog.searched}
          initialQuery={labelName}
          selectedId={selectedId ?? null}
          pending={catalog.pending}
          error={catalog.error}
          onSearch={(value) => void catalog.search(value)}
          onApply={applyLabel}
          onCancel={closeChooser}
        />
      ) : null}
    </section>
  )
}
