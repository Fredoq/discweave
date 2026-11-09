import type { ImportRelationSuggestion } from '../catalog/catalogApi'
import './import-relation-suggestions.css'

export function ImportRelationSuggestionsSummary({
  suggestions,
  onReview,
}: Readonly<{
  suggestions: ImportRelationSuggestion[]
  onReview?: () => void
}>) {
  if (suggestions.length === 0) return null

  const pending = suggestions.filter(
    (item) => item.decision === 'pending',
  ).length
  const accepted = suggestions.filter(
    (item) => item.decision === 'accepted',
  ).length
  const rejected = suggestions.filter(
    (item) => item.decision === 'rejected',
  ).length
  const hasRequired = suggestions.some(
    (item) => item.applicationMode === 'required',
  )

  return (
    <section
      className="imports-relation-review-summary"
      aria-label="Relation review summary"
    >
      <div>
        <strong>Relation suggestions</strong>
        <p>
          {pending} pending · {accepted} accepted · {rejected} rejected
        </p>
        <p>
          {hasRequired
            ? 'Pending suggestions are not accepted automatically. Accepted required relations must pass import validation.'
            : 'Optional suggestions do not block import. Pending suggestions are not accepted automatically.'}
        </p>
      </div>
      {onReview ? (
        <button
          type="button"
          className="button button-secondary button-compact"
          onClick={onReview}
        >
          Review relations
        </button>
      ) : null}
    </section>
  )
}
