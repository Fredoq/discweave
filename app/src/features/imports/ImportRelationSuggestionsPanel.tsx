import { useEffect, useMemo, useState } from 'react'
import type {
  DictionaryEntry,
  ImportRelationSuggestion,
  ImportRelationSuggestionDecision,
  ImportRelationSuggestionEndpoint,
  ImportRelationSuggestionPayload,
} from '../catalog/catalogApi'

type ImportRelationSuggestionsPanelProps = {
  pendingSuggestionId?: string | null
  suggestions: ImportRelationSuggestion[]
  relationTypeOptions: DictionaryEntry[]
  onUpdate: (
    suggestionId: string,
    decision: ImportRelationSuggestionDecision,
    reviewed: ImportRelationSuggestionPayload,
  ) => Promise<void>
}

export function ImportRelationSuggestionsPanel({
  pendingSuggestionId,
  suggestions,
  relationTypeOptions,
  onUpdate,
}: ImportRelationSuggestionsPanelProps) {
  return (
    <section className="panel imports-relation-suggestions-panel">
      <div className="panel-heading">
        <div>
          <h2>Relation suggestions</h2>
          <p>{suggestions.length} parser matches</p>
        </div>
      </div>
      {suggestions.length > 0 ? (
        <div className="catalog-table-wrap">
          <table className="catalog-table imports-relation-suggestions-table">
            <thead>
              <tr>
                <th scope="col">Candidate</th>
                <th scope="col">Relation type</th>
                <th scope="col">Target</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map((suggestion) => (
                <ImportRelationSuggestionRow
                  key={suggestion.id}
                  isPending={pendingSuggestionId === suggestion.id}
                  relationTypeOptions={relationTypeOptions}
                  suggestion={suggestion}
                  onUpdate={onUpdate}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="imports-relation-suggestions-empty">
          No relation suggestions for this session.
        </p>
      )}
    </section>
  )
}

function ImportRelationSuggestionRow({
  isPending,
  suggestion,
  relationTypeOptions,
  onUpdate,
}: {
  isPending: boolean
  suggestion: ImportRelationSuggestion
  relationTypeOptions: DictionaryEntry[]
  onUpdate: (
    suggestionId: string,
    decision: ImportRelationSuggestionDecision,
    reviewed: ImportRelationSuggestionPayload,
  ) => Promise<void>
}) {
  const [reviewed, setReviewed] = useState(suggestion.reviewed)
  const targetOptions = useMemo(
    () => uniqueEndpoints([reviewed.target, ...suggestion.targetOptions]),
    [reviewed.target, suggestion.targetOptions],
  )
  const relationTypeCode = reviewed.relationTypeCode ?? ''
  const targetKey = reviewed.target ? endpointKey(reviewed.target) : ''
  const hasRelationTypeOption = relationTypeOptions.some(
    (option) => option.code === relationTypeCode,
  )
  const canAccept = Boolean(relationTypeCode && reviewed.target && !isPending)
  const actionLabel = `${suggestion.token} ${endpointLabel(reviewed.source)}`

  useEffect(() => {
    setReviewed(suggestion.reviewed)
  }, [suggestion.id, suggestion.reviewed])

  function handleRelationTypeChange(relationType: string) {
    setReviewed((current) => ({
      ...current,
      relationTypeCode: relationType || null,
    }))
  }

  function handleTargetChange(target: string) {
    setReviewed((current) => ({
      ...current,
      target:
        targetOptions.find((option) => endpointKey(option) === target) ?? null,
    }))
  }

  return (
    <tr>
      <td data-label="Candidate">
        <span className="imports-relation-candidate">
          <strong>{suggestion.token}</strong>
          <span>{endpointLabel(reviewed.source)}</span>
        </span>
      </td>
      <td data-label="Relation type">
        <select
          aria-label={`Relation type for ${suggestion.token}`}
          className="imports-relation-select"
          disabled={isPending}
          value={relationTypeCode}
          onChange={(event) => {
            handleRelationTypeChange(event.target.value)
          }}
        >
          <option value="">Select type</option>
          {hasRelationTypeOption || !relationTypeCode ? null : (
            <option value={relationTypeCode}>{relationTypeCode}</option>
          )}
          {relationTypeOptions.map((option) => (
            <option key={option.id} value={option.code}>
              {option.name}
            </option>
          ))}
        </select>
      </td>
      <td data-label="Target">
        <select
          aria-label={`Target for ${suggestion.token}`}
          className="imports-relation-select"
          disabled={isPending}
          value={targetKey}
          onChange={(event) => {
            handleTargetChange(event.target.value)
          }}
        >
          <option value="">Select target</option>
          {targetOptions.map((option) => (
            <option key={endpointKey(option)} value={endpointKey(option)}>
              {endpointLabel(option)}
            </option>
          ))}
        </select>
      </td>
      <td data-label="Status">
        <span className="imports-relation-status">
          {suggestion.decision}
          {suggestion.isModified ? ' - modified' : ''}
        </span>
      </td>
      <td data-label="Actions">
        <div className="imports-relation-actions">
          <button
            aria-label={`Accept relation suggestion ${actionLabel}`}
            className="button button-primary button-compact"
            disabled={!canAccept}
            type="button"
            onClick={() => {
              void onUpdate(suggestion.id, 'accepted', reviewed)
            }}
          >
            Accept
          </button>
          <button
            aria-label={`Reject relation suggestion ${actionLabel}`}
            className="button button-secondary button-compact"
            disabled={isPending}
            type="button"
            onClick={() => {
              void onUpdate(suggestion.id, 'rejected', reviewed)
            }}
          >
            Reject
          </button>
        </div>
      </td>
    </tr>
  )
}

function uniqueEndpoints(
  endpoints: Array<ImportRelationSuggestionEndpoint | null | undefined>,
) {
  const seen = new Set<string>()
  const unique: ImportRelationSuggestionEndpoint[] = []

  for (const endpoint of endpoints) {
    if (!endpoint) {
      continue
    }

    const key = endpointKey(endpoint)
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    unique.push(endpoint)
  }

  return unique
}

function endpointKey(endpoint: ImportRelationSuggestionEndpoint) {
  return `${endpoint.kind}:${endpoint.id}`
}

function endpointLabel(endpoint: ImportRelationSuggestionEndpoint) {
  if (endpoint.title) {
    return endpoint.title
  }

  const kind =
    endpoint.kind === 'draftTrack' ? 'Draft track' : 'Existing track'
  return `${kind} ${endpoint.id.slice(0, 8)}`
}
