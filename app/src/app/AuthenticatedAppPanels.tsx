export function CatalogStatusPanel({ message }: { message: string }) {
  return (
    <section className="panel section-panel" aria-live="polite">
      <div className="panel-heading">
        <div>
          <h2>Catalog</h2>
          <p role="status">{message}</p>
        </div>
      </div>
    </section>
  )
}

export function CatalogErrorPanel({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <section className="panel section-panel" aria-live="polite">
      <div className="panel-heading">
        <div>
          <h2>Catalog unavailable</h2>
          <p role="alert">{message}</p>
        </div>
      </div>
      <button
        className="button button-secondary"
        type="button"
        onClick={onRetry}
      >
        Retry
      </button>
    </section>
  )
}

export function CatalogSyncErrorNotice({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <section className="panel section-panel" aria-live="polite">
      <div className="panel-heading">
        <div>
          <h2>Catalog sync failed</h2>
          <p role="alert">{message}</p>
          <p>Showing the last loaded catalog data.</p>
        </div>
      </div>
      <button
        className="button button-secondary"
        type="button"
        onClick={onRetry}
      >
        Retry catalog sync
      </button>
    </section>
  )
}
