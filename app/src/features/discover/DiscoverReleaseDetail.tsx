import { Disc3 } from 'lucide-react'
import { discoverDisplayValues } from './discoverDisplayValues'
import { appleMusicSearchUrl, safeDiscogsUrl } from './discoverApi'
import type { DiscoverFeedback, DiscoverRelease } from './discoverTypes'

export function DiscoverReleaseDetail({
  release,
  pending,
  onAction,
}: Readonly<{
  release: DiscoverRelease
  pending: boolean
  onAction: (kind: DiscoverFeedback | 'wanted') => void
}>) {
  const sourceUrl = safeDiscogsUrl(release.sourceUrl, release.externalId)
  return (
    <aside
      className="panel discover-detail"
      aria-label="Recommended release details"
    >
      <header className="discover-detail-header">
        <span className="discover-release-icon" aria-hidden="true">
          <Disc3 size={22} strokeWidth={1.5} />
        </span>
        <div>
          <h2>{release.title}</h2>
          <p className="discover-detail-artist">{release.artists.join(', ')}</p>
        </div>
      </header>
      <p className="discover-reason">{release.reason}</p>
      <p className="discover-muted">
        Based on catalog metadata, not audio analysis.
      </p>
      <div className="discover-actions">
        {sourceUrl ? (
          <a
            className="button button-secondary"
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            View on Discogs
          </a>
        ) : null}
        <a
          className="button button-secondary"
          href={appleMusicSearchUrl(release.artists, release.title)}
          target="_blank"
          rel="noreferrer"
        >
          Search Apple Music
        </a>
      </div>
      <p className="discover-muted">
        Apple Music opens a search, not a verified album match.
      </p>
      <button
        className="button button-primary"
        type="button"
        disabled={pending || !sourceUrl}
        onClick={() => onAction('wanted')}
      >
        Review for Wanted
      </button>
      <p className="discover-muted">
        Review the release and select a medium before confirming. No automatic
        collection changes.
      </p>
      <div className="discover-actions discover-feedback">
        <button
          className="button button-secondary"
          type="button"
          disabled={pending}
          onClick={() => onAction('notInterested')}
        >
          Not interested
        </button>
        <button
          className="button button-secondary"
          type="button"
          disabled={pending}
          onClick={() => onAction('alreadyKnow')}
        >
          Already know
        </button>
      </div>
      <dl>
        <dt>Year</dt>
        <dd>{release.year ?? 'Unknown'}</dd>
        <dt>Labels</dt>
        <dd>{discoverDisplayValues(release.labels) || 'Not specified'}</dd>
        <dt>Formats</dt>
        <dd>{discoverDisplayValues(release.formats) || 'Not specified'}</dd>
        <dt>Genres</dt>
        <dd>{release.genres.join(', ') || 'Not specified'}</dd>
      </dl>
      <p className="discover-muted">{release.attribution}</p>
    </aside>
  )
}
