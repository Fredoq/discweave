import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { StackRelationCommand } from '../catalog/api/ownedRelationsClient'
import type { TrackStackTargetSearch } from './TrackStackPickerDialog'
import {
  apiError,
  deferred,
  openRelationStep,
  page,
  renderPicker,
  target,
} from './TrackStackPickerDialog.testUtils'

describe('TrackStackPickerDialog accessibility', () => {
  it('uses named radio groups for destinations and relation types', async () => {
    const user = userEvent.setup()
    renderPicker()
    await user.type(
      screen.getByRole('searchbox', { name: 'Search stacks' }),
      'bass',
    )
    const destinations = await screen.findByRole('group', {
      name: 'Destination stack',
    })
    const destination = within(destinations).getByRole('radio', {
      name: /Destination Root/,
    })
    await user.click(destination)
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    const relations = screen.getByRole('group', { name: 'Relation type' })
    expect(
      within(relations).getByRole('radio', { name: 'Remix' }),
    ).toBeVisible()
  })

  it('supports arrow movement and Enter or Space selection', async () => {
    const searchTargets = vi
      .fn<TrackStackTargetSearch>()
      .mockResolvedValue(
        page([
          target({ rootTrackId: 'first-root', title: 'First Root' }),
          target({ rootTrackId: 'second-root', title: 'Second Root' }),
        ]),
      )
    renderPicker({ searchTargets })
    const user = userEvent.setup()
    await user.type(
      screen.getByRole('searchbox', { name: 'Search stacks' }),
      'root',
    )
    const first = await screen.findByRole('radio', { name: /First Root/ })
    const second = screen.getByRole('radio', { name: /Second Root/ })
    first.focus()
    await user.keyboard('{Enter}')
    expect(first).toBeChecked()
    second.focus()
    await user.keyboard(' ')
    expect(second).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    const remix = screen.getByRole('radio', { name: 'Remix' })
    const version = screen.getByRole('radio', { name: 'Version' })
    remix.focus()
    await user.keyboard('{ArrowRight}')
    expect(version).toBeChecked()
  })

  it('Cancel close and Escape do not mutate and restore entry focus', async () => {
    for (const method of ['Cancel', 'Close', 'Escape'] as const) {
      const onClose = vi.fn()
      const onSubmit = vi.fn<(command: StackRelationCommand) => Promise<void>>()
      const view = renderPicker({ onClose, onSubmit })
      const user = userEvent.setup()
      if (method === 'Escape') {
        act(() => {
          screen
            .getByRole('dialog')
            .dispatchEvent(new Event('cancel', { cancelable: true }))
        })
      } else {
        await user.click(
          screen.getByRole('button', {
            name: method === 'Close' ? 'Close stack picker' : 'Cancel',
          }),
        )
      }
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
      expect(onSubmit).not.toHaveBeenCalled()
      expect(view.entryButton).toHaveFocus()
      cleanup()
    }
  })

  it('does not close on Escape while submission is pending', async () => {
    const pending = deferred<void>()
    const onClose = vi.fn()
    const onSubmit = vi
      .fn<(command: StackRelationCommand) => Promise<void>>()
      .mockReturnValue(pending.promise)
    const view = renderPicker({ onClose, onSubmit })
    const { user } = await openRelationStep('bass', view)
    await user.click(screen.getByRole('radio', { name: 'Remix' }))
    await user.click(screen.getByRole('button', { name: 'Add to stack' }))
    const event = new Event('cancel', { cancelable: true })
    act(() => {
      screen.getByRole('dialog').dispatchEvent(event)
    })
    expect(event.defaultPrevented).toBe(true)
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeVisible()
    await act(async () => {
      pending.resolve(undefined)
      await pending.promise
    })
  })

  it('announces loading and errors without relying on color', async () => {
    const pending = deferred<ReturnType<typeof page>>()
    renderPicker({
      searchTargets: vi
        .fn<TrackStackTargetSearch>()
        .mockReturnValue(pending.promise),
    })
    const user = userEvent.setup()
    await user.type(
      screen.getByRole('searchbox', { name: 'Search stacks' }),
      'bass',
    )
    const loading = await screen.findByText('Searching stacks...')
    expect(loading.closest('[role="status"]')).toHaveAttribute(
      'aria-live',
      'polite',
    )
    await act(async () => {
      pending.reject(new Error('offline'))
      await pending.promise.catch(() => undefined)
    })
    const failure = await screen.findByText(
      'Could not search stacks. Try again',
    )
    expect(failure.closest('[role="status"]')).toHaveAttribute(
      'aria-live',
      'polite',
    )
  })

  it.each([
    [
      'track_relation.stack_cycle',
      'This assignment would create a stack cycle. Choose another stack',
    ],
    [
      'track_relation.duplicate',
      'A conflicting stack relation already exists. Review the track and try again',
    ],
  ])('announces recoverable %s errors politely', async (code, copy) => {
    const onSubmit = vi
      .fn<(command: StackRelationCommand) => Promise<void>>()
      .mockRejectedValue(await apiError(code))
    const view = renderPicker({ onSubmit })
    const { user } = await openRelationStep('bass', view)
    await user.click(screen.getByRole('radio', { name: 'Remix' }))
    await user.click(screen.getByRole('button', { name: 'Add to stack' }))

    const failure = await screen.findByText(copy)
    expect(failure.closest('[role="status"]')).toHaveAttribute(
      'aria-live',
      'polite',
    )
  })
})
