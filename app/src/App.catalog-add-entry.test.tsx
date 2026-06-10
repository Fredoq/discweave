import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App catalog add entry flow', () => {
  it('creates a label from the catalog add entry flow', async () => {
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add entry' }))
    await user.click(
      h.screen.getByRole('button', { name: 'Create label entry' }),
    )

    const form = h.screen.getByRole('form', { name: 'Add label' })
    await user.type(
      h.within(form).getByLabelText('Name'),
      'Catalog Route Label',
    )
    await user.click(h.within(form).getByRole('button', { name: 'Add record' }))

    expect(
      h.screen.queryByRole('form', { name: 'Add label' }),
    ).not.toBeInTheDocument()
    expect(h.screen.getByRole('status')).toHaveTextContent('Label saved.')

    await user.click(h.screen.getByRole('link', { name: 'Labels' }))

    expect(
      h.screen.getByRole('row', { name: /catalog route label/i }),
    ).toHaveAttribute('aria-selected', 'true')
  })
})
