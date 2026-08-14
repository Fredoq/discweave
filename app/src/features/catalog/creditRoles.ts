export const defaultCreditRoleOptions = [
  'Main artist',
  'Featured artist',
  'Remixer',
  'Producer',
  'Composer',
  'Performer',
  'Engineer',
] as const

export function toCreditRole(role: string): string {
  return role.trim() || 'Performer'
}
