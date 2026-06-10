import type { Dispatch, SetStateAction } from 'react'
import type { EditableReleaseLabel } from './ReleaseEntryFormTypes'

type ReleaseLabelsSectionProps = {
  addDraftLabel: () => void
  draftCatalogNumber: string
  draftHasNoCatalogNumber: boolean
  draftLabel: string
  labels: EditableReleaseLabel[]
  notOnLabel: boolean
  removeLabelRow: (labelId: string) => void
  setDraftCatalogNumber: Dispatch<SetStateAction<string>>
  setDraftHasNoCatalogNumber: Dispatch<SetStateAction<boolean>>
  setDraftLabel: Dispatch<SetStateAction<string>>
  setNotOnLabel: Dispatch<SetStateAction<boolean>>
}

export function ReleaseLabelsSection({
  addDraftLabel,
  draftCatalogNumber,
  draftHasNoCatalogNumber,
  draftLabel,
  labels,
  notOnLabel,
  removeLabelRow,
  setDraftCatalogNumber,
  setDraftHasNoCatalogNumber,
  setDraftLabel,
  setNotOnLabel,
}: ReleaseLabelsSectionProps) {
  return (
    <section className="manual-entry-wide release-form-section">
      <div className="release-form-section-header">
        <div>
          <h3>Labels</h3>
          <p>Release label credits and catalog numbers.</p>
        </div>
        <div className="release-section-actions">
          <label className="compact-checkbox">
            <input
              type="checkbox"
              checked={notOnLabel}
              onChange={(event) => setNotOnLabel(event.target.checked)}
            />
            <span>Not On Label</span>
          </label>
        </div>
      </div>
      {notOnLabel ? (
        <p className="release-section-note">
          No label rows will be attached to this release.
        </p>
      ) : (
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
                    addDraftLabel()
                  }
                }}
              />
            </label>
            <label>
              <span>Catalog number</span>
              <input
                aria-label="Catalog number"
                placeholder="CAT-001"
                value={draftCatalogNumber}
                disabled={draftHasNoCatalogNumber}
                onChange={(event) => setDraftCatalogNumber(event.target.value)}
              />
            </label>
            <label className="compact-checkbox release-row-checkbox">
              <input
                aria-label="No number"
                type="checkbox"
                checked={draftHasNoCatalogNumber}
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
              onClick={addDraftLabel}
            >
              Add label
            </button>
          </div>
          <div className="release-label-chip-list" aria-label="Labels">
            {labels.length === 0 ? (
              <p className="release-section-note">
                Added labels will appear here.
              </p>
            ) : (
              labels.map((label) => (
                <div className="release-label-chip" key={label.id}>
                  <span className="release-label-chip-name">
                    {label.label || 'Unnamed label'}
                  </span>
                  <span className="release-label-chip-number">
                    {label.hasNoCatalogNumber
                      ? 'No number'
                      : label.catalogNumber || 'No number'}
                  </span>
                  <button
                    className="release-label-chip-remove"
                    type="button"
                    aria-label={`Remove ${label.label || 'label'}`}
                    onClick={() => removeLabelRow(label.id)}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  )
}
