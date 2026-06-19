import type {
  ReviewWorkbenchItem,
  ReviewWorkbenchNavigationTarget,
  ReviewWorkbenchTarget,
} from './reviewWorkbenchApi'

export type ReviewWorkbenchResolvedTarget = Readonly<{
  id: string
  kind: string
  title?: string | null
}>

export function targetHref(item: ReviewWorkbenchItem) {
  // The backend path is a catalog hint; the desktop shell currently routes by query selection.
  const target = resolveReviewWorkbenchTarget(item)

  if (!target) {
    return null
  }

  if (target.kind === 'release') {
    return `/releases?release=${encodeURIComponent(target.id)}`
  }

  if (target.kind === 'track') {
    return `/tracks?track=${encodeURIComponent(target.id)}`
  }

  if (target.kind === 'ownedItem') {
    return `/owned-items?ownedItem=${encodeURIComponent(target.id)}`
  }

  return null
}

export function resolveReviewWorkbenchTarget(
  item: ReviewWorkbenchItem,
): ReviewWorkbenchResolvedTarget | null {
  const topLevelTarget = fromNavigationTarget(
    item.navigationTarget,
    item.targets,
  )
  if (topLevelTarget) {
    return topLevelTarget
  }

  for (const target of item.targets) {
    const nestedTarget = fromNavigationTarget(target.navigationTarget, [target])
    if (nestedTarget) {
      return nestedTarget
    }
  }

  const fallbackTarget = item.targets.find(hasTargetIdentity)
  return fallbackTarget
    ? {
        id: fallbackTarget.id,
        kind: fallbackTarget.kind,
        title: fallbackTarget.title,
      }
    : null
}

function fromNavigationTarget(
  navigationTarget: ReviewWorkbenchNavigationTarget | null | undefined,
  targets: readonly ReviewWorkbenchTarget[],
): ReviewWorkbenchResolvedTarget | null {
  if (!hasTargetIdentity(navigationTarget)) {
    return null
  }

  const matchingTarget = targets.find(
    (target) =>
      target.kind === navigationTarget.kind &&
      target.id === navigationTarget.id,
  )
  return {
    id: navigationTarget.id,
    kind: navigationTarget.kind,
    title: matchingTarget?.title,
  }
}

function hasTargetIdentity<
  T extends { id?: string | null; kind?: string | null },
>(target: T | null | undefined): target is T & { id: string; kind: string } {
  return Boolean(target?.kind && target.id)
}
