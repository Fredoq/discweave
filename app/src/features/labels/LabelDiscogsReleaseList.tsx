import { catalogEntityHref } from '../catalog/catalogLinks'
import type { LabelDiscogsRelease } from './labelDiscogsApi'
import { hasCatalogNumber } from './labelDiscogsModel'

export function LabelDiscogsReleaseList({
  items,
  busy,
  onWanted,
}: Readonly<{
  items: LabelDiscogsRelease[]
  busy: boolean
  onWanted: (id: string) => void
}>) {
  return (
    <ul className="label-release-list label-discogs-releases">
      {items.map((item) => (
        <li key={`${item.externalId}:${item.catalogNumber}`}>
          <div className="label-release-metadata">
            <span className="label-catalog-numbers">
              {hasCatalogNumber(item.catalogNumber)
                ? item.catalogNumber
                : 'No catalog number'}
            </span>
            <span>{item.year || 'Unknown year'}</span>
          </div>
          <a
            className="detail-link"
            href={`https://www.discogs.com/release/${encodeURIComponent(item.externalId)}`}
            target="_blank"
            rel="noreferrer"
          >
            {item.title}
          </a>
          <span className="label-release-artist">
            {item.artist || 'Unknown artist'} ·{' '}
            {item.format || 'Unknown format'}
          </span>
          <div className="label-discogs-actions">
            <span className="badge badge-media">
              {item.matchKind === 'exact'
                ? 'Exact edition match'
                : item.matchKind === 'possible'
                  ? 'Possible match'
                  : 'Unmatched'}
            </span>
            {item.matchKind !== 'exact' ? (
              <button
                type="button"
                className="button button-secondary"
                disabled={busy}
                onClick={() => onWanted(item.externalId)}
                aria-label={`Review ${item.title} for Wanted`}
              >
                Review for Wanted
              </button>
            ) : null}
          </div>
          {item.matches.length ? (
            <ul className="label-discogs-matches">
              {item.matches.map((match) => (
                <li key={match.releaseId}>
                  <a
                    href={catalogEntityHref({
                      kind: 'release',
                      id: match.releaseId,
                    })}
                  >
                    {match.title}
                  </a>
                  <span>
                    {[
                      match.inCollection ? 'In collection' : '',
                      match.wanted ? 'Wanted' : '',
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Catalog record'}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
