import { useState } from 'react'
import { discoverBridge } from './discoverApi'
import { DiscoverReleaseDetail } from './DiscoverReleaseDetail'
import { DiscoverSettings } from './DiscoverSettings'
import type { DiscoverMode } from './discoverTypes'
import { useDiscover } from './useDiscover'
import './discover.css'

export function DiscoverWorkspace({
  onNavigateToUrl,
  locationSearch = '',
}: Readonly<{
  locationSearch?: string
  onNavigateToUrl: (href: string) => boolean
}>) {
  const [mode, setMode] = useState<DiscoverMode>('familiar')
  const [selectedId, setSelectedId] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsRevision, setSettingsRevision] = useState(0)
  const params = new URLSearchParams(locationSearch)
  const releaseId = params.get('release') ?? undefined
  const trackId = releaseId ? undefined : (params.get('track') ?? undefined)
  const discover = useDiscover(onNavigateToUrl, settingsRevision, {
    releaseId,
    trackId,
  })
  const selected =
    discover.result?.items.find((item) => item.externalId === selectedId) ??
    discover.result?.items[0]
  const ready = Boolean(
    discover.status?.configured && discover.status.consented,
  )
  const busy = discover.pending || discover.actionPending

  return (
    <section className="discover-workspace" aria-label="Discover workspace">
      <div className="discover-toolbar">
        <div className="discover-actions">
          <button
            className="button button-primary"
            type="button"
            disabled={!ready || busy || settingsOpen}
            onClick={() => void discover.generate(mode)}
          >
            {discover.pending
              ? 'Finding releases…'
              : discover.result
                ? 'Another 10'
                : 'Generate 10'}
          </button>
          {discover.pending ? (
            <button
              className="button button-secondary"
              type="button"
              onClick={() => void discover.cancel()}
            >
              Cancel
            </button>
          ) : null}
          <label className="discover-mode">
            Exploration
            <select
              value={mode}
              disabled={busy}
              onChange={(event) => setMode(event.target.value as DiscoverMode)}
            >
              <option value="familiar">Familiar</option>
              <option value="adventurous">Adventurous</option>
            </select>
          </label>
        </div>
        <button
          className="button button-secondary"
          type="button"
          disabled={busy}
          aria-expanded={settingsOpen}
          onClick={() => {
            setSettingsOpen(!settingsOpen)
            if (settingsOpen) setSettingsRevision((revision) => revision + 1)
          }}
        >
          {settingsOpen
            ? 'Close recommendation settings'
            : 'Recommendation settings'}
        </button>
      </div>
      {settingsOpen ? <DiscoverSettings /> : null}
      {releaseId || trackId ? (
        <p>
          Using the selected {releaseId ? 'release' : 'track'} as additional
          context. Results are always releases.{' '}
          <a href="/discover">Use my whole collection only</a>
        </p>
      ) : null}
      <p className="discover-muted">
        Your Overall ratings and standout marks guide the search. Owned, Wanted,
        dismissed and recently shown releases are excluded. Different recordings
        and remixes remain distinct candidates.
      </p>
      {!discoverBridge() ? (
        <div className="panel section-panel">
          <p>
            Open DiscWeave desktop to generate recommendations securely with
            your own OpenAI key.
          </p>
        </div>
      ) : null}
      {discoverBridge() && !ready && !settingsOpen ? (
        <div className="panel section-panel">
          <p>
            Set up OpenAI and allow metadata sharing in Recommendation settings.
            Discogs must also be configured in Settings → Integrations.
          </p>
        </div>
      ) : null}
      {discover.error ? <p role="alert">{discover.error}</p> : null}
      {discover.notice ? <p role="status">{discover.notice}</p> : null}
      {discover.result ? (
        <>
          <div aria-live="polite">
            <p>
              {discover.result.items.length} recommended{' '}
              {discover.result.items.length === 1 ? 'release' : 'releases'}
            </p>
            <p className="discover-muted">{discover.result.message}</p>
            {discover.result.items.length < 10 ? (
              <p className="discover-muted">
                Only verified, eligible releases are shown; Discover does not
                invent results to fill ten places.
              </p>
            ) : null}
          </div>
          <div className="discover-results">
            <section className="panel" aria-label="Recommended releases">
              <ul className="discover-list">
                {discover.result.items.map((release) => (
                  <li key={release.externalId}>
                    <button
                      className="discover-release-row"
                      type="button"
                      aria-pressed={selected?.externalId === release.externalId}
                      onClick={() => setSelectedId(release.externalId)}
                    >
                      <strong>{release.title}</strong>
                      <span>{release.artists.join(', ')}</span>
                      <span className="discover-muted">
                        {[
                          release.year,
                          release.labels.join(', '),
                          release.formats.join(', '),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {discover.result.items.length === 0 ? (
                <p className="section-panel">
                  No eligible releases in this batch. Try another search or add
                  more Overall ratings.
                </p>
              ) : null}
            </section>
            {selected ? (
              <DiscoverReleaseDetail
                release={selected}
                pending={busy}
                onAction={(kind) => void discover.act(selected, kind)}
              />
            ) : null}
          </div>
        </>
      ) : !settingsOpen ? (
        <div className="panel section-panel">
          <h2>A new starting point for your collection</h2>
          <p>
            Generate up to ten releases from the music you have rated. No seed
            selection is needed.
          </p>
          <p className="discover-muted">
            Low ratings help avoid poor matches; unrated music is not treated as
            a dislike.
          </p>
        </div>
      ) : null}
    </section>
  )
}
