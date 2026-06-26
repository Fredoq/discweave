import type { DictionaryEntry } from '../catalog/catalogApi'

export function importCreditRoleIsKnown(
  roleName: string,
  creditRoleOptions: DictionaryEntry[],
) {
  return (
    !roleName ||
    creditRoleOptions.some(
      (role) => role.code === roleName || role.name === roleName,
    )
  )
}
