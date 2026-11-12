import type { CatalogLink } from '../catalog/catalogLinks'

export function linkValue(link?: CatalogLink) {
  return link ? `${link.kind}:${link.id}` : ''
}

function validYear(value: string) {
  return value === '' || (/^\d{1,4}$/.test(value) && Number(value) >= 1)
}

export function validRelationPeriod(
  kind: CatalogLink['kind'] | undefined,
  start: string,
  end: string,
) {
  if (kind !== 'artist') return true
  return (
    validYear(start) &&
    validYear(end) &&
    (!start || !end || Number(start) <= Number(end))
  )
}

export function relationValidationMessage({
  supportedOriginal,
  preservedType,
  validType,
  duplicate,
  validPeriod,
}: {
  supportedOriginal: boolean
  preservedType: boolean
  validType: boolean
  duplicate: boolean
  validPeriod: boolean
}) {
  if (!supportedOriginal)
    return 'This legacy relation cannot be edited here. Artist and track relations require existing endpoints of the same kind.'
  if (preservedType && !validType)
    return 'The existing relationship type is inactive or unavailable. Choose an active type or enable it in Settings.'
  if (duplicate) return 'This relation already exists.'
  if (!validPeriod)
    return 'Enter valid years with the start no later than the end.'
  return 'Choose two different existing artists or tracks and a relation type.'
}

export function relationSubmitLabel(pending: boolean, editing: boolean) {
  if (pending) return 'Saving…'
  return editing ? 'Save record' : 'Add record'
}
