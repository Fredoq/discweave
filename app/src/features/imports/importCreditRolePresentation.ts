export function importCreditRoleChipClass(roleIsKnown: boolean) {
  if (roleIsKnown) {
    return 'release-artist-chip'
  }

  return 'release-artist-chip release-artist-chip-invalid'
}

export function importCreditRoleFaceClass({
  role,
  roleIsKnown,
}: Readonly<{
  role: string
  roleIsKnown: boolean
}>) {
  if (roleIsKnown) {
    if (role) {
      return 'release-artist-chip-role-face'
    }

    return 'release-artist-chip-role-face release-artist-chip-role-face-unset'
  }

  return 'release-artist-chip-role-face release-artist-chip-role-face-invalid'
}
