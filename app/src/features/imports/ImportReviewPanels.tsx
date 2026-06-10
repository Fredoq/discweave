import type {
  ReleaseImportDraft,
  ReleaseImportSession,
} from '../catalog/catalogApi'

export function ImportSourcePanel({ isDesktop }: { isDesktop: boolean }) {
  if (isDesktop) {
    return (
      <div className="imports-agent-card">
        <div>
          <span>Desktop app</span>
          <strong>Local import enabled</strong>
          <small>
            Choose a folder on this Mac and review parsed drafts here. Desktop
            import sends metadata, hashes, paths and cover artifacts, not audio
            files.
          </small>
        </div>
      </div>
    )
  }

  return (
    <div className="imports-agent-card">
      <div>
        <span>Desktop app</span>
        <strong>Local folder import is desktop-only</strong>
        <small>
          Web review remains available; local folder selection runs in the macOS
          app. Desktop import sends metadata, hashes, paths and cover artifacts,
          not audio files.
        </small>
      </div>
    </div>
  )
}

export function SessionsTable({
  sessions,
  selectedSessionId,
  onSelect,
}: {
  sessions: ReleaseImportSession[]
  selectedSessionId: string
  onSelect: (sessionId: string) => void
}) {
  return (
    <section className="panel catalog-panel">
      <div className="panel-heading">
        <div>
          <h2>Sessions</h2>
          <p>{sessions.length} saved scans</p>
        </div>
      </div>
      <div className="catalog-table-wrap">
        <table className="catalog-table imports-session-table">
          <tbody>
            {sessions.map((session) => (
              <tr
                className={
                  session.id === selectedSessionId ? 'is-selected' : undefined
                }
                key={session.id}
              >
                <td data-label="Root">
                  <button
                    aria-current={
                      session.id === selectedSessionId ? 'true' : undefined
                    }
                    className="imports-row-select-button"
                    type="button"
                    onClick={() => {
                      void onSelect(session.id)
                    }}
                  >
                    <span className="row-title">
                      <strong>{session.sourceRoot}</strong>
                    </span>
                  </button>
                </td>
                <td data-label="Drafts">{session.draftCount}</td>
                <td data-label="Tracks">{session.trackCount}</td>
                <td data-label="Ignored">{session.ignoredFileCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function DraftsTable({
  drafts,
  selectedDraftId,
  onSelect,
}: {
  drafts: ReleaseImportDraft[]
  selectedDraftId: string
  onSelect: (draftId: string) => void
}) {
  return (
    <section className="panel catalog-panel">
      <div className="panel-heading">
        <div>
          <h2>Draft releases</h2>
          <p>{drafts.length} proposed releases</p>
        </div>
      </div>
      <div className="catalog-table-wrap">
        <table className="catalog-table">
          <tbody>
            {drafts.map((draft) => (
              <tr
                className={
                  draft.id === selectedDraftId ? 'is-selected' : undefined
                }
                key={draft.id}
              >
                <td data-label="Release">
                  <button
                    aria-current={
                      draft.id === selectedDraftId ? 'true' : undefined
                    }
                    className="imports-row-select-button"
                    type="button"
                    onClick={() => onSelect(draft.id)}
                  >
                    <span className="row-title">
                      <strong>{draft.title}</strong>
                      <span>
                        {draft.artistNames.join(', ') || 'Various Artists'}
                      </span>
                    </span>
                  </button>
                </td>
                <td data-label="Status">{draft.status}</td>
                <td data-label="Tracks">{draft.tracks.length}</td>
                <td data-label="Issues">{draft.issues.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
