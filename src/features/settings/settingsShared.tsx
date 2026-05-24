import { Search } from 'lucide-react'
import type { SettingsMode } from './settingsModel'

export function SearchField({
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

export function ViewModeSwitch({
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
