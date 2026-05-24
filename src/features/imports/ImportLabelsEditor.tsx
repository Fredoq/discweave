import { useState } from 'react'
import type { ReleaseImportLabel } from '../catalog/catalogApi'

export function ImportLabelsEditor({
  labels,
  notOnLabel,
  onChange,
}: {
  labels: ReleaseImportLabel[]
  notOnLabel: boolean
  onChange: (labels: ReleaseImportLabel[]) => void
}) {
  const [draftLabel, setDraftLabel] = useState('')
  const [draftCatalogNumber, setDraftCatalogNumber] = useState('')
  const [draftHasNoCatalogNumber, setDraftHasNoCatalogNumber] = useState(false)

  function addLabel() {
    const labelName = draftLabel.trim()

    if (!labelName) {
      return
    }

    onChange([
      ...labels,
      {
        labelId: null,
        name: labelName,
        catalogNumber: draftHasNoCatalogNumber
          ? null
          : draftCatalogNumber.trim() || null,
        hasNoCatalogNumber: draftHasNoCatalogNumber,
      },
    ])
    setDraftLabel('')
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
            onChange={(event) => setDraftLabel(event.target.value)}
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
          onClick={addLabel}
        >
          Add label
        </button>
      </div>
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
