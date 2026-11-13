import { useEffect, useId, useRef, useState } from 'react'
import { beforeAppNavigation } from '../../app/navigationGuard'
import {
  searchDiscogsReleases,
  type ExternalMetadataReleaseCandidateDto,
} from '../catalog/api/externalMetadataClient'
import {
  applyReleaseDate,
  dateEvidenceLabel,
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
  const alive = useRef(true)
  const busyRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [applying, setApplying] = useState(false)
  const [query, setQuery] = useState(initialQuery)
  const [source, setSource] = useState('')
  const [candidates, setCandidates] = useState<
    ExternalMetadataReleaseCandidateDto[] | null
  >(null)
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
      event.returnValue = ''
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
      setPreview(null)
      const result = await previewReleaseDate(releaseId, id)
      if (alive.current) setPreview(result)
    })
  }
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
        <h2 id={heading}>Review release date</h2>
        <button
          type="button"
          className="button button-secondary"
          disabled={busy}
          onClick={onClose}
        >
          Close
        </button>
      </header>
      {applied ? (
        <p role="status">
          Release date updated. No other metadata was changed.
        </p>
      ) : (
        <>
          <p>
            Choose the exact edition, not its master release or another
            pressing. Searching and previewing do not change your collection.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void run(async () => {
                setPreview(null)
                setCandidates(null)
                const result = await searchDiscogsReleases({ query, limit: 25 })
                if (alive.current) setCandidates(result.items)
              })
            }}
          >
            <label>
              Search Discogs
              <input
                value={query}
                disabled={busy}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setPreview(null)
                }}
                placeholder="Artist, release title or catalog number"
              />
            </label>
            <button
              className="button button-secondary"
              disabled={busy || !query.trim()}
            >
              Search
            </button>
          </form>
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
              Exact Discogs release ID or URL
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
              className="button button-secondary"
              disabled={busy || !source.trim()}
            >
              Preview edition
            </button>
          </form>
          {candidates && (
            <section aria-label="Discogs editions">
              <p>
                Search results are limited. A missing result does not mean the
                edition is absent. Refine your search or enter its release ID.
              </p>
              {candidates.length === 0 && (
                <p>No editions found in these results.</p>
              )}
              <ul>
                {candidates.map((candidate) => (
                  <li key={candidate.source.externalId}>
                    <div>
                      <strong>{candidate.title}</strong>
                      <span>
                        {[
                          candidate.artists.join(', '),
                          candidate.catalogNumber,
                          candidate.labels.join(', '),
                          candidate.formats.join(', '),
                          candidate.year,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="button button-secondary button-compact"
                      disabled={busy}
                      onClick={() => select(candidate.source.externalId)}
                    >
                      Preview #{candidate.source.externalId}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {preview && (
            <section
              className="release-date-preview"
              aria-label="Date change preview"
            >
              <h3>Compare editions</h3>
              <p>
                <strong>Your release: {preview.currentTitle}</strong>
                <br />
                {[
                  preview.currentArtists.join(', '),
                  preview.currentCatalogNumbers.join(', '),
                  preview.currentLabels.join(', '),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <h4>Discogs: {preview.title}</h4>
              <p>
                {[
                  preview.artists.join(', '),
                  preview.catalogNumber,
                  preview.labels.join(', '),
                  preview.formats.join(', '),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <a
                href={preview.source.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Discogs edition #{preview.source.externalId}
              </a>
              <p>{preview.source.attribution}</p>
              <dl>
                <dt>Current date</dt>
                <dd>
                  {preview.currentDate || preview.currentYear || 'Not recorded'}
                </dd>
                <dt>Source date</dt>
                <dd>{dateEvidenceLabel(preview.date)}</dd>
              </dl>
              {preview.date?.kind === 'fullDate' && preview.token ? (
                <>
                  <p>
                    Confirm this is your edition. Only the release date and its
                    year will change.
                  </p>
                  <button
                    type="button"
                    className="button button-primary"
                    disabled={busy}
                    onClick={() => {
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
                  >
                    Apply date
                  </button>
                </>
              ) : (
                <p>
                  A complete date is not available for applying. Keep the
                  existing precision; no day or month will be invented.
                </p>
              )}
            </section>
          )}
        </>
      )}
      {busy && <p role="status">{applying ? 'Applying date…' : 'Loading…'}</p>}
      {error && (
        <p role="alert">
          {error} Preview the edition again before applying. If an apply request
          failed, check the current release date before retrying.
        </p>
      )}
    </dialog>
  )
}
