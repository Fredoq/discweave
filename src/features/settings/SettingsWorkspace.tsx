import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  buildSettingRecords,
  initialSettingsState,
  type SettingRecord,
  type SettingsState,
} from './settingsData'

export function SettingsWorkspace() {
  const [query, setQuery] = useState('')
  const [selectedSettingId, setSelectedSettingId] = useState('collection-name')
  const settings = initialSettingsState

  const settingRecords = useMemo(
    () => buildSettingRecords(settings),
    [settings],
  )
  const visibleSettings = useMemo(
    () => filterSettings(settingRecords, query),
    [query, settingRecords],
  )

  function handleQueryChange(nextQuery: string) {
    const nextVisibleSettings = filterSettings(settingRecords, nextQuery)

    setQuery(nextQuery)
    setSelectedSettingId((currentSettingId) =>
      nextVisibleSettings.some((setting) => setting.id === currentSettingId)
        ? currentSettingId
        : (nextVisibleSettings[0]?.id ?? ''),
    )
  }

  const selectedSetting =
    visibleSettings.find((setting) => setting.id === selectedSettingId) ??
    visibleSettings[0] ??
    null

  return (
    <section className="catalog-layout" aria-label="Settings workspace">
      <div className="catalog-main">
        <SearchField
          label="Search settings"
          placeholder="Setting, category, value, policy, media, status, format or access"
          query={query}
          onQueryChange={handleQueryChange}
        />
        <div className="filter-bar">
          <span className="result-count">{visibleSettings.length} shown</span>
        </div>

        <SettingsApiNotice />

        <SettingsTable
          settingRecords={visibleSettings}
          selectedSettingId={selectedSetting?.id ?? ''}
          onSelectSetting={setSelectedSettingId}
        />
      </div>

      {selectedSetting ? (
        <SettingsDetail setting={selectedSetting} settings={settings} />
      ) : (
        <EmptyDetailPanel />
      )}
    </section>
  )
}

function queryTerms(query: string) {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean)
}

function filterSettings(settingRecords: SettingRecord[], query: string) {
  const terms = queryTerms(query)

  return settingRecords.filter((setting) =>
    terms.every((term) => settingSearchText(setting).includes(term)),
  )
}

function settingSearchText(setting: SettingRecord) {
  return [
    setting.name,
    setting.category,
    setting.currentValue,
    setting.policyText,
    ...setting.searchTerms,
  ]
    .join(' ')
    .toLowerCase()
}

type SearchFieldProps = {
  label: string
  placeholder: string
  query: string
  onQueryChange: (query: string) => void
}

