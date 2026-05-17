import { Plus, Repeat2, Save, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  defaultCatalogDictionaries,
  createImportPattern,
  deleteImportPattern,
  loadImportPatterns,
  testImportPattern,
  updateImportPattern,
  type CatalogDictionaries,
  type DictionaryEntry,
  type DictionaryEntryRequest,
  type DictionaryEntryUpdateRequest,
  type DictionaryKind,
  type ImportPattern,
  type ImportPatternKind,
  type RatingCriterion,
  type RatingCriterionRequest,
  type RatingCriterionUpdateRequest,
  type RatingTargetType,
} from '../catalog/catalogApi'

type SettingsMode = 'dictionaries' | 'ratings' | 'importPatterns'

const dictionaryKindLabels: Record<DictionaryKind, string> = {
  releaseType: 'Release types',
  creditRole: 'Artist roles',
  genre: 'Genres',
  mediaType: 'Media types',
  artistRelationType: 'Artist relation types',
  trackRelationType: 'Track relation types',
}

const dictionaryKinds = Object.keys(dictionaryKindLabels) as DictionaryKind[]
const mediaProfiles = ['digital', 'vinyl', 'cd', 'cassette', 'other']
const ratingTargetTypes: RatingTargetType[] = [
  'artist',
  'release',
  'track',
  'label',
]
const ratingTargetTypeLabels: Record<RatingTargetType, string> = {
  artist: 'Artists',
  release: 'Releases',
  track: 'Tracks',
  label: 'Labels',
}

function parseSortOrder(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10)

  return Number.isNaN(parsed) ? fallback : parsed
}

export type SettingsWorkspaceProps = {
  dictionaries?: CatalogDictionaries
  onCreateEntry?: (entry: DictionaryEntryRequest) => void
  onUpdateEntry?: (entryId: string, entry: DictionaryEntryUpdateRequest) => void
  onDeleteEntry?: (entry: DictionaryEntry) => void
  onReplaceEntry?: (entry: DictionaryEntry, replacementCode: string) => void
  ratingCriteria?: RatingCriterion[]
  onCreateRatingCriterion?: (criterion: RatingCriterionRequest) => void
  onUpdateRatingCriterion?: (
    criterionId: string,
    criterion: RatingCriterionUpdateRequest,
  ) => void
  onDeleteRatingCriterion?: (criterion: RatingCriterion) => void
}

export function SettingsWorkspace({
  dictionaries = defaultCatalogDictionaries,
  onCreateEntry,
  onUpdateEntry,
  onDeleteEntry,
  onReplaceEntry,
  ratingCriteria = [],
  onCreateRatingCriterion,
  onUpdateRatingCriterion,
  onDeleteRatingCriterion,
}: SettingsWorkspaceProps) {
  const [mode, setMode] = useState<SettingsMode>('dictionaries')
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<DictionaryKind>('releaseType')
  const [selectedEntryId, setSelectedEntryId] = useState('')
  const queryTerms = useMemo(
    () => query.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [query],
  )
  const entries = useMemo(
    () =>
      dictionaries[kind].filter((entry) => {
        const searchText = dictionarySearchText(entry)

        return queryTerms.every((term) => searchText.includes(term))
      }),
    [dictionaries, kind, queryTerms],
  )
  const selectedEntry =
    entries.find((entry) => entry.id === selectedEntryId) ?? entries[0] ?? null

  if (mode === 'ratings') {
    return (
      <RatingCriteriaSettings
        criteria={ratingCriteria}
        onCreateRatingCriterion={onCreateRatingCriterion}
        onDeleteRatingCriterion={onDeleteRatingCriterion}
        onModeChange={setMode}
        onUpdateRatingCriterion={onUpdateRatingCriterion}
      />
    )
  }

  if (mode === 'importPatterns') {
    return <ImportPatternSettings onModeChange={setMode} />
  }

  return (
    <section className="catalog-layout" aria-label="Settings workspace">
      <div className="catalog-main">
        <SearchField
          placeholder="Dictionary entry, code, label, status or profile"
          query={query}
          onQueryChange={setQuery}
        />
        <div className="settings-mode-row">
          <ViewModeSwitch mode={mode} onModeChange={setMode} />
        </div>
        <DictionaryContextPanel
          count={entries.length}
          kind={kind}
          onKindChange={(nextKind) => {
            setKind(nextKind)
            setSelectedEntryId('')
          }}
        />

        <DictionaryCreatePanel kind={kind} onCreateEntry={onCreateEntry} />
        <DictionaryTable
          entries={entries}
          selectedEntryId={selectedEntry?.id ?? ''}
          onSelectEntry={setSelectedEntryId}
        />
      </div>

      {selectedEntry ? (
        <DictionaryEntryDetail
          key={selectedEntry.id}
          dictionaries={dictionaries}
          entry={selectedEntry}
          onDeleteEntry={onDeleteEntry}
          onReplaceEntry={onReplaceEntry}
          onUpdateEntry={onUpdateEntry}
        />
      ) : (
        <EmptyDetailPanel />
      )}
    </section>
  )
}

