type DiscogsLookupInputProps = Readonly<{
  inputMode?: 'numeric'
  label: string
  type?: 'number' | 'text'
  value: string
  onChange: (value: string) => void
}>

export function DiscogsLookupInput({
  inputMode,
  label,
  type = 'text',
  value,
  onChange,
}: DiscogsLookupInputProps) {
  return (
    <label>
      <span>{label}</span>
      <input
        aria-label={label}
        inputMode={inputMode}
        min={type === 'number' ? '1' : undefined}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}
