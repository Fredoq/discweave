import type { EntitySuggestion } from '../catalog/catalogApi'

type SuggestionRowProps = Readonly<{
  label: string
  suggestions: EntitySuggestion[]
  selectedIds: string[]
  onSelect: (suggestion: EntitySuggestion) => void
  onClear: () => void
}>

export function SuggestionRow({
  label,
  suggestions,
  selectedIds,
  onSelect,
  onClear,
}: SuggestionRowProps) {
  if (suggestions.length === 0 && selectedIds.length === 0) {
    return null
  }

  return (
    <div className="imports-suggestions" aria-label={label}>
      <span>{label}</span>
      <div>
        {suggestions.slice(0, 4).map((suggestion) => (
          <button
            className={
              selectedIds.includes(suggestion.id) ? 'is-selected' : undefined
            }
            key={suggestion.id}
            type="button"
            onClick={() => onSelect(suggestion)}
          >
            {suggestion.name}
          </button>
        ))}
        {selectedIds.length > 0 ? (
          <button type="button" onClick={onClear}>
            New
          </button>
        ) : null}
      </div>
    </div>
  )
}
