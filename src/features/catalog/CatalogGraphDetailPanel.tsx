import type {
  CatalogGraphContext,
  CatalogGraphLink,
  CatalogSearchResult,
} from './catalogApi'
import { catalogEntityHref } from './catalogLinks'
import { displayEntityType } from './catalogWorkspaceShared'

export function GraphDetailPanel({
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

function EmptyDetailPanel() {
  return (
    <aside
      className="panel detail-panel empty-detail-panel"
      aria-labelledby="empty-detail-title"
      aria-live="polite"
    >
      <div className="detail-header">
        <span className="entity-type">Catalog</span>
        <h2 id="empty-detail-title">Select a catalog row.</h2>
      </div>
      <p className="detail-summary">
        Relationship context appears after selecting a result.
      </p>
    </aside>
  )
}

const collectorSignalLabels: Record<string, string> = {
  digitalWithoutPhysical: 'Digital without physical',
  losslessAvailable: 'Lossless available',
  lossyWithoutLossless: 'Lossy without lossless',
  missingCredits: 'Missing credits',
  physicalWithoutDigital: 'Physical without digital',
  wantedNotOwned: 'Wanted not owned',
}

function formatCollectorSignals(values: string[]) {
  return values.map(formatCollectorSignal)
}

function formatCollectorSignal(value: string) {
  return (
    collectorSignalLabels[value] ??
    value.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  )
}

function BadgeList({
  values,
  variant,
}: {
  values: string[]
  variant: 'media' | 'tag'
}) {
  if (values.length === 0) {
    return <span className="badge badge-tag">None</span>
  }

  return (
    <span className="badge-list">
      {values.map((value) => (
        <span key={value} className={`badge badge-${variant}`}>
          {value}
        </span>
      ))}
    </span>
  )
}
