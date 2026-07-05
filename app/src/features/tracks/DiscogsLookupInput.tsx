import type { Ref } from 'react'

type DiscogsLookupInputProps = Readonly<{
  inputMode?: 'numeric'
  inputRef?: Ref<HTMLInputElement>
  label: string
  type?: 'number' | 'text'
  value: string
  onChange: (value: string) => void
}>

export function DiscogsLookupInput({
  inputMode,
  inputRef,
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
        ref={inputRef}
        inputMode={inputMode}
        min={type === 'number' ? '1' : undefined}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}
