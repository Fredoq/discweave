import type { EntitySuggestion } from '../catalog/catalogApi'

export function ImportEntitySuggestionRow({
  emptyLabel,
  suggestions,
  onSelect,
}: {
  emptyLabel: string
  suggestions: EntitySuggestion[]
  onSelect: (suggestion: EntitySuggestion) => void
}) {
  if (suggestions.length === 0) {
    return <p className="imports-suggestions">{emptyLabel}</p>
  }

  return (
    <div className="imports-suggestions">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.id}
          type="button"
          aria-label={
            suggestion.identityHint
              ? `${suggestion.name} ${suggestion.identityHint}`
              : undefined
          }
          onClick={() => onSelect(suggestion)}
        >
          <span>{suggestion.name}</span>
          {suggestion.identityHint ? (
            <small>{suggestion.identityHint}</small>
          ) : null}
        </button>
      ))}
    </div>
  )
}
