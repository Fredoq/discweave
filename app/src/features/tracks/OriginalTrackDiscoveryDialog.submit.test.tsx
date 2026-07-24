import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { StackRelationCommand } from '../catalog/api/ownedRelationsClient'
import type { OriginalCandidateConfirmation } from './useOriginalTrackDiscovery'
import {
  deferred,
  highCandidate,
  renderDiscoveryDialog,
} from './OriginalTrackDiscoveryDialog.testUtils'

describe('OriginalTrackDiscoveryDialog submission', () => {
  it('initializes an enabled suggestion only after explicit candidate selection', async () => {
    const user = userEvent.setup()
    renderDiscoveryDialog()
    const dialog = await screen.findByRole('dialog')
    const continueButton = within(dialog).getByRole('button', {
      name: 'Continue to review',
    })

    expect(continueButton).toBeDisabled()
    for (const radio of await within(dialog).findAllByRole('radio')) {
      expect(radio).not.toBeChecked()
    }

    await user.click(
      within(dialog).getByRole('radio', { name: /Earlier Version/ }),
    )
    expect(continueButton).toBeEnabled()
    await user.click(continueButton)

    expect(
      within(dialog).getByRole('radio', { name: 'Version of' }),
    ).toBeChecked()
    expect(
      within(dialog).getByRole('radio', { name: 'Remix of' }),
    ).not.toBeChecked()
  })

  it('reviews source to target, root state, and standalone promotion clearly', async () => {
    const user = userEvent.setup()
    renderDiscoveryDialog()
    const dialog = await screen.findByRole('dialog')
    await user.click(
      await within(dialog).findByRole('radio', {
        name: /Earlier Version/,
      }),
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Continue to review' }),
    )

    const direction = within(dialog).getByRole('region', {
      name: 'Relationship direction',
    })
    expect(direction).toHaveTextContent('Source Mix')
    expect(direction).toHaveTextContent('→')
    expect(direction).toHaveTextContent('Earlier Version')
    expect(dialog).toHaveTextContent('Standalone local track')
    expect(dialog).toHaveTextContent(
      'will be promoted to an original when you confirm',
    )
  })

  it('submits the exact local stack command once and locks every exit while pending', async () => {
    const confirmation = deferred<void>()
    const confirmStackRelation = vi
      .fn<OriginalCandidateConfirmation>()
      .mockReturnValue(confirmation.promise)
    const user = userEvent.setup()
    const view = renderDiscoveryDialog({ confirmStackRelation })
    const dialog = await screen.findByRole('dialog')
    await user.click(
      await within(dialog).findByRole('radio', { name: /Original Cut/ }),
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Continue to review' }),
    )
    const submit = within(dialog).getByRole('button', {
      name: 'Confirm local relationship',
    })
    await user.click(submit)

    expect(confirmStackRelation).toHaveBeenCalledTimes(1)
    expect(confirmStackRelation).toHaveBeenCalledWith({
      sourceTrackId: 'source-track',
      targetRootTrackId: 'high-track',
      relationTypeCode: 'remixOf',
      markTargetAsOriginal: false,
    })
    expect(submit).toBeDisabled()
    expect(
      within(dialog).getByRole('button', {
        name: 'Close original-track discovery',
      }),
    ).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Back' })).toBeDisabled()
    expect(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    ).toBeDisabled()

    const cancelEvent = new Event('cancel', {
      bubbles: false,
      cancelable: true,
    })
    act(() => {
      dialog.dispatchEvent(cancelEvent)
    })
    expect(cancelEvent.defaultPrevented).toBe(true)
    expect(dialog).toHaveAttribute('open')
    await user.click(submit)
    expect(confirmStackRelation).toHaveBeenCalledTimes(1)

    await act(async () => {
      confirmation.resolve()
      await confirmation.promise
    })

    expect(view.onConfirmed).toHaveBeenCalledWith({
      relationTypeCode: 'remixOf',
      candidate: highCandidate(),
    })
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Track details' }),
      ).toHaveFocus(),
    )
  })

  it('keeps reviewed choices and the dialog open after a failed confirmation', async () => {
    const confirmStackRelation = vi
      .fn<(command: StackRelationCommand) => Promise<void>>()
      .mockRejectedValue(new Error('Relationship could not be saved'))
    const user = userEvent.setup()
    renderDiscoveryDialog({ confirmStackRelation })
    const dialog = await screen.findByRole('dialog')
    await user.click(
      await within(dialog).findByRole('radio', {
        name: /Earlier Version/,
      }),
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Continue to review' }),
    )
    await user.click(within(dialog).getByRole('radio', { name: 'Remix of' }))
    await user.click(
      within(dialog).getByRole('button', {
        name: 'Confirm local relationship',
      }),
    )

    expect(
      await within(dialog).findByText('Relationship could not be saved'),
    ).toBeVisible()
    expect(dialog).toHaveAttribute('open')
    expect(dialog).toHaveAttribute('data-step', 'review')
    expect(
      within(dialog).getByRole('radio', { name: 'Remix of' }),
    ).toBeChecked()
    expect(
      within(dialog).getByRole('button', {
        name: 'Confirm local relationship',
      }),
    ).toBeEnabled()
  })

  it('shows blocking validation when no relation type is enabled', async () => {
    const user = userEvent.setup()
    renderDiscoveryDialog({ relationTypeOptions: [] })
    const dialog = await screen.findByRole('dialog')
    await user.click(
      await within(dialog).findByRole('radio', { name: /Original Cut/ }),
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Continue to review' }),
    )

    expect(
      within(dialog).getByText(
        'No enabled relation types are available. Enable one in Settings before confirming.',
      ),
    ).toBeVisible()
    expect(
      within(dialog).getByRole('button', {
        name: 'Confirm local relationship',
      }),
    ).toBeDisabled()
  })
})
