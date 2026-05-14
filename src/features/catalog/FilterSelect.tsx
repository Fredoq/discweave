export type FilterSelectProps = {
  disabled?: boolean
  label: string
  value: string
  values: string[]
  onChange: (value: string) => void
}

export function FilterSelect({
  disabled = false,
  label,
  value,
  values,
  onChange,
}: FilterSelectProps) {
  return (
    <label className="filter-control">
      <span>{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All</option>
        {values.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}
