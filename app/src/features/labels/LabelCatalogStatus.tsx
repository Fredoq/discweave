import type { LabelDiscogsPage } from './labelDiscogsApi'
import type { useLabelDiscogs } from './useLabelDiscogs'

export function LabelCatalogFeedback({
  catalog,
  hidden,
}: Readonly<{ catalog: ReturnType<typeof useLabelDiscogs>; hidden: boolean }>) {
  if (hidden) return null
  return (
    <>
      {catalog.error ? (
        <div role="alert" className="label-discogs-feedback">
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
        <output className="label-discogs-feedback label-collection-note">
          {catalog.notice}
        </output>
      ) : null}
      {catalog.pending ? (
        <div className="label-discogs-feedback label-discogs-actions">
          <output>Loading Discogs…</output>
          <button
            type="button"
            className="label-text-button"
            onClick={catalog.cancel}
          >
            Cancel request
          </button>
        </div>
      ) : null}
      {!catalog.preferences && !catalog.pending && !catalog.error ? (
        <div className="label-discogs-empty">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => void catalog.retry()}
          >
            Load catalog preferences
          </button>
        </div>
      ) : null}
    </>
  )
}

export function LabelCatalogFooter({
  page,
  loadedCount,
  visibleCount,
  pending,
  onLoadMore,
}: Readonly<{
  page: LabelDiscogsPage | null
  loadedCount: number
  visibleCount: number
  pending: boolean
  onLoadMore: () => void
}>) {
  const hasMore = Boolean(page && page.page < page.pages)
  let coverage = ''
  if (page)
    coverage = hasMore
      ? 'Filters apply only to loaded entries.'
      : 'All catalog pages loaded.'
  return (
    <footer className="label-discogs-footer">
      <output>
        {visibleCount} catalog rows shown · {loadedCount} loaded
        {page ? ` of ${page.total} Discogs entries` : ''}.<br />
        {coverage}
      </output>
      {hasMore ? (
        <button
          type="button"
          className="button button-secondary"
          disabled={pending}
          onClick={onLoadMore}
        >
          Load more releases
        </button>
      ) : null}
      <details className="label-discogs-help">
        <summary>Understanding unmatched entries</summary>
        <p>
          An unmatched edition is not necessarily missing from your collection.
          Possible matches need your review; no records are merged
          automatically. Prefixes are inferred from loaded numbers, not official
          series. Entries without a number remain available when all prefixes
          are shown.
        </p>
      </details>
      <span className="label-discogs-attribution">
        Data provided by Discogs.
      </span>
    </footer>
  )
}
