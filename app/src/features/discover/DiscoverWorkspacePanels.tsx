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
  result,
  settingsOpen,
  selected,
  busy,
  onSelect,
  onAction,
}: Readonly<{
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
  if (!result) return settingsOpen ? null : <DiscoverEmptyState />
  return (
    <>
      <div aria-live="polite">
        <p>
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
        <section className="panel" aria-label="Recommended releases">
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
          {result.items.length === 0 ? (
            <p className="section-panel">
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

function DiscoverEmptyState() {
  return (
    <div className="panel section-panel">
      <h2>A new starting point for your collection</h2>
      <p>
        Generate up to ten releases from the music you have rated. No seed
        selection is needed.
      </p>
      <p className="discover-muted">
        Low ratings help avoid poor matches; unrated music is not treated as a
        dislike.
      </p>
    </div>
  )
}

export function DiscoverSetupNotice({
  available,
  ready,
  settingsOpen,
}: Readonly<{ available: boolean; ready: boolean; settingsOpen: boolean }>) {
  if (!available)
    return (
      <div className="panel section-panel">
        <p>
          Open DiscWeave desktop to generate recommendations securely with your
          own OpenAI key.
        </p>
      </div>
    )
  if (ready || settingsOpen) return null
  return (
    <div className="panel section-panel">
      <p>
        Set up OpenAI and allow metadata sharing in Recommendation settings.
        Discogs must also be configured in Settings → Integrations.
      </p>
    </div>
  )
}
