import { ArchiveUpgradeNotice } from '../archive/ArchiveUpgradeNotice'
import { CatalogApiError } from '../catalog/api/httpClient'
import { useEffect, useRef, useState } from 'react'
import {
  linkLabelImport,
  loadLabelImports,
  unlinkLabelImport,
  type LabelImportSession,
} from './labelImportsApi'

const hasPending = (session: LabelImportSession) =>
  session.pendingDraftCount > 0 || session.pendingLooseFileCount > 0

export function LabelImportsSection({
  labelId,
}: Readonly<{ labelId: string }>) {
  const [sessions, setSessions] = useState<LabelImportSession[]>([])
  const [available, setAvailable] = useState<LabelImportSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [upgradeRequired, setUpgradeRequired] = useState(false)
  const [unsupported, setUnsupported] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const [selection, setSelection] = useState('')
  const [busy, setBusy] = useState(false)
  const [reload, setReload] = useState(0)
  const generation = useRef(0)

  useEffect(() => {
    const current = ++generation.current
    void loadLabelImports(labelId).then(
      (response) => {
        if (current !== generation.current) return
        setSessions(response.items)
        setLoading(false)
      },
      (failure: unknown) => {
        if (current !== generation.current) return
        if (
          failure instanceof CatalogApiError &&
          ['schema.upgrade_required', 'schema.unsupported'].includes(
            failure.code ?? '',
          )
        ) {
          setUpgradeRequired(true)
          setUnsupported(failure.code === 'schema.unsupported')
          setLoading(false)
          return
        }
        setError('Could not load linked imports. Try again.')
        setLoading(false)
      },
    )
    return () => {
      generation.current = current + 1
    }
  }, [labelId, reload])

  async function chooseImport() {
    const current = generation.current
    setBusy(true)
    setError('')
    try {
      const response = await loadLabelImports(labelId, false)
      if (current !== generation.current) return
      setAvailable(response.items)
      setSelection('')
      setChoosing(true)
    } catch {
      if (current === generation.current)
        setError('Could not load available imports. Try again.')
    } finally {
      if (current === generation.current) setBusy(false)
    }
  }

  async function updateLink(sessionId: string, link: boolean) {
    if (busy) return
    const current = generation.current
    setBusy(true)
    setError('')
    try {
      if (link) await linkLabelImport(labelId, sessionId)
      else await unlinkLabelImport(labelId, sessionId)
      if (current !== generation.current) return
      setChoosing(false)
      setSelection('')
      setLoading(true)
      setReload((value) => value + 1)
    } catch {
      if (current === generation.current)
        setError(
          'Could not update the link. Your import was not deleted; refresh before retrying.',
        )
    } finally {
      if (current === generation.current) setBusy(false)
    }
  }

  if (upgradeRequired)
    return (
      <ArchiveUpgradeNotice
        unsupported={unsupported}
        onReady={() => {
          setUpgradeRequired(false)
          setLoading(true)
          setError('')
          setReload((value) => value + 1)
        }}
      />
    )

  const visible = sessions.filter(
    (session) => showAll || (!session.archivedAt && hasPending(session)),
  )
  const hidden = sessions.length - visible.length

  return (
    <section
      className="detail-section label-imports"
      aria-labelledby="label-imports-title"
    >
      <div className="panel-heading">
        <h3 id="label-imports-title">Imports</h3>
        <button
          type="button"
          className="button button-secondary"
          disabled={busy || loading}
          onClick={() => void chooseImport()}
        >
          Link import
        </button>
      </div>
      <p className="label-collection-note">
        Link a scanned folder to keep reviewing it here. Linking does not assign
        this label to releases or scan any files.
      </p>
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setError('')
              setLoading(true)
              setReload((value) => value + 1)
            }}
          >
            Refresh
          </button>
        </div>
      ) : null}
      {loading ? <p role="status">Loading imports…</p> : null}
      {choosing ? (
        <div className="label-import-picker">
          <label>
            Existing folder import
            <select
              value={selection}
              disabled={busy}
              onChange={(event) => setSelection(event.target.value)}
            >
              <option value="">Choose an import</option>
              {available.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.sourceRoot} ·{' '}
                  {new Date(session.createdAt).toLocaleString()}
                  {session.archivedAt ? ' · Archived' : ''}
                </option>
              ))}
            </select>
          </label>
          {available.length === 0 ? (
            <p>No unlinked folder imports. Scan a folder in Imports first.</p>
          ) : null}
          <div className="detail-actions">
            <button
              className="button button-primary"
              type="button"
              disabled={!selection || busy}
              onClick={() => void updateLink(selection, true)}
            >
              Link selected import
            </button>
            <button
              className="button button-secondary"
              type="button"
              disabled={busy}
              onClick={() => {
                setChoosing(false)
                setSelection('')
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {!loading && sessions.length > 0 ? (
        <label className="label-import-history">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(event) => setShowAll(event.target.checked)}
          />
          Show completed and archived imports
          {hidden > 0 ? ` (${hidden} hidden)` : ''}
        </label>
      ) : null}
      {!loading && visible.length === 0 ? (
        <p>
          {sessions.length
            ? 'No pending materials in active linked imports.'
            : 'No linked imports yet.'}
        </p>
      ) : null}
      <ul className="label-release-list">
        {visible.map((session) => (
          <li key={session.id}>
            <strong>{session.sourceRoot}</strong>
            <span className="label-collection-note">
              {new Date(session.createdAt).toLocaleString()}
              {session.archivedAt ? ' · Archived' : ''}
            </span>
            <span>
              {session.pendingDraftCount} pending releases ·{' '}
              {session.pendingLooseFileCount} pending loose files
            </span>
            <span className="label-collection-note">
              {session.confirmedDraftCount} confirmed ·{' '}
              {session.skippedDraftCount} skipped releases
            </span>
            <div className="detail-actions">
              <a
                className="button button-secondary"
                href={`/imports?session=${encodeURIComponent(session.id)}${hasPending(session) && !session.archivedAt ? '&resume=pending' : ''}`}
              >
                {hasPending(session) && !session.archivedAt
                  ? 'Continue import'
                  : 'Open import'}
              </a>
              <button
                className="button button-secondary"
                type="button"
                disabled={busy}
                onClick={() => void updateLink(session.id, false)}
              >
                Unlink
              </button>
            </div>
          </li>
        ))}
      </ul>
      {sessions.length > 0 ? (
        <p className="label-collection-note">
          Counts cover these scanned imports, not the label’s full catalog.
          Unlinking keeps the import and its releases.
        </p>
      ) : null}
    </section>
  )
}
