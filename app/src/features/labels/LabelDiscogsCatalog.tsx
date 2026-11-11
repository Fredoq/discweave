import { useMemo, useState } from 'react'
import { useLabelDiscogs } from './useLabelDiscogs'
import {
  catalogPrefixOptions,
  catalogSearchKey,
  filterDiscogsCatalog,
} from './labelDiscogsModel'
import { LabelDiscogsReleaseList } from './LabelDiscogsReleaseList'
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
  const [labelQuery, setLabelQuery] = useState(labelName)
  const [query, setQuery] = useState('')
  const [customPrefix, setCustomPrefix] = useState('')
  const [changing, setChanging] = useState(false)
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
  const selected = Boolean(preferences?.discogsLabelId)
  const normalizedPrefix = catalogSearchKey(customPrefix)

  function updatePrefixes(next: string[]) {
    if (preferences?.discogsLabelId)
      void catalog.save(preferences.discogsLabelId, next)
  }

  return (
    <section
      className="detail-section label-discogs"
      aria-label="Discogs label catalog"
    >
      <p className="label-collection-note">
        Browse this label’s Discogs catalog and compare editions with your
        collection. Data provided by Discogs.
      </p>
      {catalog.error ? (
        <div role="alert">
          <p>{catalog.error}</p>
          <button
            type="button"
            className="button button-secondary"
            disabled={catalog.pending}
            onClick={() => void catalog.retry()}
          >
            Retry catalog
          </button>{' '}
          <a href="/settings">Settings</a>
        </div>
      ) : null}
      {catalog.notice ? (
        <p role="status" className="label-collection-note">
          {catalog.notice}
        </p>
      ) : null}
      {catalog.pending ? (
        <div className="label-discogs-actions">
          <span role="status">Loading Discogs…</span>
          <button
            type="button"
            className="button button-secondary"
            onClick={catalog.cancel}
          >
            Cancel request
          </button>
        </div>
      ) : null}
      {!preferences && !catalog.pending && !catalog.error ? (
        <button
          type="button"
          className="button button-secondary"
          onClick={() => void catalog.retry()}
        >
          Load catalog preferences
        </button>
      ) : null}
      {preferences && (!selected || changing) ? (
        <div className="label-discogs-setup">
          <h3>Choose the Discogs label</h3>
          <p className="label-collection-note">
            Names can overlap. Check the Discogs page before choosing; this does
            not change your collection records.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void catalog.search(labelQuery)
            }}
          >
            <label>
              <span>Search Discogs labels</span>
              <input
                value={labelQuery}
                maxLength={200}
                onChange={(event) => setLabelQuery(event.target.value)}
              />
            </label>
            <button
              className="button button-secondary"
              disabled={catalog.pending || !labelQuery.trim()}
              type="submit"
            >
              Find labels
            </button>
          </form>
          {catalog.searched && catalog.candidates.length === 0 ? (
            <p>No matching labels found. Try another name.</p>
          ) : null}
          {catalog.searched &&
          catalog.searchTotal !== null &&
          catalog.searchTotal > catalog.candidates.length ? (
            <p className="label-collection-note">
              Showing {catalog.candidates.length} of {catalog.searchTotal} label
              matches. Refine the search to find another label.
            </p>
          ) : null}
          <ul className="label-discogs-candidates">
            {catalog.candidates.map((candidate) => (
              <li key={candidate.externalId}>
                <a
                  href={`https://www.discogs.com/label/${encodeURIComponent(candidate.externalId)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {candidate.name} · {candidate.externalId}
                </a>
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={catalog.pending}
                  onClick={() => {
                    void catalog.save(candidate.externalId, [])
                    setChanging(false)
                    setQuery('')
                    setShowOther(false)
                  }}
                >
                  Choose {candidate.name}
                </button>
              </li>
            ))}
          </ul>
          {selected ? (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setChanging(false)}
            >
              Keep current label
            </button>
          ) : null}
        </div>
      ) : null}
      {selected ? (
        <>
          <div className="label-discogs-actions">
            <a
              href={`https://www.discogs.com/label/${encodeURIComponent(preferences!.discogsLabelId!)}`}
              target="_blank"
              rel="noreferrer"
            >
              {preferences?.discogsLabelName} on Discogs
            </a>
            <button
              type="button"
              className="button button-secondary"
              disabled={catalog.pending}
              onClick={() => setChanging(!changing)}
            >
              {changing ? 'Close label search' : 'Change label'}
            </button>
            <button
              type="button"
              className="button button-secondary"
              disabled={catalog.pending}
              onClick={() => {
                void catalog.save(null, [])
                setChanging(false)
                setQuery('')
                setShowOther(false)
              }}
            >
              Disconnect catalog
            </button>
            <button
              type="button"
              className="button button-secondary"
              disabled={catalog.pending}
              onClick={() => void catalog.retry()}
            >
              Reload catalog
            </button>
          </div>
          <details className="label-discogs-prefixes">
            <summary>
              Catalog prefixes ·{' '}
              {prefixes.length ? prefixes.join(', ') : 'All numbers'}
            </summary>
            <p className="label-collection-note">
              Suggested from loaded numbers, not official series. Select any
              prefixes you collect. No selection shows all numbers, including
              entries without a number.
            </p>
            <div className="label-discogs-prefix-options">
              {options.map(([prefix, count]) => (
                <label key={prefix}>
                  <input
                    type="checkbox"
                    checked={prefixes.includes(prefix)}
                    disabled={
                      catalog.pending ||
                      (!prefixes.includes(prefix) && prefixes.length >= 50)
                    }
                    onChange={() =>
                      updatePrefixes(
                        prefixes.includes(prefix)
                          ? prefixes.filter((value) => value !== prefix)
                          : [...prefixes, prefix],
                      )
                    }
                  />
                  <span>
                    {prefix} <small>({count})</small>
                  </span>
                </label>
              ))}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (normalizedPrefix && !prefixes.includes(normalizedPrefix)) {
                  updatePrefixes([...prefixes, normalizedPrefix])
                  setCustomPrefix('')
                }
              }}
            >
              <label>
                <span>Add a prefix</span>
                <input
                  value={customPrefix}
                  maxLength={64}
                  placeholder="e.g. 50WLP"
                  onChange={(event) => setCustomPrefix(event.target.value)}
                />
              </label>
              <button
                type="submit"
                className="button button-secondary"
                disabled={
                  catalog.pending ||
                  !normalizedPrefix ||
                  prefixes.includes(normalizedPrefix) ||
                  prefixes.length >= 50
                }
              >
                Add prefix
              </button>
            </form>
            <button
              type="button"
              className="button button-secondary"
              disabled={catalog.pending || prefixes.length === 0}
              onClick={() => updatePrefixes([])}
            >
              Show all prefixes
            </button>
          </details>
          {prefixes.length > 0 ? (
            <label className="label-discogs-toggle">
              <input
                type="checkbox"
                checked={showOther}
                onChange={(event) => setShowOther(event.target.checked)}
              />{' '}
              Show other prefixes temporarily
            </label>
          ) : null}
          <label className="label-discogs-search">
            <span>Search loaded releases</span>
            <input
              type="search"
              value={query}
              placeholder="Artist, title or catalog number"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <p role="status" className="label-collection-note">
            {visible.length} catalog rows shown · {catalog.loadedCount} loaded
            {catalog.page
              ? ` of ${catalog.page.total} Discogs entries`
              : ''}.{' '}
            {catalog.page && catalog.page.page < catalog.page.pages
              ? 'Filters apply only to loaded entries. Load more to explore the rest.'
              : catalog.page
                ? 'All catalog pages loaded.'
                : ''}
          </p>
          <p className="label-collection-note">
            An unmatched edition is not necessarily missing from your
            collection. Possible matches need your review; no records are merged
            automatically.
          </p>
          <LabelDiscogsReleaseList
            items={visible}
            busy={catalog.pending}
            onWanted={(id) => void catalog.wanted(id)}
          />
          {!catalog.pending && catalog.page && visible.length === 0 ? (
            <p>No loaded releases match these filters.</p>
          ) : null}
          {catalog.page && catalog.page.page < catalog.page.pages ? (
            <button
              type="button"
              className="button button-secondary"
              disabled={catalog.pending}
              onClick={() => void catalog.loadMore()}
            >
              Load more releases
            </button>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
