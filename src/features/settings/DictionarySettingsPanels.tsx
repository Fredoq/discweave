import { Plus, Repeat2, Save, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type {
  CatalogDictionaries,
  DictionaryEntry,
  DictionaryEntryRequest,
  DictionaryEntryUpdateRequest,
  DictionaryKind,
} from '../catalog/catalogApi'
import {
  dictionaryKindLabels,
  dictionaryKinds,
  mediaProfiles,
  parseSortOrder,
} from './settingsModel'

export function DictionaryContextPanel({
  count,
  kind,
  onKindChange,
}: {
  count: number
  kind: DictionaryKind
  onKindChange: (kind: DictionaryKind) => void
}) {
  return (
    <section
      className="panel settings-context-panel"
      aria-label="Dictionary scope"
    >
      <div className="settings-context-copy">
        <span className="entity-type">Current dictionary</span>
        <strong>{dictionaryKindLabels[kind]}</strong>
        <p>{count} entries shown in this dictionary.</p>
      </div>
      <label className="settings-control settings-context-select">
        <span>Switch to</span>
        <select
          aria-label="Dictionary"
          value={kind}
          onChange={(event) =>
            onKindChange(event.target.value as DictionaryKind)
          }
        >
          {dictionaryKinds.map((dictionaryKind) => (
            <option key={dictionaryKind} value={dictionaryKind}>
              {dictionaryKindLabels[dictionaryKind]}
            </option>
          ))}
        </select>
      </label>
    </section>
  )
}

export function DictionaryCreatePanel({
  kind,
  onCreateEntry,
}: {
  kind: DictionaryKind
  onCreateEntry?: (entry: DictionaryEntryRequest) => void
}) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [sortOrder, setSortOrder] = useState('100')
  const [mediaProfile, setMediaProfile] = useState('other')
  const canSubmit = code.trim().length > 0 && name.trim().length > 0

  function handleSubmit() {
    if (!canSubmit) {
      return
    }

    onCreateEntry?.({
      kind,
      code: code.trim(),
      name: name.trim(),
      sortOrder: parseSortOrder(sortOrder, 100),
      isActive: true,
      mediaProfile: kind === 'mediaType' ? mediaProfile : null,
    })
    setCode('')
    setName('')
    setSortOrder('100')
  }

  return (
    <section
      className="panel settings-controls"
      aria-label="Add dictionary entry"
    >
      <div className="settings-control-grid">
        <label className="settings-control">
          <span>Code</span>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
        <label className="settings-control">
          <span>Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="settings-control">
          <span>Order</span>
          <input
            inputMode="numeric"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          />
        </label>
        {kind === 'mediaType' ? (
          <label className="settings-control">
            <span>Media profile</span>
            <select
              value={mediaProfile}
              onChange={(event) => setMediaProfile(event.target.value)}
            >
              {mediaProfiles.map((profile) => (
                <option key={profile}>{profile}</option>
              ))}
            </select>
          </label>
        ) : null}
        <button
          className="button button-primary"
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          <Plus size={16} aria-hidden="true" />
          Add
        </button>
      </div>
    </section>
  )
}

