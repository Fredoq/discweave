import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReviewWorkbenchTable } from './ReviewWorkbenchTable'
import type { ReviewWorkbenchItem } from './reviewWorkbenchApi'

const item: ReviewWorkbenchItem = {
  stableKey: 'release-date',
  category: 'missingMetadata',
  subtype: 'releasesMissingYearOrDate',
  focus: 'optional',
  title: 'Release date is incomplete',
  state: 'open',
  reason: 'Check the edition date',
  sourceDetector: 'catalogQuality',
  releaseDateReviewReleaseId: 'release-1',
  targets: [{ kind: 'release', id: 'release-1', title: 'Album' }],
}
function setup(value: ReviewWorkbenchItem) {
  const onOpenTarget = vi.fn()
  render(
    <ReviewWorkbenchTable
      items={[value]}
      pendingStableKey={null}
      onOpenTarget={onOpenTarget}
      onUpdateState={vi.fn()}
    />,
  )
  return onOpenTarget
}

describe('date review target navigation', () => {
  it('keeps Open target alongside Review date so metadata can be edited manually', () => {
    const onOpenTarget = setup(item)
    expect(screen.getByRole('button', { name: 'Review date' })).toBeEnabled()
    const open = screen.getByRole('button', {
      name: `Open target ${item.title}`,
    })
    expect(open).toBeEnabled()
    fireEvent.click(open)
    expect(onOpenTarget).toHaveBeenCalledExactlyOnceWith(item)
  })
  it('does not offer Open target when a date action has no navigable target', () => {
    const onOpenTarget = setup({ ...item, targets: [] })
    expect(screen.getByRole('button', { name: 'Review date' })).toBeEnabled()
    expect(
      screen.queryByRole('button', { name: /^Open target/ }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Target unavailable')).toBeInTheDocument()
    expect(onOpenTarget).not.toHaveBeenCalled()
  })
  it('preserves the disabled fallback for ordinary issues without a target', () => {
    setup({ ...item, releaseDateReviewReleaseId: null, targets: [] })
    expect(
      screen.queryByRole('button', { name: 'Review date' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Open target/ })).toBeDisabled()
  })
})
