import { catalogEntityHref } from '../catalog/catalogLinks'
import type { LabelDiscogsRelease } from './labelDiscogsApi'
import { hasCatalogNumber } from './labelDiscogsModel'

const matchLabels = {
  exact: 'Exact edition match',
  possible: 'Possible match',
  unmatched: 'Unmatched',
}

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
    <div className="label-discogs-table-wrap">
      <table className="label-discogs-table" aria-label="Discogs releases">
        <thead>
          <tr>
            <th scope="col">Catalog no.</th>
            <th scope="col">Artist / release</th>
            <th scope="col">Year / format</th>
            <th scope="col">Match status</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={`${item.externalId}:${item.catalogNumber}`}>
              <td className="label-discogs-number">
                {hasCatalogNumber(item.catalogNumber)
                  ? item.catalogNumber
                  : 'No catalog number'}
              </td>
              <td>
                <strong>{item.artist || 'Unknown artist'}</strong>
                <a
                  className="detail-link"
                  href={`https://www.discogs.com/release/${encodeURIComponent(item.externalId)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {item.title}
                </a>
              </td>
              <td className="label-discogs-format">
                <span>{item.year || 'Unknown year'}</span>
                <span>{item.format || 'Unknown format'}</span>
              </td>
              <td>
                <span
                  className={`label-match-badge label-match-${item.matchKind}`}
                >
                  {matchLabels[item.matchKind]}
                </span>
                {item.matches.length ? (
                  <ul className="label-discogs-matches">
                    {item.matches.map((match) => (
                      <li key={match.releaseId}>
                        <a
                          href={catalogEntityHref({
                            kind: 'release',
                            id: match.releaseId,
                          })}
                          title={match.title}
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
              </td>
              <td className="label-discogs-row-action">
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
