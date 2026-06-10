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
          onClick={() => onSelect(suggestion)}
        >
          {suggestion.name}
        </button>
      ))}
    </div>
  )
}