function SearchField({
  placeholder,
  query,
  onQueryChange,
}: {
  placeholder: string
  query: string
  onQueryChange: (query: string) => void
}) {
  return (
    <label className="search-field">
      <span className="search-icon" aria-hidden="true">
        <Search size={17} strokeWidth={2.2} />
      </span>
      <span className="visually-hidden">Search settings</span>
      <input
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}

function ViewModeSwitch({
  mode,
  onModeChange,
}: {
  mode: SettingsMode
  onModeChange: (mode: SettingsMode) => void
}) {
  return (
    <div className="settings-mode-switch" role="group" aria-label="Settings">
      <button
        aria-pressed={mode === 'dictionaries'}
        className={mode === 'dictionaries' ? 'is-selected' : undefined}
        type="button"
        onClick={() => onModeChange('dictionaries')}
      >
        Dictionaries
      </button>
      <button
        aria-pressed={mode === 'ratings'}
        className={mode === 'ratings' ? 'is-selected' : undefined}
        type="button"
        onClick={() => onModeChange('ratings')}
      >
        Rating criteria
      </button>
      <button
        aria-pressed={mode === 'importPatterns'}
        className={mode === 'importPatterns' ? 'is-selected' : undefined}
        type="button"
        onClick={() => onModeChange('importPatterns')}
      >
        Import patterns
      </button>
    </div>
  )
}

function RatingCriteriaSettings({
  criteria,
  onCreateRatingCriterion,
  onDeleteRatingCriterion,
  onModeChange,
  onUpdateRatingCriterion,
}: {
  criteria: RatingCriterion[]
  onCreateRatingCriterion?: (criterion: RatingCriterionRequest) => void
  onDeleteRatingCriterion?: (criterion: RatingCriterion) => void
  onModeChange: (mode: SettingsMode) => void
  onUpdateRatingCriterion?: (
    criterionId: string,
    criterion: RatingCriterionUpdateRequest,
  ) => void
}) {
  const [query, setQuery] = useState('')
  const [selectedCriterionId, setSelectedCriterionId] = useState('')
  const queryTerms = useMemo(
    () => query.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [query],
  )
  const sortedCriteria = useMemo(
    () =>
      criteria
        .filter((criterion) => {
          const searchText = ratingCriterionSearchText(criterion)

          return queryTerms.every((term) => searchText.includes(term))
        })
        .sort(
          (left, right) =>
            left.sortOrder - right.sortOrder ||
            left.name.localeCompare(right.name),
        ),
    [criteria, queryTerms],
  )
  const selectedCriterion =
    sortedCriteria.find((criterion) => criterion.id === selectedCriterionId) ??
    sortedCriteria[0] ??
    null

  return (
    <section className="catalog-layout" aria-label="Rating criteria settings">
      <div className="catalog-main">
        <SearchField
          placeholder="Criterion name, code, target type or status"
          query={query}
          onQueryChange={setQuery}
        />
        <div className="settings-mode-row">
          <ViewModeSwitch mode="ratings" onModeChange={onModeChange} />
        </div>
        <RatingCriteriaContextPanel count={sortedCriteria.length} />
        <RatingCriterionCreatePanel
          onCreateRatingCriterion={onCreateRatingCriterion}
        />
        <section
          className="panel catalog-panel"
          aria-labelledby="rating-criteria-title"
        >
          <div className="panel-heading">
            <div>
              <h2 id="rating-criteria-title">Rating criteria</h2>
              <p>Criteria define which catalog entities can be rated.</p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="catalog-table workspace-table">
              <thead>
                <tr>
                  <th scope="col">Criterion</th>
                  <th scope="col">Targets</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedCriteria.map((criterion) => (
                  <tr
                    aria-selected={criterion.id === selectedCriterion?.id}
                    className={
                      criterion.id === selectedCriterion?.id
                        ? 'is-selected'
                        : undefined
                    }
                    key={criterion.id}
                  >
                    <th scope="row">
                      <button
                        className="row-title"
                        type="button"
                        onClick={() => setSelectedCriterionId(criterion.id)}
                      >
                        <strong>{criterion.name}</strong>
                        <span>{criterion.code}</span>
                      </button>
                    </th>
                    <td data-label="Targets">
                      {criterion.targetTypes
                        .map(ratingTargetTypeLabel)
                        .join(', ')}
                    </td>
                    <td data-label="Status">
                      {criterion.isActive ? 'Active' : 'Inactive'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      {selectedCriterion ? (
        <RatingCriterionDetail
          criterion={selectedCriterion}
          key={selectedCriterion.id}
          onDeleteRatingCriterion={onDeleteRatingCriterion}
          onUpdateRatingCriterion={onUpdateRatingCriterion}
        />
      ) : (
        <EmptyRatingCriterionPanel />
      )}
    </section>
  )
}

function ImportPatternSettings({
  onModeChange,
}: {
  onModeChange: (mode: SettingsMode) => void
}) {
  const [patterns, setPatterns] = useState<ImportPattern[]>([])
  const [kind, setKind] = useState<ImportPatternKind>('releaseFolder')
  const [template, setTemplate] = useState(
    '[{catalogNumber}, {releaseDate}] {artist} - {title}',
  )
  const [sortOrder, setSortOrder] = useState('100')
  const [testInput, setTestInput] = useState(
    '[AA 01, 2016-07-15] Steven Julien - Fallen',
  )
  const [preview, setPreview] = useState('')
  const [status, setStatus] = useState('Ready')

  useEffect(() => {
    let isMounted = true

    void loadImportPatterns()
      .then((response) => {
        if (isMounted) {
          setPatterns(response.items)
        }
      })
      .catch((error: unknown) => {
        console.error(error)
        if (isMounted) {
          setStatus('Failed to load patterns')
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  async function loadPatterns() {
    const response = await loadImportPatterns()
    setPatterns(response.items)
  }

  async function createPattern() {
    try {
      await createImportPattern({
        kind,
        template,
        sortOrder: parseSortOrder(sortOrder, 100),
        isActive: true,
      })
      await loadPatterns()
      setStatus('Pattern saved')
    } catch (error) {
      console.error(error)
      setStatus('Failed to save pattern')
    }
  }

  async function testPattern() {
    try {
      const result = await testImportPattern(kind, template, testInput)
      setPreview(JSON.stringify(result.fields, null, 2))
      setStatus(result.matched ? 'Pattern matched' : 'No match')
    } catch (error) {
      console.error(error)
      setPreview('')
      setStatus('Test failed')
    }
  }

  async function togglePattern(pattern: ImportPattern) {
    try {
      await updateImportPattern(pattern.id, {
        kind: pattern.kind,
        template: pattern.template,
        sortOrder: pattern.sortOrder,
        isActive: !pattern.isActive,
      })
      await loadPatterns()
      setStatus('Pattern updated')
    } catch (error) {
      console.error(error)
      setStatus('Failed to update pattern')
    }
  }

  async function removePattern(patternId: string) {
    try {
      await deleteImportPattern(patternId)
      await loadPatterns()
      setStatus('Pattern deleted')
    } catch (error) {
      console.error(error)
      setStatus('Failed to delete pattern')
    }
  }

  return (
    <section className="catalog-layout" aria-label="Import pattern settings">
      <div className="catalog-main">
        <div className="settings-mode-row">
          <ViewModeSwitch mode="importPatterns" onModeChange={onModeChange} />
        </div>
        <section className="panel settings-controls">
          <div className="settings-control-grid import-pattern-grid">
            <label className="settings-control">
              <span>Kind</span>
              <select
                value={kind}
                onChange={(event) => {
                  const nextKind = event.target.value as ImportPatternKind
                  setKind(nextKind)
                  setTemplate(
                    nextKind === 'releaseFolder'
                      ? '[{catalogNumber}, {releaseDate}] {artist} - {title}'
                      : '{position} {artist} - {title}',
                  )
                }}
              >
                <option value="releaseFolder">Release folder</option>
                <option value="trackFile">Track file</option>
              </select>
            </label>
            <label className="settings-control">
              <span>Template</span>
              <input
                value={template}
                onChange={(event) => setTemplate(event.target.value)}
              />
            </label>
            <label className="settings-control">
              <span>Sort</span>
              <input
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
              />
            </label>
            <button
              className="button button-primary"
              type="button"
              onClick={() => {
                void createPattern()
              }}
            >
              <Plus size={16} /> Add
            </button>
          </div>
          <div className="settings-control-grid import-pattern-test-grid">
            <label className="settings-control">
              <span>Test input</span>
              <input
                value={testInput}
                onChange={(event) => setTestInput(event.target.value)}
              />
            </label>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => {
                void testPattern()
              }}
            >
              Test
            </button>
          </div>
        </section>
        <section className="panel catalog-panel">
          <div className="panel-heading">
            <div>
              <h2>Import patterns</h2>
              <p>{status}</p>
            </div>
          </div>
          <div className="catalog-table-wrap">
            <table className="catalog-table">
              <thead>
                <tr>
                  <th scope="col">Kind</th>
                  <th scope="col">Template</th>
                  <th scope="col">Sort</th>
                  <th scope="col">State</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {patterns.map((pattern) => (
                  <tr key={pattern.id}>
                    <td data-label="Kind">{pattern.kind}</td>
                    <td data-label="Template">{pattern.template}</td>
                    <td data-label="Sort">{pattern.sortOrder}</td>
                    <td data-label="State">
                      {pattern.isActive ? 'Active' : 'Paused'}
                    </td>
                    <td data-label="Actions">
                      <button
                        className="button button-secondary button-compact"
                        disabled={pattern.isBuiltin}
                        type="button"
                        onClick={() => {
                          void togglePattern(pattern)
                        }}
                      >
                        {pattern.isActive ? 'Pause' : 'Activate'}
                      </button>
                      <button
                        className="button button-danger button-compact"
                        disabled={pattern.isBuiltin}
                        type="button"
                        onClick={() => {
                          void removePattern(pattern.id)
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <section className="panel detail-panel">
        <div className="detail-header">
          <h2>Preview</h2>
          <p>{preview || 'No preview yet'}</p>
        </div>
      </section>
    </section>
  )
}

function DictionaryContextPanel({
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

function RatingCriteriaContextPanel({ count }: { count: number }) {
  return (
    <section
      className="panel settings-context-panel"
      aria-label="Rating criteria scope"
    >
      <div className="settings-context-copy">
        <span className="entity-type">Rating criteria</span>
        <strong>Criteria editor</strong>
        <p>{count} criteria shown for this collection.</p>
      </div>
    </section>
  )
}

function RatingCriterionCreatePanel({
  onCreateRatingCriterion,
}: {
  onCreateRatingCriterion?: (criterion: RatingCriterionRequest) => void
}) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [sortOrder, setSortOrder] = useState('100')
  const [targetTypes, setTargetTypes] = useState<RatingTargetType[]>(['track'])
  const canSubmit = code.trim().length > 0 && name.trim().length > 0

  function handleSubmit() {
    if (!canSubmit) {
      return
    }

    onCreateRatingCriterion?.({
      code: code.trim(),
      name: name.trim(),
      targetTypes,
      sortOrder: parseSortOrder(sortOrder, 100),
      isActive: true,
    })
    setCode('')
    setName('')
    setSortOrder('100')
    setTargetTypes(['track'])
  }

  return (
    <section
      className="panel settings-controls settings-controls-rating"
      aria-label="Add rating criterion"
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
        <RatingTargetCheckboxes
          targetTypes={targetTypes}
          onTargetTypesChange={setTargetTypes}
        />
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

function RatingCriterionDetail({
  criterion,
  onDeleteRatingCriterion,
  onUpdateRatingCriterion,
}: {
  criterion: RatingCriterion
  onDeleteRatingCriterion?: (criterion: RatingCriterion) => void
  onUpdateRatingCriterion?: (
    criterionId: string,
    criterion: RatingCriterionUpdateRequest,
  ) => void
}) {
  const [name, setName] = useState(criterion.name)
  const [sortOrder, setSortOrder] = useState(String(criterion.sortOrder))
  const [isActive, setIsActive] = useState(criterion.isActive)
  const [targetTypes, setTargetTypes] = useState<RatingTargetType[]>(
    criterion.targetTypes,
  )
  const canSave = name.trim().length > 0

  function handleSave() {
    const trimmedName = name.trim()
    if (trimmedName.length === 0) {
      return
    }

    onUpdateRatingCriterion?.(criterion.id, {
      name: trimmedName,
      targetTypes,
      sortOrder: parseSortOrder(sortOrder, criterion.sortOrder),
      isActive,
    })
  }

  return (
    <aside
      className="panel detail-panel"
      aria-labelledby="rating-criterion-title"
    >
      <div className="detail-header">
        <span className="entity-type">
          {criterion.isBuiltin ? 'Built-in criterion' : 'Custom criterion'}
        </span>
        <h2 id="rating-criterion-title">{criterion.name}</h2>
        <p>{criterion.code}</p>
      </div>

      <section className="detail-section" aria-label="Rating criterion editor">
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
        <RatingTargetCheckboxes
          disabled={criterion.isProtected}
          targetTypes={targetTypes}
          onTargetTypesChange={setTargetTypes}
        />
        <label className="settings-check">
          <input
            type="checkbox"
            checked={isActive}
            disabled={criterion.isProtected}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          <span>Active</span>
        </label>
        <div className="rating-criterion-preview">
          <span>Preview</span>
          <strong>{name || criterion.name}</strong>
          <p>{targetTypes.map(ratingTargetTypeLabel).join(', ')}</p>
        </div>
        <button
          className="button button-primary"
          type="button"
          disabled={!canSave}
          onClick={handleSave}
        >
          <Save size={16} aria-hidden="true" />
          Save
        </button>
      </section>

      <section className="detail-section" aria-label="Rating criterion removal">
        <button
          className="button button-secondary"
          type="button"
          disabled={criterion.isProtected}
          onClick={() => onDeleteRatingCriterion?.(criterion)}
        >
          <Trash2 size={16} aria-hidden="true" />
          Delete
        </button>
      </section>
    </aside>
  )
}

function RatingTargetCheckboxes({
  disabled = false,
  targetTypes,
  onTargetTypesChange,
}: {
  disabled?: boolean
  targetTypes: RatingTargetType[]
  onTargetTypesChange: (targetTypes: RatingTargetType[]) => void
}) {
  function toggleTarget(targetType: RatingTargetType, checked: boolean) {
    const nextTargetTypes = checked
      ? [...targetTypes, targetType]
      : targetTypes.filter((item) => item !== targetType)

    if (nextTargetTypes.length > 0) {
      onTargetTypesChange(nextTargetTypes)
    }
  }

  return (
    <fieldset className="rating-target-checkboxes" disabled={disabled}>
      <legend>Targets</legend>
      {ratingTargetTypes.map((targetType) => (
        <label key={targetType}>
          <input
            checked={targetTypes.includes(targetType)}
            type="checkbox"
            onChange={(event) => toggleTarget(targetType, event.target.checked)}
          />
          <span>{ratingTargetTypeLabel(targetType)}</span>
        </label>
      ))}
    </fieldset>
  )
}

function DictionaryCreatePanel({
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

function DictionaryTable({
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

function DictionaryEntryDetail({
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

function EmptyDetailPanel() {
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

function EmptyRatingCriterionPanel() {
  return (
    <aside
      className="panel detail-panel"
      aria-label="No rating criterion selected"
    >
      <div className="detail-header">
        <span className="entity-type">Rating criteria</span>
        <h2>No criterion selected</h2>
        <p>Choose a rating criterion.</p>
      </div>
    </aside>
  )
}

function dictionarySearchText(entry: DictionaryEntry) {
  return [
    entry.name,
    entry.code,
    dictionaryKindLabels[entry.kind],
    entry.isActive ? 'active' : 'inactive',
    entry.isBuiltin ? 'builtin' : 'custom',
    entry.mediaProfile ?? '',
  ]
    .join(' ')
    .toLowerCase()
}

function ratingCriterionSearchText(criterion: RatingCriterion) {
  return [
    criterion.name,
    criterion.code,
    criterion.isActive ? 'active' : 'inactive',
    criterion.isBuiltin ? 'builtin' : 'custom',
    criterion.isProtected ? 'protected' : '',
    ...criterion.targetTypes.map(ratingTargetTypeLabel),
  ]
    .join(' ')
    .toLowerCase()
}

function ratingTargetTypeLabel(targetType: RatingTargetType) {
  return ratingTargetTypeLabels[targetType]
}
