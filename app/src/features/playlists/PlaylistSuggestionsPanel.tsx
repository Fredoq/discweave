import { useEffect, useRef, useState } from 'react'
import type {
  PlaylistSuggestionResult,
  PlaylistSuggestionStatus,
  PlaylistSuggestionsBridge,
} from './playlistSuggestionTypes'
import './playlist-suggestions.css'

type Props = {
  existingTrackIds: string[]
  onAdd: (trackIds: string[]) => number
  onClose: () => void
  disabled?: boolean
}

export function PlaylistSuggestionsPanel({
  existingTrackIds,
  onAdd,
  onClose,
  disabled = false,
}: Readonly<Props>) {
  const bridge = window.discweaveDesktop?.playlistSuggestions
  const [status, setStatus] = useState<PlaylistSuggestionStatus | null>(null)
  const [prompt, setPrompt] = useState('')
  const [consent, setConsent] = useState(false)
  const [result, setResult] = useState<PlaylistSuggestionResult | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [addMessage, setAddMessage] = useState('')
  const previewRef = useRef<HTMLElement>(null)
  const previewHeadingRef = useRef<HTMLHeadingElement>(null)
  const mounted = useRef(false)
  const sequence = useRef(0)
  const running = useRef(false)
  const active = useRef<PlaylistSuggestionsBridge | null>(null)
  const existing = new Set(existingTrackIds)
  const selectedIds =
    result?.items
      .filter(
        (item) => selected.has(item.trackId) && !existing.has(item.trackId),
      )
      .map((item) => item.trackId) ?? []

  useEffect(() => {
    mounted.current = true
    let current = true
    if (bridge) {
      void bridge
        .status()
        .then((value) => {
          if (current) setStatus(value)
        })
        .catch((reason) => {
          if (current)
            setError(errorMessage(reason, 'Could not read AI settings.'))
        })
    }
    return () => {
      current = false
      mounted.current = false
      sequence.current += 1
      const ownRequest = active.current
      active.current = null
      if (ownRequest) void ownRequest.cancel().catch(() => {})
    }
  }, [bridge])

  useEffect(() => {
    if (!result) return
    previewRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
    previewHeadingRef.current?.focus({ preventScroll: true })
  }, [result])

  async function generate() {
    if (
      !bridge ||
      !status?.configured ||
      !consent ||
      !prompt.trim() ||
      running.current ||
      disabled
    )
      return
    const request = ++sequence.current
    active.current = bridge
    running.current = true
    setPending(true)
    setError('')
    setMessage('')
    try {
      const preview = await bridge.generate({
        prompt: prompt.trim(),
        excludedTrackIds: [...new Set(existingTrackIds)],
        consented: true,
      })
      if (!mounted.current || sequence.current !== request) return
      setResult(preview)
      setSelected(new Set())
      setAddMessage('')
    } catch (reason) {
      if (mounted.current && sequence.current === request)
        setError(
          errorMessage(
            reason,
            'Could not generate suggestions. Your previous preview is still here.',
          ),
        )
    } finally {
      if (sequence.current === request) {
        active.current = null
        running.current = false
        if (mounted.current) setPending(false)
      }
    }
  }

  async function cancel() {
    const ownRequest = active.current
    if (!ownRequest) return
    active.current = null
    const request = ++sequence.current
    try {
      await ownRequest.cancel()
      if (mounted.current && sequence.current === request)
        setMessage(
          'Request cancelled. Your previous preview and selections are unchanged.',
        )
    } catch (reason) {
      if (mounted.current && sequence.current === request)
        setError(
          errorMessage(
            reason,
            'Could not confirm cancellation. The previous preview is unchanged.',
          ),
        )
    } finally {
      if (sequence.current === request) {
        running.current = false
        if (mounted.current) setPending(false)
      }
    }
  }

  function toggle(trackId: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(trackId)
      else next.delete(trackId)
      return next
    })
  }

  return (
    <section
      className="playlist-suggestions"
      aria-label="AI playlist suggestions"
    >
      <div className="playlist-heading">
        <div>
          <span className="entity-type">Playlist draft</span>
          <h3>Ask AI</h3>
        </div>
        <button
          type="button"
          className="button button-secondary"
          disabled={disabled}
          onClick={onClose}
        >
          Close AI suggestions
        </button>
      </div>
      <p>
        Describe the selection you want. DiscWeave automatically shortlists
        tracks from your collection; you review suggestions before adding
        anything.
      </p>
      {!bridge && (
        <p role="alert">AI playlist suggestions require the desktop app.</p>
      )}
      {bridge && !status && !error && (
        <p>
          <output>Checking AI settings…</output>
        </p>
      )}
      {status && !status.configured && (
        <p>
          Configure your OpenAI API key in Settings to use suggestions. Your
          request has not been sent.
        </p>
      )}
      {status?.configured && (
        <p className="playlist-suggestions-muted">
          Model: {status.model}. Uses the OpenAI key configured in Settings.
        </p>
      )}
      <fieldset disabled={pending || disabled}>
        <label className="playlist-field">
          <span>What would you like?</span>
          <textarea
            rows={3}
            maxLength={1000}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ambient tracks from the 1990s, excluding tracks already in this playlist"
          />
        </label>
        <label className="playlist-suggestions-consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
          />
          <span>
            I agree to send this request and metadata for up to 100
            automatically shortlisted tracks to OpenAI: title, artist, release,
            label, year, genres, tags, duration and Overall ratings. No audio,
            file paths or private notes are sent.
          </span>
        </label>
        <p className="playlist-suggestions-muted">
          Each generation can use up to 2 paid requests. A shared limit of 6
          requests per hour applies. Cancelling cannot undo a request already
          sent.
        </p>
        <button
          type="button"
          className="button button-primary"
          disabled={
            !bridge || !status?.configured || !consent || !prompt.trim()
          }
          onClick={() => void generate()}
        >
          Generate suggestions
        </button>
      </fieldset>
      {pending && (
        <div className="playlist-suggestions-progress">
          <output>Finding suggestions…</output>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => void cancel()}
          >
            Cancel request
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {message && (
        <p>
          <output>{message}</output>
        </p>
      )}
      {result && (
        <section
          ref={previewRef}
          aria-label="Suggestion preview"
          className="playlist-suggestions-preview"
        >
          <h4 ref={previewHeadingRef} tabIndex={-1}>
            Review suggestions
          </h4>
          <p>
            <output>
              {result.examined} tracks examined · {result.matched} matched ·{' '}
              {result.shortlisted} shortlisted
            </output>
          </p>
          <p>
            Based on catalog metadata, not audio analysis. The entire loaded
            catalog is searched locally; OpenAI sees only the ranked shortlist.
            A shortlist is not a review of every matching track. Missing or
            incomplete metadata can limit matches. These are suggestions, not
            changes to your playlist.
          </p>
          {result.interpreted.length > 0 && (
            <div>
              <h4>Interpreted request</h4>
              <ul>
                {[...new Set(result.interpreted)].map((criterion) => (
                  <li key={criterion}>{criterion}</li>
                ))}
              </ul>
            </div>
          )}
          {result.warnings.length > 0 && (
            <div className="playlist-suggestions-warnings">
              <h4>Limitations</h4>
              <ul>
                {[...new Set(result.warnings)].map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          <ul className="playlist-suggestions-results">
            {result.items.map((item) => (
              <li key={item.trackId}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.has(item.trackId)}
                    disabled={pending || disabled || existing.has(item.trackId)}
                    onChange={(event) =>
                      toggle(item.trackId, event.target.checked)
                    }
                  />
                  <span>
                    <strong>{item.title}</strong>
                    <span>
                      {item.artist} · {item.releaseTitle}
                    </span>
                    <span>{item.reason}</span>
                    {existing.has(item.trackId) && (
                      <small>Already in this playlist</small>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {!result.items.length && (
            <p>
              No suggestions matched this request. Try another description; your
              playlist is unchanged.
            </p>
          )}
          <div className="playlist-actions">
            <button
              type="button"
              className="button button-primary"
              disabled={pending || disabled || !selectedIds.length}
              onClick={() => {
                const added = onAdd([...new Set(selectedIds)])
                setSelected(new Set())
                if (added > 0) {
                  setAddMessage(
                    `${added} tracks added to the draft. Save the playlist when you are ready.`,
                  )
                } else {
                  setAddMessage(
                    'No tracks added. The selected tracks are already in this playlist or are no longer available. Your draft is unchanged.',
                  )
                }
              }}
            >
              Add selected{selectedIds.length ? ` (${selectedIds.length})` : ''}
            </button>
          </div>
          {addMessage && (
            <p>
              <output>{addMessage}</output>
            </p>
          )}
        </section>
      )}
    </section>
  )
}

function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback
}