export function DictionaryTable({
  entries,
  selectedEntryId,
  onSelectEntry,
}: {
  entries: DictionaryEntry[]
  selectedEntryId: string
  onSelectEntry: (entryId: string) => void
}) {
  return (
    <section
      className="panel catalog-panel"
      aria-labelledby="settings-results-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="settings-results-title">Dictionary entries</h2>
          <p>Codes stay stable; names and availability can change.</p>
        </div>
      </div>
      <div className="table-scroll">
        <table className="catalog-table workspace-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Code</th>
              <th scope="col">Order</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                aria-selected={entry.id === selectedEntryId}
                className={
                  entry.id === selectedEntryId ? 'is-selected' : undefined
                }
              >
                <th scope="row">
                  <button
                    className="row-title"
                    type="button"
                    onClick={() => onSelectEntry(entry.id)}
                  >
                    <strong>{entry.name}</strong>
                    <span>{dictionaryKindLabels[entry.kind]}</span>
                  </button>
                </th>
                <td data-label="Code">{entry.code}</td>
                <td data-label="Order">{entry.sortOrder}</td>
                <td data-label="Status">
                  {entry.isActive ? 'Active' : 'Inactive'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function DictionaryEntryDetail({
  dictionaries,
  entry,
  onUpdateEntry,
  onDeleteEntry,
  onReplaceEntry,
}: {
  dictionaries: CatalogDictionaries
  entry: DictionaryEntry
  onUpdateEntry?: (entryId: string, entry: DictionaryEntryUpdateRequest) => void
  onDeleteEntry?: (entry: DictionaryEntry) => void
  onReplaceEntry?: (entry: DictionaryEntry, replacementCode: string) => void
}) {
  const [name, setName] = useState(entry.name)
  const [sortOrder, setSortOrder] = useState(String(entry.sortOrder))
  const [isActive, setIsActive] = useState(entry.isActive)
  const [mediaProfile, setMediaProfile] = useState(
    entry.mediaProfile ?? 'other',
  )
  const replacementEntries = useMemo(
    () =>
      dictionaries[entry.kind].filter(
        (candidate) => candidate.id !== entry.id && candidate.isActive,
      ),
    [dictionaries, entry.id, entry.kind],
  )
  const [replacementCode, setReplacementCode] = useState(
    replacementEntries[0]?.code ?? '',
  )

  function handleSave() {
    onUpdateEntry?.(entry.id, {
      name: name.trim(),
      sortOrder: parseSortOrder(sortOrder, entry.sortOrder),
      isActive,
      mediaProfile: entry.kind === 'mediaType' ? mediaProfile : null,
    })
  }

  return (
    <aside className="panel detail-panel" aria-labelledby="setting-title">
      <div className="detail-header">
        <span className="entity-type">{dictionaryKindLabels[entry.kind]}</span>
        <h2 id="setting-title">{entry.name}</h2>
        <p>{entry.code}</p>
      </div>

      <section className="detail-section" aria-label="Dictionary entry editor">
        <label className="settings-control">
          <span>Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="settings-control">
          <span>Order</span>
          <input
            inputMode="numeric"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          />
        </label>
        {entry.kind === 'mediaType' ? (
          <label className="settings-control">
            <span>Media profile</span>
            <select
              value={mediaProfile}
              onChange={(event) => setMediaProfile(event.target.value)}
            >
              {mediaProfiles.map((profile) => (
                <option key={profile}>{profile}</option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="settings-check">
          <input
            type="checkbox"
            checked={isActive}
            disabled={entry.isProtected}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          <span>Active</span>
        </label>
        <button
          className="button button-primary"
          type="button"
          onClick={handleSave}
        >
          <Save size={16} aria-hidden="true" />
          Save
        </button>
      </section>

      <section className="detail-section" aria-label="Dictionary entry removal">
        <div className="settings-danger-actions">
          <button
            className="button button-secondary"
            type="button"
            disabled={entry.isProtected}
            onClick={() => onDeleteEntry?.(entry)}
          >
            <Trash2 size={16} aria-hidden="true" />
            Delete
          </button>
          <select
            value={replacementCode}
            onChange={(event) => setReplacementCode(event.target.value)}
            disabled={entry.isProtected || replacementEntries.length === 0}
          >
            {replacementEntries.map((candidate) => (
              <option key={candidate.id} value={candidate.code}>
                {candidate.name}
              </option>
            ))}
          </select>
          <button
            className="button button-secondary"
            type="button"
            disabled={entry.isProtected || replacementCode.length === 0}
            onClick={() => onReplaceEntry?.(entry, replacementCode)}
          >
            <Repeat2 size={16} aria-hidden="true" />
            Replace
          </button>
        </div>
      </section>
    </aside>
  )
}

export function EmptyDetailPanel() {
  return (
    <aside className="panel detail-panel" aria-label="No dictionary selected">
      <div className="detail-header">
        <span className="entity-type">Settings</span>
        <h2>No entry selected</h2>
        <p>Choose a dictionary entry.</p>
      </div>
    </aside>
  )
}