function SearchField({
  label,
  placeholder,
  query,
  onQueryChange,
}: SearchFieldProps) {
  return (
    <label className="search-field">
      <span className="search-icon" aria-hidden="true">
        <Search size={17} strokeWidth={2.2} />
      </span>
      <span className="visually-hidden">{label}</span>
      <input
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}

function SettingsApiNotice() {
  return (
    <section
      className="panel settings-controls"
      aria-labelledby="settings-controls-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="settings-controls-title">Collection settings pending</h2>
          <p>
            This workspace shows current product defaults and access rules.
            Editable collection settings will be wired when the settings
            contract exists.
          </p>
        </div>
      </div>

      <div className="settings-control-grid">
        <div className="settings-control">
          <span>Catalog source</span>
          <strong>Local collection</strong>
        </div>
        <div className="settings-control">
          <span>Collection routing</span>
          <strong>Resolved from signed-in local account</strong>
        </div>
        <div className="settings-control">
          <span>Dangerous actions</span>
          <strong>No UI action available</strong>
        </div>
      </div>
    </section>
  )
}

type SettingsTableProps = {
  settingRecords: SettingRecord[]
  selectedSettingId: string
  onSelectSetting: (settingId: string) => void
}

function SettingsTable({
  settingRecords,
  selectedSettingId,
  onSelectSetting,
}: SettingsTableProps) {
  return (
    <section
      className="panel catalog-panel"
      aria-labelledby="settings-results-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="settings-results-title">Configuration map</h2>
          <p>Archive defaults, privacy assumptions and gated actions.</p>
        </div>
      </div>

      <div className="table-scroll">
        <table className="catalog-table workspace-table">
          <thead>
            <tr>
              <th scope="col">Setting</th>
              <th scope="col">Category</th>
              <th scope="col">Current value</th>
              <th scope="col">Policy</th>
            </tr>
          </thead>
          <tbody>
            {settingRecords.map((setting) => (
              <tr
                key={setting.id}
                aria-selected={setting.id === selectedSettingId}
                className={
                  setting.id === selectedSettingId ? 'is-selected' : undefined
                }
              >
                <th scope="row">
                  <button
                    className="row-title"
                    type="button"
                    onClick={() => onSelectSetting(setting.id)}
                  >
                    <strong>{setting.name}</strong>
                    <span>{setting.category}</span>
                  </button>
                </th>
                <td data-label="Category">{setting.category}</td>
                <td data-label="Current value">{setting.currentValue}</td>
                <td data-label="Policy">{setting.policyText}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

type SettingsDetailProps = {
  setting: SettingRecord
  settings: SettingsState
}

function SettingsDetail({ setting, settings }: SettingsDetailProps) {
  return (
    <aside className="panel detail-panel" aria-labelledby="setting-title">
      <div className="detail-header">
        <span className="entity-type">{setting.category}</span>
        <h2 id="setting-title">{setting.name}</h2>
        <p>{setting.currentValue}</p>
      </div>

      <p className="detail-summary">{setting.policyText}</p>

      <section className="detail-section" aria-labelledby="collection-identity">
        <h3 id="collection-identity">Collection identity</h3>
        <dl className="detail-list">
          <div>
            <dt>Default collection name</dt>
            <dd>{settings.collectionName}</dd>
          </div>
          <div>
            <dt>Owner / local account</dt>
            <dd>{settings.ownerLabel}</dd>
          </div>
        </dl>
      </section>

      <section className="detail-section" aria-labelledby="metadata-defaults">
        <h3 id="metadata-defaults">Metadata defaults</h3>
        <dl className="detail-list">
          <div>
            <dt>Default media type</dt>
            <dd>{settings.defaultMediaType}</dd>
          </div>
          <div>
            <dt>Default ownership status</dt>
            <dd>{settings.defaultOwnershipStatus}</dd>
          </div>
          <div>
            <dt>File metadata policy</dt>
            <dd>{settings.metadataPolicy}</dd>
          </div>
        </dl>
      </section>

      <section
        className="detail-section"
        aria-labelledby="import-export-preferences"
      >
        <h3 id="import-export-preferences">Import and export preferences</h3>
        <dl className="detail-list">
          <div>
            <dt>Preferred export formats</dt>
            <dd>
              <BadgeList values={settings.exportFormats} />
            </dd>
          </div>
          <div>
            <dt>Import policy</dt>
            <dd>Local folder imports must be idempotent.</dd>
          </div>
        </dl>
      </section>

      <section className="detail-section" aria-labelledby="privacy-access">
        <h3 id="privacy-access">Privacy and access</h3>
        <dl className="detail-list">
          <div>
            <dt>Privacy mode</dt>
            <dd>
              {settings.privateCollection
                ? 'Private collection'
                : 'Public mode is not available'}
            </dd>
          </div>
          <div>
            <dt>Access rule</dt>
            <dd>
              Use the signed-in local account to resolve the active collection.
            </dd>
          </div>
          <div>
            <dt>Isolation reminder</dt>
            <dd>
              Normal catalog routes avoid collection ids and should not leak
              another collection.
            </dd>
          </div>
        </dl>
      </section>

      <section className="detail-section" aria-labelledby="dangerous-actions">
        <h3 id="dangerous-actions">Dangerous actions</h3>
        <p>
          Destructive collection actions require a backend contract and are not
          available in this workspace.
        </p>
      </section>
    </aside>
  )
}

type BadgeListProps = {
  values: string[]
}

function BadgeList({ values }: BadgeListProps) {
  return (
    <span className="badge-list">
      {values.map((value) => (
        <span key={value} className="badge badge-tag">
          {value}
        </span>
      ))}
    </span>
  )
}

function EmptyDetailPanel() {
  return (
    <aside
      className="panel detail-panel empty-detail-panel"
      aria-labelledby="empty-settings-detail-title"
      aria-live="polite"
    >
      <div className="detail-header">
        <span className="entity-type">No selection</span>
        <h2 id="empty-settings-detail-title">No matching settings.</h2>
      </div>

      <p className="detail-summary">
        Try another setting name, category, value, policy, media, status, export
        format or access term.
      </p>
    </aside>
  )
}
