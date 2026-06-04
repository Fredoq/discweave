type CreditRolePickerProps = {
  addLabel: string
  ariaLabel: string
  options: string[]
  onSelect: (role: string) => void
}

export function CreditRolePicker({
  addLabel,
  ariaLabel,
  options,
  onSelect,
}: CreditRolePickerProps) {
  const hasOptions = options.length > 0

  return (
    <details
      className={
        hasOptions
          ? 'release-artist-add-role'
          : 'release-artist-add-role release-artist-add-role-disabled'
      }
    >
      <summary aria-label={ariaLabel}>{addLabel}</summary>
      {hasOptions ? (
        <div className="release-artist-role-menu" role="menu">
          {options.map((role) => (
            <button
              key={role}
              type="button"
              role="menuitem"
              onClick={(event) => {
                onSelect(role)
                event.currentTarget.closest('details')?.removeAttribute('open')
              }}
            >
              {role}
            </button>
          ))}
        </div>
      ) : null}
    </details>
  )
}
