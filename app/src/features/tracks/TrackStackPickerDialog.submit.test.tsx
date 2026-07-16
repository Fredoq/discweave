import { act, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { StackRelationCommand } from '../catalog/api/ownedRelationsClient'
import type {
  TrackStackPickerAssignedResult,
  TrackStackTargetSearch,
} from './TrackStackPickerDialog'
import {
  apiError,
  deferred,
  openRelationStep,
  renderPicker,
} from './TrackStackPickerDialog.testUtils'

describe('TrackStackPickerDialog submission', () => {
  it('shows complete summaries on step two with no default relation', async () => {
    await openRelationStep()
    const dialog = screen.getByRole('dialog', { name: 'Choose relation type' })
    expect(within(dialog).getByText('Step 2 of 2')).toBeVisible()
    const route = within(dialog).getByRole('region', {
      name: 'Stack assignment route',
    })
    const source = within(route).getByRole('region', { name: 'Source track' })
    expect(within(source).getByText('Source Track')).toBeVisible()
    expect(within(source).getByText('Source Artist')).toBeVisible()
    const destination = within(route).getByRole('region', {
      name: 'Destination stack',
    })
    expect(within(destination).getByText('Destination Root')).toBeVisible()
    expect(within(destination).getByText('Destination Artist')).toBeVisible()
    expect(within(destination).getByText('1994 · 2 members')).toBeVisible()
    expect(route.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    for (const radio of within(dialog).getAllByRole('radio')) {
      expect(radio).not.toBeChecked()
    }
    expect(
      within(dialog).getByRole('button', { name: 'Add to stack' }),
    ).toBeDisabled()
  })

  it('preserves query results and destination when going back', async () => {
    const { user } = await openRelationStep()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(
      screen.getByRole('searchbox', { name: 'Search stacks' }),
    ).toHaveValue('bass')
    expect(
      screen.getByRole('radio', { name: /Destination Root/ }),
    ).toBeChecked()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })

  it('submits the selected root and explicit relation with promotion false', async () => {
    const onSubmit = vi
      .fn<(command: StackRelationCommand) => Promise<void>>()
      .mockResolvedValue(undefined)
    const onAssigned = vi.fn<(result: TrackStackPickerAssignedResult) => void>()
    const view = renderPicker({ onAssigned, onSubmit })
    const { user } = await openRelationStep('bass', view)
    await user.click(screen.getByRole('radio', { name: 'Remix' }))
    await user.click(screen.getByRole('button', { name: 'Add to stack' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      sourceTrackId: 'source-track',
      targetRootTrackId: 'destination-root',
      relationTypeCode: 'remixOf',
      markTargetAsOriginal: false,
    })
    expect(onAssigned).toHaveBeenCalledWith({
      destination: {
        rootTrackId: 'destination-root',
        title: 'Destination Root',
        artistDisplay: 'Destination Artist',
        versionYear: 1994,
        memberCount: 2,
        matchedMember: null,
      },
      relationType: { code: 'remixOf', label: 'Remix' },
    })
  })

  it('prevents duplicate submission and locks every close control while pending', async () => {
    const pending = deferred<void>()
    const onSubmit = vi
      .fn<(command: StackRelationCommand) => Promise<void>>()
      .mockReturnValue(pending.promise)
    const view = renderPicker({ onSubmit })
    const { user } = await openRelationStep('bass', view)
    await user.click(screen.getByRole('radio', { name: 'Remix' }))
    const add = screen.getByRole('button', { name: 'Add to stack' })
    await user.click(add)
    await user.click(add)
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Adding...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Close stack picker' }),
    ).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Remix' })).toBeDisabled()
    const cancelEvent = new Event('cancel', { cancelable: true })
    act(() => {
      screen.getByRole('dialog').dispatchEvent(cancelEvent)
    })
    expect(cancelEvent.defaultPrevented).toBe(true)
    await act(async () => {
      pending.resolve(undefined)
      await pending.promise
    })
  })

  it.each([
    [
      'track_relation.track_conflict',
      'Destination stack is no longer available. Choose another stack.',
    ],
    [
      'track_relation.stack_target_not_original',
      'Destination is no longer an original stack. Choose another stack.',
    ],
    [
      'track_relation.stack_cycle',
      'This assignment would create a stack cycle. Choose another stack.',
    ],
  ])('returns to search after destination-invalid %s', async (code, copy) => {
    const onSubmit = vi
      .fn<(command: StackRelationCommand) => Promise<void>>()
      .mockRejectedValue(await apiError(code))
    const view = renderPicker({ onSubmit })
    const { user } = await openRelationStep('bass', view)
    await user.click(screen.getByRole('radio', { name: 'Remix' }))
    await user.click(screen.getByRole('button', { name: 'Add to stack' }))
    expect(await screen.findByText(copy)).toBeVisible()
    expect(
      screen.getByRole('dialog', { name: 'Choose destination stack' }),
    ).toBeVisible()
    expect(
      screen.getByRole('searchbox', { name: 'Search stacks' }),
    ).toHaveValue('bass')
    expect(
      screen.getByRole('radio', { name: /Destination Root/ }),
    ).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })

  it('keeps the selected values after a conflicting relation', async () => {
    const onSubmit = vi
      .fn<(command: StackRelationCommand) => Promise<void>>()
      .mockRejectedValue(await apiError('track_relation.duplicate'))
    const view = renderPicker({ onSubmit })
    const { user } = await openRelationStep('bass', view)
    const relation = screen.getByRole('radio', { name: 'Remix' })
    await user.click(relation)
    await user.click(screen.getByRole('button', { name: 'Add to stack' }))
    expect(
      await screen.findByText(
        'A conflicting stack relation already exists. Review the track and try again.',
      ),
    ).toBeVisible()
    expect(relation).toBeChecked()
    expect(screen.getByRole('button', { name: 'Add to stack' })).toBeEnabled()
  })

  it('keeps the selected values after a network or storage failure', async () => {
    const onSubmit = vi
      .fn<(command: StackRelationCommand) => Promise<void>>()
      .mockRejectedValue(new Error('offline'))
    const view = renderPicker({ onSubmit })
    const { user } = await openRelationStep('bass', view)
    const relation = screen.getByRole('radio', { name: 'Version' })
    await user.click(relation)
    await user.click(screen.getByRole('button', { name: 'Add to stack' }))
    expect(
      await screen.findByText(
        'Could not save the stack assignment. Check the connection or storage and try again.',
      ),
    ).toBeVisible()
    expect(relation).toBeChecked()
  })

  it.each(['track_relation.stack_type_invalid', 'track_relation.type_invalid'])(
    'clears a disabled relation after %s',
    async (code) => {
      const onSubmit = vi
        .fn<(command: StackRelationCommand) => Promise<void>>()
        .mockRejectedValue(await apiError(code))
      const view = renderPicker({ onSubmit })
      const { user } = await openRelationStep('bass', view)
      const relation = screen.getByRole('radio', { name: 'Remix' })
      await user.click(relation)
      await user.click(screen.getByRole('button', { name: 'Add to stack' }))
      expect(
        await screen.findByText(
          'This relation type is no longer enabled. Choose another type.',
        ),
      ).toBeVisible()
      expect(relation).not.toBeChecked()
      expect(
        screen.getByRole('button', { name: 'Add to stack' }),
      ).toBeDisabled()
    },
  )

  it('blocks a stale source mutation and requests a workspace refresh', async () => {
    const onSubmit = vi
      .fn<(command: StackRelationCommand) => Promise<void>>()
      .mockRejectedValue(
        await apiError('track_relation.stack_source_not_standalone'),
      )
    const view = renderPicker({ onSubmit })
    const { user } = await openRelationStep('bass', view)
    await user.click(screen.getByRole('radio', { name: 'Remix' }))
    await user.click(screen.getByRole('button', { name: 'Add to stack' }))
    expect(
      await screen.findByText(
        'Source track is no longer eligible for stack assignment.',
      ),
    ).toBeVisible()
    expect(view.onSourceInvalid).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Add to stack' })).toBeDisabled()
  })

  it.each([
    ['track.not_found', 404, 'Source track is no longer available.'],
    [
      'track_stack.source_not_standalone',
      409,
      'Source track is no longer eligible for stack assignment.',
    ],
  ])('blocks a stale source search after %s', async (code, status, copy) => {
    const searchTargets = vi
      .fn<TrackStackTargetSearch>()
      .mockRejectedValue(await apiError(String(code), Number(status)))
    const view = renderPicker({ searchTargets })
    const user = (await import('@testing-library/user-event')).default.setup()
    await user.type(
      screen.getByRole('searchbox', { name: 'Search stacks' }),
      'bass',
    )
    expect(await screen.findByText(String(copy))).toBeVisible()
    expect(view.onSourceInvalid).toHaveBeenCalledTimes(1)
    expect(
      screen.queryByRole('button', { name: 'Retry stack search' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeVisible()
  })

  it('blocks submission when relation settings become empty', async () => {
    const view = renderPicker()
    const { user } = await openRelationStep('bass', view)
    await user.click(screen.getByRole('radio', { name: 'Remix' }))
    view.rerenderPicker({ relationTypeOptions: [] })
    expect(
      await screen.findByText('No stack relation types are enabled'),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Add to stack' })).toBeDisabled()
  })
})
