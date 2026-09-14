import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  highCandidate,
  sourceTrackFixture,
} from './OriginalTrackDiscoveryDialog.testUtils'
import {
  useOriginalTrackDiscovery,
  type UseOriginalTrackDiscoveryOptions,
} from './useOriginalTrackDiscovery'
import { useTracksOriginalDiscovery } from './useTracksOriginalDiscovery'

vi.mock('./useOriginalTrackDiscovery', () => ({
  useOriginalTrackDiscovery: vi.fn(),
}))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useTracksOriginalDiscovery', () => {
  it('falls back to a catalog refresh when confirmation returns no relation DTO', async () => {
    const open = vi.fn().mockResolvedValue(undefined)
    const controller = {
      open,
    } as unknown as ReturnType<typeof useOriginalTrackDiscovery>
    let onConfirmed: UseOriginalTrackDiscoveryOptions['onConfirmed']
    vi.mocked(useOriginalTrackDiscovery).mockImplementation((options) => {
      onConfirmed = options.onConfirmed
      return controller
    })
    const onCatalogChanged = vi.fn()
    const onRefreshStacks = vi.fn()
    const onStackRelationSaved = vi.fn()
    const sourceTrack = sourceTrackFixture()

    const { result } = renderHook(() =>
      useTracksOriginalDiscovery({
        relationTypeOptions: [{ code: 'remixOf', label: 'Remix of' }],
        onCatalogChanged,
        onRefreshStacks,
        onStackRelationSaved,
      }),
    )

    await act(async () => {
      await result.current.openFor(sourceTrack)
    })
    act(() => {
      onConfirmed?.(
        { candidate: highCandidate(), relationTypeCode: 'remixOf' },
        false,
      )
    })

    expect(onRefreshStacks).toHaveBeenCalledTimes(1)
    expect(onCatalogChanged).toHaveBeenCalledTimes(1)
    expect(onStackRelationSaved).not.toHaveBeenCalled()
  })
})
