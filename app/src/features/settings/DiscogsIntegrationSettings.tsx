import { Save, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  loadDiscogsIntegrationStatus,
  removeDiscogsAccessToken,
  saveDiscogsAccessToken,
  type DiscogsIntegrationStatus,
} from '../catalog/catalogApi'
import type { SettingsMode } from './settingsModel'
import { ViewModeSwitch } from './settingsShared'

const fallbackStatus: DiscogsIntegrationStatus = {
  providerName: 'discogs',
  enabled: true,
  configured: false,
}

export function DiscogsIntegrationSettings({
  initialStatus,
  onModeChange,
  onStatusChange,
}: {
  initialStatus?: DiscogsIntegrationStatus
  onModeChange: (mode: SettingsMode) => void
  onStatusChange?: (status: DiscogsIntegrationStatus) => void
}) {
  const [integration, setIntegration] =
    useState<DiscogsIntegrationStatus>(initialStatus ?? fallbackStatus)
  const [accessToken, setAccessToken] = useState('')
  const [status, setStatus] = useState('Loading Discogs settings')
  const canSave = accessToken.trim().length > 0
  const hasToken = integration.configured
  const isAvailable = integration.enabled && hasToken

  useEffect(() => {
    let isMounted = true

    void loadDiscogsIntegrationStatus()
      .then((loadedStatus) => {
        if (!isMounted) {
          return
        }

        const nextStatus = loadedStatus ?? fallbackStatus
        setIntegration(nextStatus)
        onStatusChange?.(nextStatus)
        setStatus(statusMessage(nextStatus))
      })
      .catch((error: unknown) => {
        console.error(error)
        if (isMounted) {
          setStatus('Failed to load Discogs settings')
        }
      })

    return () => {
      isMounted = false
    }
  }, [onStatusChange])

  async function saveToken() {
    if (!canSave) {
      return
    }

    try {
      const nextStatus = await saveDiscogsAccessToken(accessToken)
      const normalizedStatus = nextStatus ?? fallbackStatus
      setIntegration(normalizedStatus)
      onStatusChange?.(normalizedStatus)
      setAccessToken('')
      setStatus('Discogs token saved')
    } catch (error) {
      console.error(error)
      setStatus('Failed to save Discogs token')
    }
  }

  async function removeToken() {
    try {
      const nextStatus = await removeDiscogsAccessToken()
      const normalizedStatus = nextStatus ?? fallbackStatus
      setIntegration(normalizedStatus)
      onStatusChange?.(normalizedStatus)
      setAccessToken('')
      setStatus('Discogs token removed')
    } catch (error) {
      console.error(error)
      setStatus('Failed to remove Discogs token')
    }
  }

  return (
    <section
      className="catalog-layout"
      aria-label="Discogs integration settings"
    >
      <div className="catalog-main">
        <div className="settings-mode-row">
          <ViewModeSwitch mode="integrations" onModeChange={onModeChange} />
        </div>
        <section
          className="panel settings-context-panel"
          aria-label="Integration scope"
        >
          <div className="settings-context-copy">
            <span className="entity-type">Integrations</span>
            <strong>
              {hasToken ? 'Discogs configured' : 'Discogs not configured'}
            </strong>
            <p>External metadata lookup stays optional and local to this device.</p>
          </div>
          <p className="settings-context-note">{status}</p>
        </section>
        <section className="panel settings-controls">
          <div className="settings-control-grid discogs-integration-grid">
            <label className="settings-control">
              <span>Discogs personal access token</span>
              <input
                aria-label="Discogs personal access token"
                autoComplete="off"
                type="password"
                value={accessToken}
                onChange={(event) => setAccessToken(event.target.value)}
              />
            </label>
            <button
              className="button button-primary"
              type="button"
              disabled={!canSave}
              onClick={() => {
                void saveToken()
              }}
            >
              <Save size={16} aria-hidden="true" />
              Save token
            </button>
            <button
              className="button button-secondary"
              type="button"
              disabled={!hasToken}
              onClick={() => {
                void removeToken()
              }}
            >
              <Trash2 size={16} aria-hidden="true" />
              Remove token
            </button>
          </div>
          <p className="settings-integration-note">
            The token is stored locally on this device and is never exported.
          </p>
        </section>
        <section
          className="panel catalog-panel"
          aria-labelledby="discogs-lookup-title"
        >
          <div className="panel-heading">
            <div>
              <h2 id="discogs-lookup-title">Discogs lookup</h2>
              <p>Availability of automated metadata enrichment features.</p>
            </div>
          </div>
          <dl className="integration-status-list">
            <div>
              <dt>
                <strong>Release, artist and track lookup</strong>
                <span>Discovery</span>
              </dt>
              <dd>{lookupStateLabel(integration)}</dd>
            </div>
            <div>
              <dt>
                <strong>Attribution and source links</strong>
                <span>Data provenance</span>
              </dt>
              <dd>Applied when Discogs fields are accepted.</dd>
            </div>
          </dl>
        </section>
      </div>
      <aside
        className="panel detail-panel"
        aria-labelledby="discogs-integration-detail-title"
      >
        <div className="detail-header">
          <span className="entity-type">Discogs</span>
          <h2 id="discogs-integration-detail-title">Personal access token</h2>
          <p>{hasToken ? 'Configured locally' : 'Not configured'}</p>
        </div>
        <section className="detail-section">
          <p className="detail-summary">
            Discogs lookup uses your own token for metadata search. The token is
            stored locally and is not part of collection export.
          </p>
          <div>
            <button
              className="button button-secondary"
              disabled={!isAvailable}
              type="button"
            >
              Update via Discogs
            </button>
            {!isAvailable ? (
              <p className="discogs-disabled-note">
                Add a Discogs token in Settings to use Discogs lookup.
              </p>
            ) : null}
          </div>
        </section>
      </aside>
    </section>
  )
}

function statusMessage(status: DiscogsIntegrationStatus) {
  if (!status.enabled) {
    return status.configured
      ? 'Discogs token is saved, but integration is disabled.'
      : 'Discogs integration is disabled.'
  }

  return status.configured
    ? 'Discogs token is configured.'
    : 'Discogs token is required for lookup.'
}

function lookupStateLabel(status: DiscogsIntegrationStatus) {
  if (!status.enabled) {
    return status.configured
      ? 'Unavailable because integration is disabled.'
      : 'Unavailable until integration is enabled.'
  }

  return status.configured ? 'Available' : 'Unavailable until token is saved.'
}
