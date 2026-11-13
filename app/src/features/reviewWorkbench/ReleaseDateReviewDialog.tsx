import { useEffect, useId, useRef, useState } from 'react'
import { beforeAppNavigation } from '../../app/navigationGuard'
import { ReleaseDatePreviewPanel } from './ReleaseDatePreviewPanel'
import { ReleaseDateSearch } from './ReleaseDateSearchPanel'
import { useReleaseDateSearch } from './useReleaseDateSearch'
import {
  applyReleaseDate,
  discogsReleaseId,
  previewReleaseDate,
  type ReleaseDatePreview,
} from './releaseDateReviewApi'

export function ReleaseDateReviewDialog({
  releaseId,
  initialQuery = '',
  onClose,
  onChanged,
}: Readonly<{
  releaseId: string
  initialQuery?: string
  onClose: () => void
  onChanged?: () => void
}>) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const alive = useRef(true)
  const busyRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [applying, setApplying] = useState(false)
  const search = useReleaseDateSearch(releaseId, initialQuery)
  const [source, setSource] = useState('')
  const [preview, setPreview] = useState<ReleaseDatePreview | null>(null)
  const [error, setError] = useState('')
  const [applied, setApplied] = useState(false)
  useEffect(() => {
    alive.current = true
    if (dialog.current?.showModal) dialog.current.showModal()
    else dialog.current?.setAttribute('open', '')
    return () => {
      alive.current = false
    }
  }, [])

  useEffect(() => {
    if (!applying) return
    const block = (event: Event) => event.preventDefault()
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener(beforeAppNavigation, block)
    window.addEventListener('beforeunload', unload)
    return () => {
      window.removeEventListener(beforeAppNavigation, block)
      window.removeEventListener('beforeunload', unload)
    }
  }, [applying])

  async function run(action: () => Promise<void>) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (reason) {
      if (alive.current)
        setError(
          reason instanceof Error
            ? reason.message
            : 'The request failed. Please try again.',
        )
    } finally {
      busyRef.current = false
      if (alive.current) {
        setBusy(false)
        setApplying(false)
      }
    }
  }
  function select(id: string) {
    void run(async () => {
      setSelectedId(id)
      setPreview(null)
      const result = await previewReleaseDate(releaseId, id)
      if (alive.current) setPreview(result)
    })
  }
  useEffect(() => {
    if (dialog.current) dialog.current.scrollTop = 0
    headingRef.current?.focus({ preventScroll: true })
  }, [selectedId, busy, error, preview, applied])

  let loadingMessage = 'Searching Discogs…'
  if (selectedId) loadingMessage = `Loading Discogs edition #${selectedId}…`
  if (applying) loadingMessage = 'Applying date…'
  return (
    <dialog
      ref={dialog}
      aria-modal="true"
      aria-labelledby={heading}
      className="release-date-review"
      onCancel={(event) => {
        event.preventDefault()
        if (!busyRef.current) onClose()
      }}
    >
      <header>
        <h2 ref={headingRef} tabIndex={-1} id={heading}>
          Review release date
        </h2>
        <button
          type="button"
          className="button button-secondary"
          disabled={busy}
          onClick={onClose}
        >
          Close
        </button>
      </header>
      {busy && (
        <p>
          <output>{loadingMessage}</output>
        </p>
      )}
      {error && (
        <p role="alert">
          {error}
          {selectedId &&
            ' Preview the edition again before applying. If an apply request failed, check the current release date before retrying.'}
        </p>
      )}
      {applied ? (
        <p>
          <output>Release date updated. No other metadata was changed.</output>
        </p>
      ) : (
        <>
          <p>
            Choose the exact edition, not its master release or another
            pressing. Searching and previewing do not change your collection.
          </p>
          {selectedId && (
            <div className="release-date-step-actions">
              <button
                type="button"
                className="button button-secondary"
                disabled={busy}
                onClick={() => {
                  setSelectedId(null)
                  setPreview(null)
                  setError('')
                }}
              >
                Back to results
              </button>
              <span>Selected Discogs edition #{selectedId}</span>
              {error && (
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={busy}
                  onClick={() => select(selectedId)}
                >
                  Retry preview
                </button>
              )}
            </div>
          )}
          {!selectedId && (
            <>
              <ReleaseDateSearch
                search={search}
                busy={busy}
                onEdit={() => setPreview(null)}
                onSearch={(broad) => {
                  void run(async () => {
                    setPreview(null)
                    await search.search(broad)
                  })
                }}
                onSelect={select}
              />
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  const id = discogsReleaseId(source)
                  if (id) select(id)
                  else
                    setError(
                      'Enter a Discogs release ID or https://www.discogs.com/release/… URL.',
                    )
                }}
              >
                <label>
                  <span>Exact Discogs release ID or URL</span>
                  <input
                    value={source}
                    disabled={busy}
                    onChange={(event) => {
                      setSource(event.target.value)
                      setPreview(null)
                    }}
                  />
                </label>
                <button
                  type="submit"
                  className="button button-secondary"
                  disabled={busy || !source.trim()}
                >
                  Preview edition
                </button>
              </form>
            </>
          )}
          {preview && (
            <ReleaseDatePreviewPanel
              preview={preview}
              busy={busy}
              onApply={() => {
                const token = preview.token
                if (!token) return
                void run(async () => {
                  setApplying(true)
                  setPreview(null)
                  await applyReleaseDate(releaseId, token)
                  if (alive.current) {
                    setApplied(true)
                    onChanged?.()
                  }
                })
              }}
            />
          )}
        </>
      )}
    </dialog>
  )
}
