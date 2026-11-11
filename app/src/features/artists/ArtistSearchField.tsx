import { Search } from 'lucide-react'

type SearchFieldProps = {
  label: string
  placeholder: string
  query: string
  onQueryChange: (query: string) => void
}

export function ArtistSearchField({
  label,
  placeholder,
  query,
  onQueryChange,
}: Readonly<SearchFieldProps>) {
  return (
    <label className="search-field">
      <span className="search-icon" aria-hidden="true">
        <Search size={17} strokeWidth={2.2} />
      </span>
      <span className="visually-hidden">{label}</span>
      <input
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}
