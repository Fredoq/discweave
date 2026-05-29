export type FilterSelectOption = {
  label: string
  value: string
}

export type FilterSelectProps = {
  disabled?: boolean
  label: string
  options?: FilterSelectOption[]
  value: string
  values: string[]
  onChange: (value: string) => void
}

export function FilterSelect({
  disabled = false,
  label,
  options,
  value,
  values,
  onChange,
}: FilterSelectProps) {
  const selectOptions =
    options ?? values.map((option) => ({ label: option, value: option }))

  return (
    <label className="filter-control">
      <span>{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All</option>
        {selectOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
