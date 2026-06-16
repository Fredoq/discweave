import type {
  CatalogDictionaries,
  TrackRelationParserRuleDirection,
} from '../catalog/catalogApi'

export function RelationTypeSelect({
  dictionaries,
  isLabelVisible = false,
  label,
  onChange,
  value,
}: Readonly<{
  dictionaries: CatalogDictionaries
  isLabelVisible?: boolean
  label: string
  onChange: (value: string) => void
  value: string
}>) {
  return (
    <label className="settings-control parser-rule-cell-control">
      <span className={isLabelVisible ? undefined : 'visually-hidden'}>
        {label}
      </span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        <option value="">Select relation type</option>
        {dictionaries.trackRelationType
          .filter((entry) => entry.isActive)
          .map((entry) => (
            <option key={entry.code} value={entry.code}>
              {entry.name}
            </option>
          ))}
      </select>
    </label>
  )
}

export function DirectionSelect({
  isLabelVisible = false,
  label,
  onChange,
  value,
}: Readonly<{
  isLabelVisible?: boolean
  label: string
  onChange: (value: TrackRelationParserRuleDirection) => void
  value: TrackRelationParserRuleDirection
}>) {
  return (
    <label className="settings-control parser-rule-cell-control">
      <span className={isLabelVisible ? undefined : 'visually-hidden'}>
        {label}
      </span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) =>
          onChange(
            event.currentTarget.value as TrackRelationParserRuleDirection,
          )
        }
      >
        <option value="variantToBase">Variant to base</option>
        <option value="baseToVariant">Base to variant</option>
      </select>
    </label>
  )
}
