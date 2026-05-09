export const creditRoleOptions = [
  'Main artist',
  'Featured artist',
  'Remixer',
  'Producer',
  'Composer',
  'Performer',
  'Engineer',
] as const

export type CreditRole = (typeof creditRoleOptions)[number]

export function toCreditRole(role: string): CreditRole {
  if (creditRoleOptions.includes(role as CreditRole)) {
    return role as CreditRole
  }

  return 'Performer'
}
