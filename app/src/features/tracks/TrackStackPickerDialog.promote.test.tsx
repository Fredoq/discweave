import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { StackOriginalCommand } from '../catalog/api/ownedRelationsClient'
import type { TrackStackPickerAssignedResult } from './TrackStackPickerDialog'
import {
  openRelationStep,
  renderPicker,
} from './TrackStackPickerDialog.testUtils'

describe('TrackStackPickerDialog promotion', () => {
  it('makes the source track the new stack original when chosen', async () => {
    const onPromoteOriginal = vi
      .fn<(command: StackOriginalCommand) => Promise<void>>()
      .mockResolvedValue(undefined)
    const onAssigned = vi.fn<(result: TrackStackPickerAssignedResult) => void>()
    const view = renderPicker({ onAssigned, onPromoteOriginal })
    const { user } = await openRelationStep('bass', view)

    await user.click(
      screen.getByRole('radio', { name: /Make Source Track the new original/ }),
    )
    expect(
      screen.getByRole('group', {
        name: 'Relation from Destination Root to Source Track',
      }),
    ).toBeVisible()
    await user.click(screen.getByRole('radio', { name: 'Version' }))
    await user.click(screen.getByRole('button', { name: 'Make original' }))

    expect(view.onSubmit).not.toHaveBeenCalled()
    expect(onPromoteOriginal).toHaveBeenCalledWith({
      newOriginalTrackId: 'source-track',
      currentOriginalTrackId: 'destination-root',
      relationTypeCode: 'versionOf',
    })
    expect(onAssigned).toHaveBeenCalledWith(
      expect.objectContaining({ placement: 'original' }),
    )
  })

  it('hides the placement choice when promotion is unavailable', async () => {
    await openRelationStep()

    expect(
      screen.queryByRole('radio', { name: /the new original/ }),
    ).not.toBeInTheDocument()
  })
})
