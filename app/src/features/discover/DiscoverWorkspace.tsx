import { useState } from 'react'
import { discoverBridge } from './discoverApi'
import { DiscoverToolbar, DiscoverContent } from './DiscoverWorkspacePanels'
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
      <DiscoverToolbar
        mode={mode}
        onModeChange={setMode}
        pending={discover.pending}
        hasResults={Boolean(discover.result)}
        ready={ready}
        busy={busy}
        settingsOpen={settingsOpen}
        onGenerate={() => void discover.generate(mode)}
        onCancel={() => void discover.cancel()}
        onSettingsToggle={() => {
          setSettingsOpen(!settingsOpen)
          if (settingsOpen) setSettingsRevision((revision) => revision + 1)
        }}
      />
      {settingsOpen ? <DiscoverSettings /> : null}
      {releaseId || trackId ? (
        <p>
          Using the selected {releaseId ? 'release' : 'track'} as additional
          context. Results are always releases.{' '}
          <a href="/discover">Use my whole collection only</a>
        </p>
      ) : null}
      <p className="discover-muted discover-guidance">
        Your Overall ratings and standout marks guide the search. Owned, Wanted,
        dismissed and recently shown releases are excluded. Different recordings
        and remixes remain distinct candidates.
      </p>
      {discover.error ? <p role="alert">{discover.error}</p> : null}
      {discover.notice ? <output>{discover.notice}</output> : null}
      <DiscoverContent
        available={Boolean(discoverBridge())}
        ready={ready}
        result={discover.result}
        settingsOpen={settingsOpen}
        selected={selected}
        busy={busy}
        onSelect={setSelectedId}
        onAction={(release, kind) => void discover.act(release, kind)}
      />
    </section>
  )
}
