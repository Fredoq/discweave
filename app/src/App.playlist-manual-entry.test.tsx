import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('playlist manual entry from the app header', () => {
  it('supports required-only entry, explicit discard and selected saved detail', async () => {
    window.history.pushState({}, '', '/playlists')
    const user = h.userEvent.setup()
    h.render(<h.App />)
    await user.click(h.screen.getByRole('button', { name: 'Add playlist' }))
    const form = h.screen.getByRole('form', { name: 'Add playlist' })
    expect(form).toBeVisible()
    expect(h.within(form).getByRole('status')).toHaveTextContent(
      'Unsaved changes',
    )
    expect(
      h.screen.getByRole('heading', { name: 'Playlists', level: 1 }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('button', { name: 'Save playlist' }),
    ).toBeDisabled()
    await user.click(h.screen.getByRole('button', { name: 'Cancel' }))
    await user.click(h.screen.getByRole('button', { name: 'Discard changes' }))
    expect(
      h.screen.queryByRole('form', { name: 'Add playlist' }),
    ).not.toBeInTheDocument()
    expect(
      h.screen.queryByRole('button', { name: /listening desk checks/i }),
    ).not.toBeInTheDocument()

    await user.click(h.screen.getByRole('button', { name: 'Add playlist' }))
    await user.type(h.screen.getByLabelText('Name'), 'Listening Desk Checks')
    await user.click(h.screen.getByRole('button', { name: 'Save playlist' }))
    expect(
      h.screen.queryByRole('form', { name: 'Add playlist' }),
    ).not.toBeInTheDocument()
    expect(
      h.screen.getByRole('button', { name: /listening desk checks/i }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      h.screen.getByRole('heading', { name: 'Listening Desk Checks' }),
    ).toBeInTheDocument()
    await user.type(
      h.screen.getByRole('searchbox', { name: 'Search playlists' }),
      'Listening Desk Checks',
    )
    expect(
      h.screen.getByRole('button', { name: /listening desk checks/i }),
    ).toBeVisible()
    expect(
      h.screen.getByRole('heading', { name: 'Listening Desk Checks' }),
    ).toBeInTheDocument()
  })
})
