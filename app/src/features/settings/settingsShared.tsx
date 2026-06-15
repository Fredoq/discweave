import { Search } from 'lucide-react'
import {
  settingsModeNavigationItems,
  type SettingsMode,
} from './settingsModel'

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
      {settingsModeNavigationItems.map((item) => (
        <button
          aria-pressed={mode === item.mode}
          className={mode === item.mode ? 'is-selected' : undefined}
          data-search-terms={item.searchTerms.join(' ')}
          key={item.mode}
          type="button"
          onClick={() => onModeChange(item.mode)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
