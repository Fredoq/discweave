import { useState } from 'react'
import type { ReleaseImportLabel } from '../catalog/catalogApi'
import { ImportEntitySuggestionRow } from './ImportEntitySuggestions'
import { useImportEntitySuggestions } from './importEntitySuggestionHooks'

export function ImportLabelsEditor({
  catalogNumberSeed,
  labels,
  notOnLabel,
  onChange,
}: {
  catalogNumberSeed?: string | null
  labels: ReleaseImportLabel[]
  notOnLabel: boolean
  onChange: (labels: ReleaseImportLabel[]) => void
}) {
  const [draftLabel, setDraftLabel] = useState('')
  const [draftLabelId, setDraftLabelId] = useState('')
  const [draftCatalogNumber, setDraftCatalogNumber] = useState(
    () => catalogNumberSeed?.trim() ?? '',
  )
  const [draftHasNoCatalogNumber, setDraftHasNoCatalogNumber] = useState(false)
  const suggestions = useImportEntitySuggestions(draftLabel, 'label')

  function addLabel(name = draftLabel, labelId = draftLabelId) {
    const labelName = name.trim()

    if (!labelName) {
      return
    }

    onChange([
      ...labels,
      {
        labelId: labelId || null,
        name: labelName,
        catalogNumber: draftHasNoCatalogNumber
          ? null
          : draftCatalogNumber.trim() || null,
        hasNoCatalogNumber: draftHasNoCatalogNumber,
      },
    ])
    setDraftLabel('')
    setDraftLabelId('')
    setDraftCatalogNumber('')
    setDraftHasNoCatalogNumber(false)
  }

  if (notOnLabel) {
    return (
      <p className="release-section-note">
        No label rows will be attached to this release.
      </p>
    )
  }

  return (
    <div className="release-label-editor">
      <div className="release-label-composer">
        <label className="release-label-composer-name">
          <span>Label</span>
          <input
            aria-label="Label"
            placeholder="Search or type label"
            value={draftLabel}
            onChange={(event) => {
              const nextName = event.target.value
              const existingLabel = suggestions.find(
                (label) => label.name.toLowerCase() === nextName.toLowerCase(),
              )

              setDraftLabel(nextName)
              setDraftLabelId(existingLabel?.id ?? '')
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addLabel()
              }
            }}
          />
        </label>
        <label className="settings-control">
          <span>Catalog number</span>
          <input
            aria-label="Catalog number"
            disabled={draftHasNoCatalogNumber}
            placeholder="CAT-001"
            value={draftCatalogNumber}
            onChange={(event) => setDraftCatalogNumber(event.target.value)}
          />
        </label>
        <label className="compact-checkbox release-row-checkbox">
          <input
            aria-label="No number"
            checked={draftHasNoCatalogNumber}
            type="checkbox"
            onChange={(event) => {
              setDraftHasNoCatalogNumber(event.target.checked)
              if (event.target.checked) {
                setDraftCatalogNumber('')
              }
            }}
          />
          <span>No number</span>
        </label>
        <button
          className="button button-secondary button-compact"
          type="button"
          onClick={() => addLabel()}
        >
          Add label
        </button>
      </div>
      {draftLabel.trim().length >= 2 ? (
        <ImportEntitySuggestionRow
          emptyLabel="No matching label found. Add will create a new label."
          suggestions={suggestions}
          onSelect={(suggestion) => addLabel(suggestion.name, suggestion.id)}
        />
      ) : null}
      <div className="release-label-chip-list" aria-label="Labels">
        {labels.length === 0 ? (
          <p className="release-section-note">Added labels will appear here.</p>
        ) : (
          labels.map((label, index) => (
            <div className="release-label-chip" key={`${label.name}-${index}`}>
              <span className="release-label-chip-name">
                {label.name || 'Unnamed label'}
              </span>
              <span className="release-label-chip-number">
                {label.hasNoCatalogNumber
                  ? 'No number'
                  : label.catalogNumber || 'No number'}
              </span>
              <button
                aria-label={`Remove ${label.name || 'label'}`}
                className="release-label-chip-remove"
                type="button"
                onClick={() =>
                  onChange(
                    labels.filter((_, currentIndex) => currentIndex !== index),
                  )
                }
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
