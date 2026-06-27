export function UnknownImportCreditRoleOption({
  roleName,
}: Readonly<{
  roleName: string
}>) {
  return <option value={roleName}>{roleName} (not in settings)</option>
}

export function UnknownImportCreditRoleWarning() {
  return (
    <span className="release-artist-chip-warning">
      Will be added to Settings &gt; Credit roles on confirm.
    </span>
  )
}

export function UnknownImportCreditRoleOptionSlot({
  roleIsKnown,
  roleName,
}: Readonly<{
  roleIsKnown: boolean
  roleName: string
}>) {
  if (roleIsKnown) {
    return null
  }

  return <UnknownImportCreditRoleOption roleName={roleName} />
}

export function UnknownImportCreditRoleWarningSlot({
  roleIsKnown,
}: Readonly<{
  roleIsKnown: boolean
}>) {
  if (roleIsKnown) {
    return null
  }

  return <UnknownImportCreditRoleWarning />
}
