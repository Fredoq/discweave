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

  const appearanceLinks =
    context.entity.type === 'artist'
      ? [...context.sections.releases, ...context.sections.tracks]
      : context.sections.releases
  const trackLinks =
    context.entity.type === 'artist' ? [] : context.sections.tracks

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
      <GraphSection title="Appearances" links={appearanceLinks} />
      <GraphSection title="Tracks" links={trackLinks} />
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
  const groups = groupGraphLinks(links, title)

  return (
    <section className="detail-section" aria-labelledby={id}>
      <h3 id={id}>{title}</h3>
      {links.length === 0 ? (
        <p className="detail-summary">None recorded.</p>
      ) : (
        <div className="graph-link-groups">
          {groups.map((group) => (
            <div className="graph-link-group" key={group.label}>
              <h4>{group.label}</h4>
              <ul className="graph-link-list">
                {group.links.map((link) => (
                  <li key={`${link.type}:${link.id}:${link.relation ?? title}`}>
                    <a
                      className="detail-link"
                      href={catalogEntityHref({
                        kind: link.type,
                        id: link.id,
                      })}
                    >
                      {link.title}
                    </a>
                    {link.subtitle ? <span>{link.subtitle}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function groupGraphLinks(links: CatalogGraphLink[], title: string) {
  const groups = new Map<string, CatalogGraphLink[]>()

  for (const link of links) {
    const label = link.relation?.trim() || defaultGraphGroupLabel(link, title)
    groups.set(label, [...(groups.get(label) ?? []), link])
  }

  return [...groups.entries()].map(([label, groupLinks]) => ({
    label,
    links: groupLinks,
  }))
}

function defaultGraphGroupLabel(link: CatalogGraphLink, title: string) {
  switch (link.type) {
    case 'artist':
      return 'Artist links'
    case 'release':
      return 'Release links'
    case 'track':
      return 'Track links'
    case 'ownedItem':
      return 'Owned copy links'
    case 'label':
      return 'Label links'
    case 'playlist':
      return 'Playlist links'
    case 'relation':
      return 'Relation links'
    default:
      return title
  }
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
