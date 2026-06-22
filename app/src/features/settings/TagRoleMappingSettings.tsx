import { Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  createTagRoleMapping,
  deleteTagRoleMapping,
  loadTagRoleMappings,
  updateTagRoleMapping,
  type CatalogDictionaries,
  type TagRoleMapping,
  type TagRoleMappingRequest,
} from '../catalog/catalogApi'
import {
  parseSortOrder,
  isStandardTagRoleMappingField,
  standardTagRoleMappingFields,
  tagRoleMappingCompatibilityNote,
  tagRoleMappingCompatibilityText,
  tagRoleMappingFieldLabel,
  tagRoleMappingSearchText,
  type SettingsMode,
} from './settingsModel'
import { SearchField, ViewModeSwitch } from './settingsShared'

export function TagRoleMappingSettings({
  dictionaries,
  onModeChange,
}: {
  dictionaries: CatalogDictionaries
  onModeChange: (mode: SettingsMode) => void
}) {
  const [mappings, setMappings] = useState<TagRoleMapping[]>([])
  const [query, setQuery] = useState('')
  const [selectedMappingId, setSelectedMappingId] = useState('')
  const [status, setStatus] = useState('Loading tag mappings')
  const roleLabelsByCode = useMemo(
    () =>
      new Map(dictionaries.creditRole.map((entry) => [entry.code, entry.name])),
    [dictionaries],
  )
  const queryTerms = useMemo(
    () => query.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [query],
  )
  const filteredMappings = useMemo(
    () =>
      mappings
        .filter((mapping) => {
          const searchText = tagRoleMappingSearchText(
            mapping,
            roleName(mapping, roleLabelsByCode),
          )

          return queryTerms.every((term) => searchText.includes(term))
        })
        .sort(
          (left, right) =>
            left.sortOrder - right.sortOrder ||
            roleName(left, roleLabelsByCode).localeCompare(
              roleName(right, roleLabelsByCode),
            ),
        ),
    [mappings, queryTerms, roleLabelsByCode],
  )
  const selectedMapping =
    filteredMappings.find((mapping) => mapping.id === selectedMappingId) ??
    filteredMappings[0] ??
    null

  useEffect(() => {
    let isMounted = true

    void reloadMappings()
      .then((loadedMappings) => {
        if (!isMounted) {
          return
        }

        setMappings(loadedMappings)
        setStatus(`${loadedMappings.length} mappings loaded`)
      })
      .catch((error: unknown) => {
        console.error(error)
        if (isMounted) {
          setStatus('Failed to load tag mappings')
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  async function refreshMappings(nextSelectedId?: string) {
    const loadedMappings = await reloadMappings()
    setMappings(loadedMappings)
    if (nextSelectedId !== undefined) {
      setSelectedMappingId(nextSelectedId)
    }
    setStatus(`${loadedMappings.length} mappings loaded`)
  }

  async function createMapping(request: TagRoleMappingRequest) {
    try {
      const mapping = await createTagRoleMapping(request)
      await refreshMappings(mapping?.id ?? '')
      setStatus('Tag mapping saved')
    } catch (error) {
      console.error(error)
      setStatus('Failed to save tag mapping')
    }
  }

  async function saveMapping(
    mappingId: string,
    request: TagRoleMappingRequest,
  ) {
    try {
      await updateTagRoleMapping(mappingId, request)
      await refreshMappings(mappingId)
      setStatus('Tag mapping updated')
    } catch (error) {
      console.error(error)
      setStatus('Failed to update tag mapping')
    }
  }

  async function removeMapping(mapping: TagRoleMapping) {
    try {
      await deleteTagRoleMapping(mapping)
      await refreshMappings('')
      setStatus('Tag mapping deleted')
    } catch (error) {
      console.error(error)
      setStatus('Failed to delete tag mapping')
    }
  }

  return (
    <section className="catalog-layout" aria-label="Tag mapping settings">
      <div className="catalog-main">
        <SearchField
          placeholder="Artist role, tag field, status or mapping"
          query={query}
          onQueryChange={setQuery}
        />
        <div className="settings-mode-row">
          <ViewModeSwitch mode="tagRoleMappings" onModeChange={onModeChange} />
        </div>
        <TagRoleMappingContextPanel
          count={filteredMappings.length}
          status={status}
        />
        <TagRoleMappingCreatePanel
          dictionaries={dictionaries}
          onCreateMapping={createMapping}
        />
        <section
          className="panel catalog-panel"
          aria-labelledby="tag-role-mappings-title"
        >
          <div className="panel-heading">
            <div>
              <h2 id="tag-role-mappings-title">Tag mapping rules</h2>
              <p>{status}</p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="catalog-table workspace-table">
              <thead>
                <tr>
                  <th scope="col">Artist role</th>
                  <th scope="col">Tag field</th>
                  <th scope="col">Compatibility</th>
                  <th scope="col">State</th>
                </tr>
              </thead>
              <tbody>
                {filteredMappings.map((mapping) => (
                  <tr
                    aria-selected={mapping.id === selectedMapping?.id}
                    className={
                      mapping.id === selectedMapping?.id
                        ? 'is-selected'
                        : undefined
                    }
                    key={mapping.id}
                  >
                    <th scope="row">
                      <button
                        className="row-title"
                        type="button"
                        onClick={() => setSelectedMappingId(mapping.id)}
                      >
                        <strong>{roleName(mapping, roleLabelsByCode)}</strong>
                        <span>{mapping.creditRoleCode}</span>
                      </button>
                    </th>
                    <td data-label="Tag field">
                      {tagRoleMappingFieldLabel(mapping.tagField)}
                    </td>
                    <td data-label="Compatibility">
                      {tagRoleMappingCompatibilityText(mapping.tagField)}
                    </td>
                    <td data-label="State">{mappingState(mapping)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      {selectedMapping ? (
        <TagRoleMappingDetail
          key={selectedMapping.id}
          dictionaries={dictionaries}
          mapping={selectedMapping}
          onDeleteMapping={removeMapping}
          onSaveMapping={saveMapping}
        />
      ) : (
        <EmptyTagRoleMappingPanel />
      )}
    </section>
  )
}

async function reloadMappings() {
  const response = await loadTagRoleMappings()

  return response.items
}

function TagRoleMappingContextPanel({
  count,
  status,
}: {
  count: number
  status: string
}) {
  return (
    <section
      className="panel settings-context-panel"
      aria-label="Tag mapping scope"
    >
      <div className="settings-context-copy">
        <span className="entity-type">Tag mappings</span>
        <strong>{count} mappings shown</strong>
        <p>{status}</p>
      </div>
      <p className="settings-context-note">
        Maps DiscWeave artist credit roles to embedded audio tag fields.
      </p>
    </section>
  )
}

function TagRoleMappingCreatePanel({
  dictionaries,
  onCreateMapping,
}: {
  dictionaries: CatalogDictionaries
  onCreateMapping: (request: TagRoleMappingRequest) => Promise<void> | void
}) {
  const firstRole = dictionaries.creditRole.find(
    (entry) => entry.isActive && entry.code !== 'mainArtist',
  )
  const [creditRoleCode, setCreditRoleCode] = useState(firstRole?.code ?? '')
  const [tagField, setTagField] = useState('producer')
  const [sortOrder, setSortOrder] = useState('100')
  const canSubmit = creditRoleCode.length > 0 && isValidTagField(tagField)

  function handleCreate() {
    if (!canSubmit) {
      return
    }

    void onCreateMapping({
      creditRoleCode,
      tagField,
      sortOrder: parseSortOrder(sortOrder, 100),
      isActive: true,
    })
  }

  return (
    <section
      className="panel settings-controls settings-controls-tag-mapping"
      aria-label="Add tag mapping"
    >
      <div className="settings-control-grid tag-mapping-create-grid">
        <RoleSelect
          dictionaries={dictionaries}
          label="Artist role"
          value={creditRoleCode}
          onChange={setCreditRoleCode}
        />
        <TagFieldEditor value={tagField} onChange={setTagField} />
        <label className="settings-control">
          <span>Order</span>
          <input
            inputMode="numeric"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          />
        </label>
        <button
          className="button button-primary"
          disabled={!canSubmit}
          type="button"
          onClick={handleCreate}
        >
          <Plus size={16} aria-hidden="true" />
          Add
        </button>
      </div>
    </section>
  )
}

function TagRoleMappingDetail({
  dictionaries,
  mapping,
  onDeleteMapping,
  onSaveMapping,
}: {
  dictionaries: CatalogDictionaries
  mapping: TagRoleMapping
  onDeleteMapping: (mapping: TagRoleMapping) => Promise<void> | void
  onSaveMapping: (
    mappingId: string,
    request: TagRoleMappingRequest,
  ) => Promise<void> | void
}) {
  const [creditRoleCode, setCreditRoleCode] = useState(mapping.creditRoleCode)
  const [tagField, setTagField] = useState(mapping.tagField)
  const [sortOrder, setSortOrder] = useState(String(mapping.sortOrder))
  const [isActive, setIsActive] = useState(mapping.isActive)
  const canSave = creditRoleCode.length > 0 && isValidTagField(tagField)

  function handleSave() {
    if (!canSave) {
      return
    }

    void onSaveMapping(mapping.id, {
      creditRoleCode,
      tagField,
      sortOrder: parseSortOrder(sortOrder, mapping.sortOrder),
      isActive,
    })
  }

  return (
    <aside className="panel detail-panel" aria-labelledby="tag-mapping-title">
      <div className="detail-header">
        <p className="entity-type">
          {mapping.isBuiltin ? 'Built-in' : 'Custom'}
        </p>
        <h2 id="tag-mapping-title">
          {roleName(
            mapping,
            new Map(
              dictionaries.creditRole.map((entry) => [entry.code, entry.name]),
            ),
          )}
        </h2>
        <p>
          {mapping.creditRoleCode} to {mapping.tagField}
        </p>
      </div>
      <section className="detail-section" aria-label="Tag mapping editor">
        <RoleSelect
          dictionaries={dictionaries}
          label="Artist role"
          value={creditRoleCode}
          onChange={setCreditRoleCode}
        />
        <TagFieldEditor value={tagField} onChange={setTagField} />
        <label className="settings-control">
          <span>Order</span>
          <input
            inputMode="numeric"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          />
        </label>
        <label className="settings-check">
          <input
            checked={isActive}
            type="checkbox"
            onChange={(event) => setIsActive(event.target.checked)}
          />
          Active
        </label>
        <div className="copy-card tag-mapping-note">
          <span>Compatibility</span>
          <p>{tagRoleMappingCompatibilityNote(tagField)}</p>
        </div>
        <button
          className="button button-primary"
          disabled={!canSave}
          type="button"
          onClick={handleSave}
        >
          <Save size={16} aria-hidden="true" />
          Save
        </button>
      </section>
      <section className="detail-section" aria-label="Tag mapping removal">
        <button
          className="button button-secondary"
          disabled={mapping.isBuiltin}
          type="button"
          onClick={() => {
            void onDeleteMapping(mapping)
          }}
        >
          <Trash2 size={16} aria-hidden="true" />
          Delete
        </button>
      </section>
    </aside>
  )
}

function RoleSelect({
  dictionaries,
  label,
  onChange,
  value,
}: {
  dictionaries: CatalogDictionaries
  label: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <label className="settings-control">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        <option value="">Select role</option>
        {dictionaries.creditRole
          .filter((entry) => entry.isActive && entry.code !== 'mainArtist')
          .map((entry) => (
            <option key={entry.code} value={entry.code}>
              {entry.name}
            </option>
          ))}
      </select>
    </label>
  )
}

function TagFieldEditor({
  onChange,
  value,
}: {
  onChange: (value: string) => void
  value: string
}) {
  const [mode, setMode] = useState<'standard' | 'custom'>(
    isStandardTagRoleMappingField(value) ? 'standard' : 'custom',
  )
  const standardValue = isStandardTagRoleMappingField(value)
    ? value
    : standardTagRoleMappingFields[0].value
  const customValue = isStandardTagRoleMappingField(value) ? '' : value

  return (
    <div className="settings-control tag-field-editor">
      <span>Tag field</span>
      <div
        className="tag-field-mode-switch"
        role="group"
        aria-label="Tag field mode"
      >
        <button
          className={mode === 'standard' ? 'is-selected' : undefined}
          type="button"
          onClick={() => {
            setMode('standard')
            onChange(standardValue)
          }}
        >
          Standard field
        </button>
        <button
          className={mode === 'custom' ? 'is-selected' : undefined}
          type="button"
          onClick={() => {
            setMode('custom')
            onChange(customValue)
          }}
        >
          Custom field
        </button>
      </div>
      {mode === 'standard' ? (
        <select
          aria-label="Standard tag field"
          value={standardValue}
          onChange={(event) => onChange(event.currentTarget.value)}
        >
          {standardTagRoleMappingFields.map((tagField) => (
            <option key={tagField.value} value={tagField.value}>
              {tagField.label}
            </option>
          ))}
        </select>
      ) : (
        <>
          <input
            aria-label="Custom tag field"
            placeholder="DJMIXER"
            value={customValue}
            onChange={(event) => onChange(event.currentTarget.value)}
          />
          <small>
            Use the exact embedded tag key. Custom fields are best-effort across
            formats.
          </small>
        </>
      )}
    </div>
  )
}

function EmptyTagRoleMappingPanel() {
  return (
    <aside className="panel detail-panel" aria-label="Tag mapping detail">
      <div className="detail-header">
        <h2>No mapping selected</h2>
        <p>Create or select a tag mapping.</p>
      </div>
    </aside>
  )
}

function roleName(mapping: TagRoleMapping, labelsByCode: Map<string, string>) {
  return labelsByCode.get(mapping.creditRoleCode) ?? mapping.creditRoleCode
}

function mappingState(mapping: TagRoleMapping) {
  return [
    mapping.isActive ? 'Active' : 'Inactive',
    mapping.isBuiltin ? 'Built-in' : 'Custom',
  ].join(' / ')
}

function isValidTagField(tagField: string) {
  return /^[A-Za-z0-9_.:-]{1,64}$/.test(tagField)
}
