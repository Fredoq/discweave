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
