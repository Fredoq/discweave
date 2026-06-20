import { describe, expect, it } from 'vitest'
import type { ReviewWorkbenchItem } from './reviewWorkbenchApi'
import {
  resolveReviewWorkbenchTarget,
  targetHref,
} from './reviewWorkbenchNavigation'

describe('reviewWorkbenchNavigation', () => {
  it('keeps navigation kind and id from the same resolved target', () => {
    const item = reviewWorkbenchItem({
      navigationTarget: {
        kind: 'track',
        id: 'track-1',
        path: '/catalog/tracks/track-1',
      },
      targets: [
        { kind: 'release', id: 'release-1', title: 'Wrong first target' },
        { kind: 'track', id: 'track-1', title: 'Matched track' },
      ],
    })

    expect(resolveReviewWorkbenchTarget(item)).toEqual({
      kind: 'track',
      id: 'track-1',
      title: 'Matched track',
    })
    expect(targetHref(item)).toBe('/tracks?track=track-1')
  })

  it('routes import cleanup targets to the imports workspace', () => {
    const item = reviewWorkbenchItem({
      category: 'importCleanup',
      navigationTarget: {
        kind: 'importSession',
        id: 'import-session-1',
        path: '/imports',
      },
      targets: [
        {
          kind: 'importSession',
          id: 'import-session-1',
          title: 'Import session',
        },
      ],
    })

    expect(targetHref(item)).toBe('/imports')
  })
})

function reviewWorkbenchItem(
  overrides: Partial<ReviewWorkbenchItem>,
): ReviewWorkbenchItem {
  return {
    stableKey: 'key',
    category: 'missingMetadata',
    subtype: 'tracksMissingDuration',
    title: 'Track missing duration',
    state: 'open',
    reason: 'detected',
    sourceDetector: 'catalogQuality',
    targets: [],
    ...overrides,
  }
}
