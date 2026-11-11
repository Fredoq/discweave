import { ArchiveUpgradeContext } from './archiveUpgradeContext'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import './archive-upgrade.css'

type UpgradeOutcome = {
  complete: boolean
  message: string
  backupDirectory: string | null
}
export function ArchiveUpgradeProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [compatibility, setCompatibility] = useState<
    'checking' | 'supported' | 'unsupported' | 'failed' | 'restartRequired'
  >(() => (window.discweaveDesktop?.archive ? 'checking' : 'supported'))
  const [compatibilityCode, setCompatibilityCode] = useState<string | null>(
    null,
  )
  const [checkVersion, setCheckVersion] = useState(0)
  useEffect(() => {
    const bridge = window.discweaveDesktop?.archive
    if (!bridge) return
    let active = true
    void bridge.getStatus().then(
      (status) => {
        if (active) {
          setCompatibilityCode(status.code)
          setCompatibility(
            status.code === 'archive.external_backend'
              ? 'supported'
              : status.code === 'archive.backend_unavailable'
                ? 'failed'
                : status.status === 'unsupported'
                  ? 'unsupported'
                  : 'supported',
          )
        }
      },
      () => {
        if (active) setCompatibility('failed')
      },
    )
    return () => {
      active = false
    }
  }, [checkVersion])
  const [running, setRunning] = useState(false)
  const [outcome, setOutcome] = useState<UpgradeOutcome | null>(null)
  const busy = useRef(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const open = running || outcome !== null

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open) {
      if (typeof element.showModal === 'function') element.showModal()
      else element.setAttribute('open', '')
    } else {
      if (typeof element.close === 'function') element.close()
      else element.removeAttribute('open')
    }
  }, [open])

  async function upgrade() {
    const bridge = window.discweaveDesktop?.archive
    if (!bridge || busy.current) return false
    busy.current = true
    setOutcome(null)
    setRunning(true)
    try {
      const result = await bridge.backupAndUpgrade()
      const complete =
        result.status === 'upgraded' || result.status === 'current'
      if (result.code === 'archive.restart_failed')
        setCompatibility('restartRequired')
      setOutcome({
        complete,
        backupDirectory: result.backupDirectory,
        message: complete
          ? result.code === 'archive.watches_paused'
            ? 'Your collection is updated. Restart DiscWeave to resume watched-folder checks. Keep the backup until you have checked the collection.'
            : result.status === 'upgraded'
              ? 'Your collection is updated. Label import links are ready.'
              : 'Your collection is already up to date.'
          : upgradeFailureMessage(result.code),
      })
      return complete
    } catch {
      setCompatibility('restartRequired')
      setOutcome({
        complete: false,
        backupDirectory: null,
        message:
          'The upgrade did not finish normally. Reopen DiscWeave to check the collection before trying again. Do not delete any upgrade backups.',
      })
      return false
    } finally {
      busy.current = false
      setRunning(false)
    }
  }

  return (
    <ArchiveUpgradeContext.Provider value={upgrade}>
      {compatibility === 'supported' ? (
        children
      ) : (
        <main className="archive-compatibility-panel">
          <h1>
            {compatibility === 'checking'
              ? 'Checking your collection'
              : compatibility === 'unsupported'
                ? compatibilityCode === 'archive.configuration_unsupported'
                  ? 'Custom archive storage needs a supported upgrade path'
                  : 'This collection needs a compatibility check'
                : compatibility === 'restartRequired'
                  ? 'Reopen DiscWeave to continue'
                  : 'Could not check collection compatibility'}
          </h1>
          <p role={compatibility === 'checking' ? 'status' : 'alert'}>
            {compatibility === 'checking'
              ? 'Checking the database before opening your archive.'
              : compatibility === 'unsupported'
                ? compatibilityCode === 'archive.configuration_unsupported'
                  ? 'Custom database, cover or integration storage is configured. Automatic maintenance is unavailable for this configuration. Keep the original storage locations and use the compatible app while an upgrade plan is checked; DiscWeave will not redirect or reset your archive.'
                  : 'This database structure is not recognized. Collection writes are blocked. Keep the original archive and use its compatible DiscWeave version while recovery is checked. No reset or automatic upgrade will be attempted.'
                : compatibility === 'restartRequired'
                  ? 'The local backend did not resume normally after maintenance. Keep any upgrade backup and reopen DiscWeave before editing or retrying the upgrade.'
                  : 'The archive status could not be verified. DiscWeave will not open it for editing until this check succeeds.'}
          </p>
          {compatibility !== 'checking' &&
          compatibility !== 'restartRequired' ? (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                setCompatibility('checking')
                setCheckVersion((value) => value + 1)
              }}
            >
              Check again
            </button>
          ) : null}
        </main>
      )}
      <dialog
        ref={dialog}
        className="archive-upgrade-dialog"
        aria-labelledby="archive-upgrade-title"
        onCancel={(event) => {
          if (running) event.preventDefault()
          else setOutcome(null)
        }}
      >
        <h2 id="archive-upgrade-title">
          {running
            ? 'Backing up and updating your collection'
            : outcome?.complete
              ? 'Collection ready'
              : 'Upgrade needs attention'}
        </h2>
        {running ? (
          <p role="status">
            Please keep DiscWeave open. Collection writes are paused while the
            backup is verified and the database is updated.
          </p>
        ) : (
          <p role={outcome?.complete ? 'status' : 'alert'}>
            {outcome?.message}
          </p>
        )}
        {outcome?.backupDirectory ? (
          <>
            <p>Recovery backup saved at:</p>
            <code>{outcome.backupDirectory}</code>
            <p>
              Keep this backup until you have checked your collection. Restoring
              it later would discard changes made after the backup.
            </p>
          </>
        ) : null}
        {!running ? (
          <button
            type="button"
            className="button button-primary"
            onClick={() => setOutcome(null)}
          >
            Done
          </button>
        ) : null}
      </dialog>
    </ArchiveUpgradeContext.Provider>
  )
}

function upgradeFailureMessage(code: string | null) {
  if (code === 'archive.configuration_unsupported')
    return 'Automatic upgrade is unavailable with custom database, cover or integration storage. Keep the original storage locations and use the supported administrator procedure.'
  if (code === 'archive.restart_failed')
    return 'DiscWeave could not restart its local backend after maintenance. The database may already be updated. Keep the backup and reopen DiscWeave before retrying.'
  if (code === 'schema.archive_busy' || code === 'archive.busy')
    return 'Another process is using this archive. Close other DiscWeave instances and try again. No upgrade was started.'
  if (code === 'schema.backup_failed')
    return 'A verified recovery backup could not be created. Check available disk space and folder access before retrying.'
  if (code === 'schema.integrity_failed')
    return 'The archive failed its integrity check. No upgrade was applied. Keep the original archive and arrange recovery before continuing.'
  if (code === 'schema.unsupported')
    return 'The database structure is not recognized. No automatic upgrade is available. Keep the original archive and use its compatible DiscWeave version.'
  return 'The collection could not be upgraded safely. Keep any backup shown below. Your existing collection has not been reset.'
}
