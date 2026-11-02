import { Disc3 } from 'lucide-react'
import { discoverDisplayValues } from './discoverDisplayValues'
import { DiscoverReleaseDetail } from './DiscoverReleaseDetail'
import type {
  DiscoverFeedback,
  DiscoverMode,
  DiscoverRelease,
  DiscoverResult,
} from './discoverTypes'

export function DiscoverToolbar({
  mode,
  onModeChange,
  pending,
  hasResults,
  ready,
  busy,
  settingsOpen,
  onGenerate,
  onCancel,
  onSettingsToggle,
}: Readonly<{
  mode: DiscoverMode
  onModeChange: (mode: DiscoverMode) => void
  pending: boolean
  hasResults: boolean
  ready: boolean
  busy: boolean
  settingsOpen: boolean
  onGenerate: () => void
  onCancel: () => void
  onSettingsToggle: () => void
}>) {
  let generateLabel = hasResults ? 'Another 10' : 'Generate 10'
  if (pending) generateLabel = 'Finding releases…'
  return (
    <div className="discover-toolbar">
      <div className="discover-actions">
        <button
          className="button button-primary"
          type="button"
          disabled={!ready || busy || settingsOpen}
          onClick={() => onGenerate()}
        >
          {generateLabel}
        </button>
        {pending ? (
          <button
            className="button button-secondary"
            type="button"
            onClick={() => onCancel()}
          >
            Cancel
          </button>
        ) : null}
        <label className="discover-mode">
          <span>Exploration</span>
          <select
            value={mode}
            disabled={busy}
            onChange={(event) =>
              onModeChange(event.target.value as DiscoverMode)
            }
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
        onClick={onSettingsToggle}
      >
        {settingsOpen
          ? 'Close recommendation settings'
          : 'Recommendation settings'}
      </button>
    </div>
  )
}

export function DiscoverContent({
  available,
  ready,
  result,
  settingsOpen,
  selected,
  busy,
  onSelect,
  onAction,
}: Readonly<{
  available: boolean
  ready: boolean
  result: DiscoverResult | null
  settingsOpen: boolean
  selected: DiscoverRelease | undefined
  busy: boolean
  onSelect: (id: string) => void
  onAction: (
    release: DiscoverRelease,
    kind: DiscoverFeedback | 'wanted',
  ) => void
}>) {
  if (!result)
    return settingsOpen ? null : (
      <DiscoverEmptyState available={available} ready={ready} />
    )
  return (
    <>
      <div className="discover-result-summary" aria-live="polite">
        <p className="discover-result-count">
          {result.items.length} recommended{' '}
          {result.items.length === 1 ? 'release' : 'releases'}
        </p>
        <p className="discover-muted">{result.message}</p>
        {result.items.length < 10 ? (
          <p className="discover-muted">
            Only verified, eligible releases are shown; Discover does not invent
            results to fill ten places.
          </p>
        ) : null}
      </div>
      <div className="discover-results">
        <section
          className="panel discover-list-panel"
          aria-label="Recommended releases"
        >
          <ul className="discover-list">
            {result.items.map((release) => (
              <li key={release.externalId}>
                <button
                  className="discover-release-row"
                  type="button"
                  aria-pressed={selected?.externalId === release.externalId}
                  onClick={() => onSelect(release.externalId)}
                >
                  <strong>{release.title}</strong>
                  <span className="discover-row-artist">
                    {release.artists.join(', ')}
                  </span>
                  <span className="discover-muted">
                    {[
                      release.year,
                      discoverDisplayValues(release.labels),
                      discoverDisplayValues(release.formats),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {result.items.length === 0 ? (
            <p className="discover-no-results">
              No eligible releases in this batch. Try another search or add more
              Overall ratings.
            </p>
          ) : null}
        </section>
        {selected ? (
          <DiscoverReleaseDetail
            release={selected}
            pending={busy}
            onAction={(kind) => onAction(selected, kind)}
          />
        ) : null}
      </div>
    </>
  )
}

function DiscoverEmptyState({
  available,
  ready,
}: Readonly<{ available: boolean; ready: boolean }>) {
  let heading = 'Explore beyond your collection'
  if (!ready) heading = 'Set up release discovery'
  if (!available) heading = 'Discover in the desktop app'
  return (
    <section
      className="panel discover-empty-state"
      aria-labelledby="discover-empty-title"
    >
      <span className="discover-empty-icon" aria-hidden="true">
        <Disc3 size={24} strokeWidth={1.5} />
      </span>
      <div>
        <h2 id="discover-empty-title">{heading}</h2>
        <p>
          Generate up to ten releases from the music you have rated. No seed
          selection is needed.
        </p>
        <DiscoverSetupMessage available={available} ready={ready} />
        <p className="discover-muted">
          Low ratings help avoid poor matches; unrated music is not treated as a
          dislike.
        </p>
      </div>
    </section>
  )
}

function DiscoverSetupMessage({
  available,
  ready,
}: Readonly<{ available: boolean; ready: boolean }>) {
  if (!available)
    return (
      <p>
        Open DiscWeave desktop to generate recommendations securely with your
        own OpenAI key.
      </p>
    )
  if (ready) return null
  return (
    <p>
      Set up OpenAI and allow metadata sharing in Recommendation settings.
      Discogs must also be configured in Settings → Integrations.
    </p>
  )
}
