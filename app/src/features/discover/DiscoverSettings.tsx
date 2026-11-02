import { useEffect, useRef, useState } from 'react'
import type { SettingsMode } from '../settings/settingsModel'
import { ViewModeSwitch } from '../settings/settingsShared'
import { discoverBridge } from './discoverApi'
import type { DiscoverStatus } from './discoverTypes'
import './discover.css'

export function DiscoverSettings({
  onModeChange,
}: Readonly<{ onModeChange?: (mode: SettingsMode) => void }>) {
  const bridge = discoverBridge()
  const [status, setStatus] = useState<DiscoverStatus | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [consented, setConsented] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const mounted = useRef(false)
  const busy = useRef(false)

  useEffect(() => {
    mounted.current = true
    let current = true
    void bridge
      ?.status()
      .then((next) => {
        if (!current) return
        setStatus(next)
        setModel(next.model)
        setConsented(next.consented)
      })
      .catch(() => {
        if (current) setMessage('Recommendation settings could not be loaded.')
      })
    return () => {
      current = false
      mounted.current = false
    }
  }, [bridge])

  async function perform(action: 'save' | 'remove' | 'test') {
    if (!bridge || busy.current) return
    busy.current = true
    setPending(true)
    setMessage('')
    const key = apiKey
    setApiKey('')
    try {
      if (action === 'test') {
        const result = await bridge.test()
        if (mounted.current) setMessage(result.message)
      } else {
        const next =
          action === 'save'
            ? await bridge.save({ apiKey: key, model: model.trim(), consented })
            : await bridge.remove()
        if (!mounted.current) return
        setStatus(next)
        setModel(next.model)
        setConsented(next.consented)
        setMessage(
          action === 'remove'
            ? 'OpenAI key removed.'
            : 'Recommendation settings saved.',
        )
      }
    } catch {
      if (mounted.current)
        setMessage(
          'The operation could not be completed. Check your settings and try again.',
        )
    } finally {
      busy.current = false
      if (mounted.current) setPending(false)
    }
  }

  return (
    <section className="discover-settings" aria-label="Recommendation settings">
      {onModeChange ? (
        <div className="settings-mode-row">
          <ViewModeSwitch mode="recommendations" onModeChange={onModeChange} />
        </div>
      ) : null}
      <div className="panel section-panel">
        <div className="panel-heading">
          <div>
            <h2>OpenAI recommendations</h2>
            <p>Optional, metadata-only discovery using your own API key.</p>
          </div>
        </div>
        {!bridge ? (
          <p>
            Recommendation generation is available in the desktop app. No key is
            stored by this browser.
          </p>
        ) : (
          <form
            className="discover-settings-form"
            onSubmit={(event) => {
              event.preventDefault()
              void perform('save')
            }}
          >
            <p>
              Discover sends OpenAI up to 40 rated examples: artist names,
              release and track titles, Overall ratings and standout marks. It
              also sends artist and title hints for up to 20 recently shown or
              dismissed releases to avoid repeats, plus the selected release or
              track when you use Find similar. It does not send audio, local
              paths, notes, account details or feedback labels. Suggestions are
              checked against Discogs before they appear.
            </p>
            <p>
              API usage is billed by OpenAI. Requests disable response storage,
              but provider abuse-monitoring retention may still apply.
            </p>
            <label className="settings-control">
              <span>Provider</span>
              <input value="OpenAI" readOnly />
            </label>
            <label className="settings-control">
              <span>Model</span>
              <select
                value={model}
                onChange={(event) => setModel(event.target.value)}
                disabled={pending || !status}
                required
              >
                {!model ? <option value="">Loading model…</option> : null}
                <option value="gpt-6-luna">gpt-6-luna</option>
              </select>
            </label>
            <label className="settings-control">
              <span>API key</span>
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={
                  status?.configured
                    ? 'Leave blank to keep the saved key'
                    : 'Enter your OpenAI API key'
                }
                disabled={pending || !status}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label className="discover-consent">
              <input
                type="checkbox"
                checked={consented}
                onChange={(event) => setConsented(event.target.checked)}
                disabled={pending || !status}
              />
              <span>
                I allow Discover to send this metadata to OpenAI when I generate
                recommendations.
              </span>
            </label>
            {status ? (
              <>
                <output>
                  {status.configured ? 'Key configured' : 'No key configured'} ·{' '}
                  {storageLabel(status)}
                </output>
                <p className="discover-muted">
                  Up to {status.limits.requestsPerHour} requests per hour per
                  app session (shared by connection tests and generation),{' '}
                  {status.limits.maxOutputTokens} output tokens per request, and
                  a {status.limits.timeoutSeconds}-second timeout. Actual
                  charges depend on usage. Cancelled generations may still be
                  billed.
                </p>
              </>
            ) : (
              <output>Loading recommendation settings…</output>
            )}
            <div className="discover-actions">
              <button
                className="button button-primary"
                type="submit"
                disabled={
                  pending ||
                  !status ||
                  !model.trim() ||
                  (!apiKey.trim() && !status.configured)
                }
              >
                Save settings
              </button>
              <button
                className="button button-secondary"
                type="button"
                disabled={pending || !status?.configured}
                onClick={() => void perform('test')}
              >
                Test connection
              </button>
              <button
                className="button button-secondary"
                type="button"
                disabled={pending || !status?.configured}
                onClick={() => void perform('remove')}
              >
                Remove key
              </button>
            </div>
            <p className="discover-muted">
              Test connection checks model access with the saved key; it does
              not generate recommendations.
            </p>
          </form>
        )}
        {message ? <output>{message}</output> : null}
      </div>
    </section>
  )
}

function storageLabel(status: DiscoverStatus) {
  if (status.storage === 'secure')
    return 'Protected by operating-system secure storage'
  if (status.storage === 'session')
    return 'Session only — secure storage is unavailable; the key is lost when the app closes'
  return 'Secure storage is unavailable; a new key will be kept for this session only'
}
