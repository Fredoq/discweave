import type { ReactNode } from 'react'
import type { DateAddedSort } from './dateAddedSort'

/** Sort select; `children` adds workspace-specific options after the date ones. */
export function DateAddedSortSelect<TSort extends string = DateAddedSort>({
  children,
  value,
  onChange,
}: Readonly<{
  children?: ReactNode
  value: TSort | DateAddedSort
  onChange: (value: TSort | DateAddedSort) => void
}>) {
  return (
    <label className="filter-control">
      <span>Sort by</span>
      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value as TSort | DateAddedSort)
        }
      >
        <option value="default">Default order</option>
        <option value="addedNewest">Date added — newest first</option>
        <option value="addedOldest">Date added — oldest first</option>
        {children}
      </select>
    </label>
  )
}
