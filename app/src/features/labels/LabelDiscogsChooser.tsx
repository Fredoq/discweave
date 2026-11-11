import { ExternalLink, Search } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { DiscogsLabelCandidate } from './labelDiscogsApi'

export type LabelDiscogsChooserProps = Readonly<{
  candidates: DiscogsLabelCandidate[]
  searchTotal: number | null
  searched: boolean
  initialQuery: string
  selectedId: string | null
  pending: boolean
  error?: string
  onSearch: (query: string) => void
  onApply: (id: string) => Promise<boolean>
  onCancel: () => void
}>

export function LabelDiscogsChooser({
  candidates,
  searchTotal,
  searched,
  initialQuery,
  selectedId,
  pending,
  error,
  onSearch,
  onApply,
  onCancel,
}: LabelDiscogsChooserProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const mounted = useRef(false)
  const applying = useRef(false)
  const [busy, setBusy] = useState(false)
  const [applyError, setApplyError] = useState('')
  const [query, setQuery] = useState(initialQuery)
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery.trim())
  const [choice, setChoice] = useState(() =>
    candidates.some((candidate) => candidate.externalId === selectedId)
      ? (selectedId ?? '')
      : '',
  )
  const titleId = useId()
  const descriptionId = useId()
  const radioName = useId()
  const blocked = pending || busy
  const resultsMatchQuery = query.trim() === submittedQuery
  const validChoice =
    resultsMatchQuery &&
    candidates.some((candidate) => candidate.externalId === choice)

  useEffect(() => {
    mounted.current = true
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const dialog = dialogRef.current
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    }
    inputRef.current?.focus()
    return () => {
      mounted.current = false
      if (dialog?.open && typeof dialog.close === 'function') dialog.close()
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])

  async function apply() {
    if (blocked || applying.current || !validChoice) return
    applying.current = true
    setBusy(true)
    setApplyError('')
    try {
      await onApply(choice)
    } catch {
      if (mounted.current)
        setApplyError('The label could not be selected. Try again.')
    } finally {
      applying.current = false
      if (mounted.current) setBusy(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="label-discogs-chooser"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onCancel()
          return
        }
        if (event.key !== 'Tab') return
        const controls = [
          ...event.currentTarget.querySelectorAll<HTMLElement>('*'),
        ].filter((control) =>
          control.matches(
            'button:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]',
          ),
        )
        const first = controls[0]
        const last = controls.at(-1)
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }}
    >
      <header className="label-discogs-chooser__header">
        <h2 id={titleId}>Choose a Discogs label</h2>
        <p id={descriptionId}>
          Names can overlap. Check the Discogs page before choosing; this does
          not change your collection records.
        </p>
      </header>
      <div className="label-discogs-chooser__search">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (!blocked && query.trim()) {
              setChoice('')
              setSubmittedQuery(query.trim())
              setApplyError('')
              onSearch(query.trim())
            }
          }}
        >
          <label className="search-field">
            <Search className="search-icon" size={16} aria-hidden="true" />
            <span className="visually-hidden">Search Discogs labels</span>
            <input
              ref={inputRef}
              type="search"
              value={query}
              maxLength={200}
              onChange={(event) => {
                setQuery(event.target.value)
                setChoice('')
              }}
              placeholder="Search Discogs labels"
            />
          </label>
          <button
            className="button button-secondary"
            type="submit"
            disabled={blocked || !query.trim()}
          >
            Search
          </button>
        </form>
        {pending ? <output>Loading Discogs…</output> : null}
        {!pending && searched && resultsMatchQuery ? (
          <output>
            Showing {candidates.length}
            {searchTotal !== null ? ` of ${searchTotal}` : ''} label matches.
            {searchTotal !== null && searchTotal > candidates.length
              ? ' Refine the search to find another label.'
              : ''}
          </output>
        ) : null}
        {!resultsMatchQuery ? (
          <output>Search the updated name to see matching labels.</output>
        ) : null}
        {error || applyError ? (
          <p className="label-discogs-chooser__error" role="alert">
            {error || applyError}
          </p>
        ) : null}
      </div>
      <div
        className="label-discogs-chooser__results"
        role="radiogroup"
        aria-label="Discogs label matches"
      >
        {resultsMatchQuery &&
        searched &&
        candidates.length === 0 &&
        !pending ? (
          <p>No matching labels found. Try another name.</p>
        ) : null}
        {(resultsMatchQuery ? candidates : []).map((candidate) => (
          <div
            key={candidate.externalId}
            className="label-discogs-chooser__candidate"
          >
            <label className="label-discogs-chooser__candidate-choice">
              <input
                type="radio"
                name={radioName}
                value={candidate.externalId}
                aria-label={`${candidate.name} #${candidate.externalId}`}
                checked={choice === candidate.externalId}
                disabled={blocked}
                onChange={() => setChoice(candidate.externalId)}
              />
              <span className="label-discogs-chooser__candidate-text">
                <strong>{candidate.name}</strong>
                <small>#{candidate.externalId}</small>
              </span>
            </label>
            <a
              className="label-discogs-chooser__external"
              href={`https://www.discogs.com/label/${encodeURIComponent(candidate.externalId)}`}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${candidate.name} (${candidate.externalId}) on Discogs`}
            >
              <ExternalLink size={16} aria-hidden="true" />
            </a>
          </div>
        ))}
      </div>
      <footer className="label-discogs-chooser__footer">
        <button
          type="button"
          className="button button-quiet"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="button button-primary"
          disabled={blocked || !validChoice}
          onClick={() => void apply()}
        >
          Use selected label
        </button>
      </footer>
    </dialog>
  )
}
