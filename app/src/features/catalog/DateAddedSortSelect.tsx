import type { DateAddedSort } from './dateAddedSort'

export function DateAddedSortSelect({
  value,
  onChange,
}: Readonly<{
  value: DateAddedSort
  onChange: (value: DateAddedSort) => void
}>) {
  return (
    <label className="filter-control">
      <span>Sort by</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as DateAddedSort)}
      >
        <option value="default">Default order</option>
        <option value="addedNewest">Date added — newest first</option>
        <option value="addedOldest">Date added — oldest first</option>
      </select>
    </label>
  )
}
