import { useEffect, useState } from 'react'
import { useArchiveUpgrade } from './archiveUpgradeContext'

export function ArchiveUpgradeNotice({
  onReady,
  unsupported = false,
}: Readonly<{ onReady: () => void; unsupported?: boolean }>) {
  const upgrade = useArchiveUpgrade()
  const [canUpgrade, setCanUpgrade] = useState(false)
  const [alreadyCurrent, setAlreadyCurrent] = useState(false)
  const [checking, setChecking] = useState(() =>
    Boolean(window.discweaveDesktop?.archive),
  )
  const [unavailable, setUnavailable] = useState(unsupported)
  const [busy, setBusy] = useState(false)
  const [deferred, setDeferred] = useState(false)
  const [error, setError] = useState('')
  const [customStorage, setCustomStorage] = useState(false)

  useEffect(() => {
    let active = true
    const bridge = window.discweaveDesktop?.archive
    if (!bridge) return
    void bridge.getStatus().then(
      (status) => {
        if (!active) return
        setCanUpgrade(status.canUpgrade && status.status === 'upgradeRequired')
        setUnavailable(
          status.status === 'unsupported' &&
            status.code !== 'archive.external_backend',
        )
        setAlreadyCurrent(status.status === 'current')
        setCustomStorage(status.code === 'archive.configuration_unsupported')
        setChecking(false)
      },
      () => {
        if (!active) return
        setError(
          'Could not check upgrade readiness. Reopen DiscWeave before updating.',
        )
        setChecking(false)
      },
    )
    return () => {
      active = false
    }
  }, [])

  async function handleUpgrade() {
    if (!upgrade || busy) return
    setBusy(true)
    const complete = await upgrade()
    setBusy(false)
    if (complete) onReady()
  }

  return (
    <section className="archive-upgrade-notice" aria-label="Collection upgrade">
      <h3>
        {unavailable
          ? 'This collection needs a compatibility check'
          : 'Update your collection to link imports'}
      </h3>
      <p>
        {unavailable
          ? 'This database structure is not recognized. No automatic upgrade is available. Keep the original archive and use its compatible DiscWeave version while recovery is checked.'
          : 'Label import links need a database update. Your existing catalog and import workflows remain available if you postpone it.'}
      </p>
      {error ? <p role="alert">{error}</p> : null}
      {checking ? <p role="status">Checking upgrade readiness…</p> : null}
      {alreadyCurrent ? (
        <button
          type="button"
          className="button button-secondary"
          onClick={onReady}
        >
          Reload updated collection
        </button>
      ) : !unavailable && canUpgrade && upgrade ? (
        <>
          <p>
            Save pending edits first. DiscWeave will pause collection writes,
            create and verify a recovery backup, then update the database. Your
            audio files will not be changed.
          </p>
          <div className="detail-actions">
            <button
              type="button"
              className="button button-primary"
              disabled={busy}
              onClick={() => void handleUpgrade()}
            >
              Back up and upgrade
            </button>
            <button
              type="button"
              className="button button-secondary"
              disabled={busy}
              onClick={() => setDeferred(true)}
            >
              Not now
            </button>
          </div>
        </>
      ) : !checking && !unavailable && !error ? (
        <p>
          {customStorage
            ? 'Automatic upgrade is unavailable with custom storage. Your existing workflows remain available; ask the administrator to prepare an archive-preserving upgrade for these storage locations.'
            : 'Open the packaged desktop app to back up and upgrade, or ask the server administrator to use the supported archive upgrade procedure.'}
        </p>
      ) : null}
      {deferred ? (
        <p role="status">
          Upgrade postponed. You can continue using Releases and Imports; return
          here when ready.
        </p>
      ) : null}
    </section>
  )
}
