export const defaultCreditRoleOptions = [
  'Main artist',
  'Featured artist',
  'Remixer',
  'Producer',
  'Composer',
  'Performer',
  'Engineer',
] as const

export type CreditRole = string

export function toCreditRole(role: string): CreditRole {
  return role.trim() || 'Performer'
}
