import { Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  createTrackRelationParserRule,
  deleteTrackRelationParserRule,
  loadTrackRelationParserRules,
  updateTrackRelationParserRule,
  type CatalogDictionaries,
  type TrackRelationParserRule,
  type TrackRelationParserRuleDirection,
  type TrackRelationParserRuleRequest,
} from '../catalog/catalogApi'
import {
  parseSortOrder,
  settingsModeNavigationItems,
  type SettingsMode,
} from './settingsModel'
import { SearchField, ViewModeSwitch } from './settingsShared'

const parserRuleModeSearchText =
  settingsModeNavigationItems
    .find((item) => item.mode === 'trackRelationParserRules')
    ?.searchTerms.join(' ') ?? ''

export function TrackRelationParserRulesSettings({
  dictionaries,
  onModeChange,
}: Readonly<{
  dictionaries: CatalogDictionaries
  onModeChange: (mode: SettingsMode) => void
}>) {
  const [rules, setRules] = useState<TrackRelationParserRule[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('Loading parser rules')
  const relationTypeNamesByCode = useMemo(
    () =>
      new Map(
        dictionaries.trackRelationType.map((entry) => [entry.code, entry.name]),
      ),
    [dictionaries],
  )
  const queryTerms = useMemo(
    () => query.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [query],
  )
  const filteredRules = useMemo(
    () =>
      rules
        .filter((rule) => {
          const searchText = parserRuleSearchText(
            rule,
            relationTypeName(rule, relationTypeNamesByCode),
          )

          return queryTerms.every((term) => searchText.includes(term))
        })
        .sort(
          (left, right) =>
            left.sortOrder - right.sortOrder ||
            relationTypeName(left, relationTypeNamesByCode).localeCompare(
              relationTypeName(right, relationTypeNamesByCode),
            ) ||
            left.alias.localeCompare(right.alias),
        ),
    [rules, queryTerms, relationTypeNamesByCode],
  )

  useEffect(() => {
    let isMounted = true

    void refreshRules()
      .then((loadedRules) => {
        if (!isMounted) {
          return
        }

        setRules(loadedRules)
        setStatus(`${loadedRules.length} parser rules loaded`)
      })
      .catch((error: unknown) => {
        console.error(error)
        if (isMounted) {
          setStatus('Failed to load parser rules')
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  async function reloadRules() {
    const loadedRules = await refreshRules()
    setRules(loadedRules)
    setStatus(`${loadedRules.length} parser rules loaded`)
  }

  async function createRule(request: TrackRelationParserRuleRequest) {
    try {
      await createTrackRelationParserRule(request)
      await reloadRules()
      setStatus('Parser rule saved')
    } catch (error) {
      console.error(error)
      setStatus('Failed to save parser rule')
    }
  }

  async function saveRule(
    ruleId: string,
    request: TrackRelationParserRuleRequest,
  ) {
    try {
      await updateTrackRelationParserRule(ruleId, request)
      await reloadRules()
      setStatus('Parser rule updated')
    } catch (error) {
      console.error(error)
      setStatus('Failed to update parser rule')
    }
  }

  async function removeRule(rule: TrackRelationParserRule) {
    try {
      await deleteTrackRelationParserRule(rule)
      await reloadRules()
      setStatus('Parser rule deleted')
    } catch (error) {
      console.error(error)
      setStatus('Failed to delete parser rule')
    }
  }

  return (
    <section
      className="catalog-layout settings-wide-layout"
      aria-label="Track relation parser rule settings"
    >
      <div className="catalog-main">
        <SearchField
          placeholder="Alias, relation type, parser, version, import or status"
          query={query}
          onQueryChange={setQuery}
        />
        <div className="settings-mode-row">
          <ViewModeSwitch
            mode="trackRelationParserRules"
            onModeChange={onModeChange}
          />
        </div>
        <TrackRelationParserRulesContextPanel
          count={filteredRules.length}
          status={status}
        />
        <TrackRelationParserRuleCreatePanel
          dictionaries={dictionaries}
          onCreateRule={createRule}
        />
        <section
          className="panel catalog-panel"
          aria-labelledby="track-relation-parser-rules-title"
        >
          <div className="panel-heading">
            <div>
              <h2 id="track-relation-parser-rules-title">
                Track relation parser rules
              </h2>
              <p>{status}</p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="catalog-table workspace-table parser-rule-table">
              <colgroup>
                <col className="parser-rule-col-alias" />
                <col className="parser-rule-col-relation-type" />
                <col className="parser-rule-col-confidence" />
                <col className="parser-rule-col-direction" />
                <col className="parser-rule-col-sort" />
                <col className="parser-rule-col-active" />
                <col className="parser-rule-col-state" />
                <col className="parser-rule-col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Alias</th>
                  <th scope="col">Relation type</th>
                  <th scope="col">Confidence</th>
                  <th scope="col">Direction</th>
                  <th scope="col">Sort</th>
                  <th scope="col">Active</th>
                  <th scope="col">State</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRules.map((rule) => (
                  <TrackRelationParserRuleRow
                    key={rule.id}
                    dictionaries={dictionaries}
                    onDeleteRule={removeRule}
                    onSaveRule={saveRule}
                    rule={rule}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  )
}

async function refreshRules() {
  const response = await loadTrackRelationParserRules()

  return response.items
}

function TrackRelationParserRulesContextPanel({
  count,
  status,
}: Readonly<{
  count: number
  status: string
}>) {
  return (
    <section
      className="panel settings-context-panel"
      aria-label="Track relation parser rule scope"
    >
      <div className="settings-context-copy">
        <span className="entity-type">Parser rules</span>
        <strong>{count} rules shown</strong>
        <p>{status}</p>
      </div>
      <div
        className="parser-rule-field-guide"
        aria-label="Parser rule field guide"
      >
        <div>
          <span>Alias</span>
          <p>Text matched in the last parenthetical title block.</p>
        </div>
        <div>
          <span>Relation type</span>
          <p>Connection suggested when the alias matches.</p>
        </div>
        <div>
          <span>Direction</span>
          <p>Which track becomes source and which becomes target.</p>
        </div>
        <div>
          <span>Confidence</span>
          <p>Score used to rank the suggestion for review.</p>
        </div>
        <div>
          <span>Sort</span>
          <p>Lower values are evaluated first.</p>
        </div>
        <div>
          <span>State</span>
          <p>Active rules run; default and custom rules can be changed.</p>
        </div>
      </div>
    </section>
  )
}

function TrackRelationParserRuleCreatePanel({
  dictionaries,
  onCreateRule,
}: Readonly<{
  dictionaries: CatalogDictionaries
  onCreateRule: (
    request: TrackRelationParserRuleRequest,
  ) => Promise<void> | void
}>) {
  const firstRelationType = dictionaries.trackRelationType.find(
    (entry) => entry.isActive,
  )
  const [alias, setAlias] = useState('')
  const [relationTypeCode, setRelationTypeCode] = useState(
    firstRelationType?.code ?? '',
  )
  const [confidence, setConfidence] = useState('90')
  const [sortOrder, setSortOrder] = useState('100')
  const [direction, setDirection] =
    useState<TrackRelationParserRuleDirection>('variantToBase')
  const canSubmit = alias.trim().length > 0 && relationTypeCode.length > 0

  function handleCreate() {
    if (!canSubmit) {
      return
    }

    void onCreateRule({
      relationTypeCode,
      alias: alias.trim(),
      matchMode: 'exactLastParentheticalToken',
      confidence: parseConfidence(confidence, 90),
      direction,
      sortOrder: parseSortOrder(sortOrder, 100),
      isActive: true,
    })
    setAlias('')
    setConfidence('90')
    setSortOrder('100')
    setDirection('variantToBase')
  }

  return (
    <section
      className="panel settings-controls settings-controls-parser-rule"
      aria-label="Add track relation parser rule"
    >
      <div className="parser-rule-create-heading">
        <div>
          <h3>Add parser rule</h3>
          <p>
            Create a rule for a version alias such as Radio Edit, Remix or
            Instrumental.
          </p>
        </div>
      </div>
      <div className="settings-control-grid parser-rule-create-grid">
        <label className="settings-control">
          <span>Alias</span>
          <input
            value={alias}
            onChange={(event) => setAlias(event.target.value)}
          />
        </label>
        <RelationTypeSelect
          dictionaries={dictionaries}
          isLabelVisible
          label="Relation type"
          value={relationTypeCode}
          onChange={setRelationTypeCode}
        />
        <label className="settings-control">
          <span>Confidence</span>
          <input
            inputMode="numeric"
            max={100}
            min={0}
            type="number"
            value={confidence}
            onChange={(event) => setConfidence(event.target.value)}
          />
        </label>
        <label className="settings-control">
          <span>Sort</span>
          <input
            inputMode="numeric"
            min={0}
            type="number"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          />
        </label>
        <DirectionSelect
          isLabelVisible
          label="Direction"
          value={direction}
          onChange={setDirection}
        />
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

function TrackRelationParserRuleRow({
  dictionaries,
  onDeleteRule,
  onSaveRule,
  rule,
}: Readonly<{
  dictionaries: CatalogDictionaries
  onDeleteRule: (rule: TrackRelationParserRule) => Promise<void> | void
  onSaveRule: (
    ruleId: string,
    request: TrackRelationParserRuleRequest,
  ) => Promise<void> | void
  rule: TrackRelationParserRule
}>) {
  const [alias, setAlias] = useState(rule.alias)
  const [relationTypeCode, setRelationTypeCode] = useState(
    rule.relationTypeCode,
  )
  const [confidence, setConfidence] = useState(String(rule.confidence))
  const [sortOrder, setSortOrder] = useState(String(rule.sortOrder))
  const [direction, setDirection] = useState<TrackRelationParserRuleDirection>(
    rule.direction,
  )
  const [isActive, setIsActive] = useState(rule.isActive)
  const canSave = alias.trim().length > 0 && relationTypeCode.length > 0
  const ruleLabel = alias.trim() || rule.alias

  function handleSave() {
    if (!canSave) {
      return
    }

    void onSaveRule(rule.id, {
      relationTypeCode,
      alias: alias.trim(),
      matchMode: rule.matchMode,
      confidence: parseConfidence(confidence, rule.confidence),
      direction,
      sortOrder: parseSortOrder(sortOrder, rule.sortOrder),
      isActive,
    })
  }

  function handleDelete() {
    if (
      globalThis.confirm(
        `Delete the track relation parser rule "${rule.alias}"? This cannot be undone.`,
      )
    ) {
      void onDeleteRule(rule)
    }
  }

  return (
    <tr>
      <th scope="row">
        <label className="settings-control parser-rule-cell-control">
          <span className="visually-hidden">Alias for {ruleLabel}</span>
          <input
            aria-label={`Alias for ${ruleLabel}`}
            value={alias}
            onChange={(event) => setAlias(event.target.value)}
          />
        </label>
      </th>
      <td data-label="Relation type">
        <RelationTypeSelect
          dictionaries={dictionaries}
          label={`Relation type for ${ruleLabel}`}
          value={relationTypeCode}
          onChange={setRelationTypeCode}
        />
      </td>
      <td data-label="Confidence">
        <label className="settings-control parser-rule-cell-control">
          <span className="visually-hidden">Confidence for {ruleLabel}</span>
          <input
            aria-label={`Confidence for ${ruleLabel}`}
            inputMode="numeric"
            max={100}
            min={0}
            type="number"
            value={confidence}
            onChange={(event) => setConfidence(event.target.value)}
          />
        </label>
      </td>
      <td data-label="Direction">
        <DirectionSelect
          label={`Direction for ${ruleLabel}`}
          value={direction}
          onChange={setDirection}
        />
      </td>
      <td data-label="Sort">
        <label className="settings-control parser-rule-cell-control">
          <span className="visually-hidden">Sort order for {ruleLabel}</span>
          <input
            aria-label={`Sort order for ${ruleLabel}`}
            inputMode="numeric"
            min={0}
            type="number"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          />
        </label>
      </td>
      <td data-label="Active">
        <label className="settings-check parser-rule-active-check">
          <span>
            <input
              aria-label={`Active ${ruleLabel}`}
              checked={isActive}
              type="checkbox"
              onChange={(event) => setIsActive(event.target.checked)}
            />
            <span>Active</span>
          </span>
        </label>
      </td>
      <td data-label="State">{ruleState(rule)}</td>
      <td data-label="Actions">
        <div className="parser-rule-actions">
          <button
            aria-label={`Save parser rule ${ruleLabel}`}
            className="button button-primary"
            disabled={!canSave}
            type="button"
            onClick={handleSave}
          >
            <Save size={16} aria-hidden="true" />
            Save
          </button>
          <button
            aria-label={`Delete parser rule ${ruleLabel}`}
            className="button button-secondary"
            type="button"
            onClick={handleDelete}
          >
            <Trash2 size={16} aria-hidden="true" />
            Delete
          </button>
        </div>
      </td>
    </tr>
  )
}

function RelationTypeSelect({
  dictionaries,
  isLabelVisible = false,
  label,
  onChange,
  value,
}: Readonly<{
  dictionaries: CatalogDictionaries
  isLabelVisible?: boolean
  label: string
  onChange: (value: string) => void
  value: string
}>) {
  return (
    <label className="settings-control parser-rule-cell-control">
      <span className={isLabelVisible ? undefined : 'visually-hidden'}>
        {label}
      </span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        <option value="">Select relation type</option>
        {dictionaries.trackRelationType
          .filter((entry) => entry.isActive)
          .map((entry) => (
            <option key={entry.code} value={entry.code}>
              {entry.name}
            </option>
          ))}
      </select>
    </label>
  )
}

function DirectionSelect({
  isLabelVisible = false,
  label,
  onChange,
  value,
}: Readonly<{
  isLabelVisible?: boolean
  label: string
  onChange: (value: TrackRelationParserRuleDirection) => void
  value: TrackRelationParserRuleDirection
}>) {
  return (
    <label className="settings-control parser-rule-cell-control">
      <span className={isLabelVisible ? undefined : 'visually-hidden'}>
        {label}
      </span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) =>
          onChange(
            event.currentTarget.value as TrackRelationParserRuleDirection,
          )
        }
      >
        <option value="variantToBase">Variant to base</option>
        <option value="baseToVariant">Base to variant</option>
      </select>
    </label>
  )
}

function relationTypeName(
  rule: TrackRelationParserRule,
  namesByCode: Map<string, string>,
) {
  return namesByCode.get(rule.relationTypeCode) ?? rule.relationTypeCode
}

function parserRuleSearchText(
  rule: TrackRelationParserRule,
  relationTypeLabel: string,
) {
  return [
    rule.alias,
    relationTypeLabel,
    rule.relationTypeCode,
    rule.matchMode,
    directionLabel(rule.direction),
    rule.isActive ? 'active' : 'inactive',
    rule.isBuiltin ? 'default builtin' : 'custom',
    parserRuleModeSearchText,
  ]
    .join(' ')
    .toLowerCase()
}

function directionLabel(direction: TrackRelationParserRuleDirection) {
  return direction === 'variantToBase' ? 'Variant to base' : 'Base to variant'
}

function ruleState(rule: TrackRelationParserRule) {
  return [
    rule.isActive ? 'Active' : 'Inactive',
    rule.isBuiltin ? 'Default' : 'Custom',
  ].join(' / ')
}

function parseConfidence(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) {
    return fallback
  }

  return Math.min(100, Math.max(0, parsed))
}
