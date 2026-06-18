import type { ReviewWorkbenchItem } from './reviewWorkbenchApi'

export function targetHref(item: ReviewWorkbenchItem) {
  // The backend path is a catalog hint; the desktop shell currently routes by query selection.
  const target = item.navigationTarget ?? item.targets[0]?.navigationTarget
  const fallbackTarget = item.targets[0]
  const kind = target?.kind ?? fallbackTarget?.kind
  const id = target?.id ?? fallbackTarget?.id

  if (!kind || !id) {
    return null
  }

  if (kind === 'release') {
    return `/releases?release=${encodeURIComponent(id)}`
  }

  if (kind === 'track') {
    return `/tracks?track=${encodeURIComponent(id)}`
  }

  if (kind === 'ownedItem') {
    return `/owned-items?ownedItem=${encodeURIComponent(id)}`
  }

  return null
}
