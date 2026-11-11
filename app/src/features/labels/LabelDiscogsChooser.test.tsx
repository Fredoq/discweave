import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  LabelDiscogsChooser,
  type LabelDiscogsChooserProps,
} from './LabelDiscogsChooser'

const candidates = [
  { externalId: '398551', name: '50Weapons' },
  { externalId: '99', name: '50Weapons (UK)' },
]
function props(
  overrides: Partial<LabelDiscogsChooserProps> = {},
): LabelDiscogsChooserProps {
  return {
    candidates,
    searchTotal: 84,
    searched: true,
    initialQuery: '50Weapons',
    selectedId: null,
    pending: false,
    onSearch: vi.fn(),
    onApply: vi.fn().mockResolvedValue(true),
    onCancel: vi.fn(),
    ...overrides,
  }
}
afterEach(cleanup)

describe('Discogs label chooser', () => {
  it('requires an explicit radio choice with a single confirmation action', async () => {
    const user = userEvent.setup()
    const input = props()
    render(<LabelDiscogsChooser {...input} />)
    expect(
      screen.getByRole('dialog', { name: 'Choose a Discogs label' }),
    ).toBeVisible()
    expect(
      screen.getByRole('searchbox', { name: 'Search Discogs labels' }),
    ).toHaveFocus()
    expect(
      screen.getByRole('button', { name: 'Use selected label' }),
    ).toBeDisabled()
    expect(
      screen
        .getAllByRole('radio')
        .every((radio) => !(radio as HTMLInputElement).checked),
    ).toBe(true)
    await user.click(screen.getByRole('radio', { name: '50Weapons #398551' }))
    await user.click(screen.getByRole('button', { name: 'Use selected label' }))
    expect(input.onApply).toHaveBeenCalledWith('398551')
    expect(
      screen.getByRole('link', { name: 'Open 50Weapons (398551) on Discogs' }),
    ).toHaveAttribute('href', 'https://www.discogs.com/label/398551')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Showing 2 of 84 label matches',
    )
  })
  it('clears a stale selection when searching another query', async () => {
    const user = userEvent.setup()
    const input = props({ selectedId: '398551' })
    render(<LabelDiscogsChooser {...input} />)
    expect(
      screen.getByRole('button', { name: 'Use selected label' }),
    ).toBeEnabled()
    await user.type(screen.getByRole('searchbox'), ' label')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(input.onSearch).toHaveBeenCalledWith('50Weapons label')
    expect(
      screen.getByRole('button', { name: 'Use selected label' }),
    ).toBeDisabled()
  })
  it('restores focus after Escape and reopens without a discarded selection', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>Change label</button>
          {open ? (
            <LabelDiscogsChooser
              {...props({ onCancel: () => setOpen(false) })}
            />
          ) : null}
        </>
      )
    }
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Change label' }))
    await user.click(screen.getByRole('radio', { name: '50Weapons #398551' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Change label' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Change label' }))
    expect(
      screen.getByRole('button', { name: 'Use selected label' }),
    ).toBeDisabled()
  })
  it('keeps keyboard focus inside the modal', async () => {
    const user = userEvent.setup()
    render(<LabelDiscogsChooser {...props({ selectedId: '398551' })} />)
    await user.tab({ shift: true })
    expect(
      screen.getByRole('button', { name: 'Use selected label' }),
    ).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('searchbox')).toHaveFocus()
  })
  it('blocks repeated apply and leaves cancellation available during an outstanding write', async () => {
    const user = userEvent.setup()
    let resolve!: (value: boolean) => void
    const request = new Promise<boolean>((done) => {
      resolve = done
    })
    const input = props({
      selectedId: '398551',
      onApply: vi.fn().mockReturnValue(request),
    })
    const view = render(<LabelDiscogsChooser {...input} />)
    await user.dblClick(
      screen.getByRole('button', { name: 'Use selected label' }),
    )
    expect(input.onApply).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(input.onCancel).toHaveBeenCalledTimes(1)
    view.unmount()
    await act(async () => {
      resolve(true)
      await request
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('keeps a failed choice open and allows a safe retry', async () => {
    const user = userEvent.setup()
    render(
      <LabelDiscogsChooser
        {...props({
          selectedId: '398551',
          onApply: vi.fn().mockRejectedValue(new Error('private details')),
        })}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Use selected label' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The label could not be selected',
    )
    expect(
      screen.getByRole('button', { name: 'Use selected label' }),
    ).toBeEnabled()
    expect(screen.queryByText('private details')).not.toBeInTheDocument()
  })
  it('handles the native cancel event without allowing an invisible mounted dialog', () => {
    const input = props()
    render(<LabelDiscogsChooser {...input} />)
    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { cancelable: true }),
    )
    expect(input.onCancel).toHaveBeenCalledOnce()
  })
  it('hides a late search result when the user has changed the submitted name', async () => {
    const user = userEvent.setup()
    const input = props({ candidates: [], searched: false, pending: true })
    const view = render(<LabelDiscogsChooser {...input} />)
    await user.clear(screen.getByRole('searchbox'))
    await user.type(screen.getByRole('searchbox'), 'New label')
    view.rerender(
      <LabelDiscogsChooser
        {...input}
        candidates={candidates}
        searched
        pending={false}
      />,
    )
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Use selected label' }),
    ).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Search the updated name',
    )
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(input.onSearch).toHaveBeenCalledWith('New label')
    view.rerender(
      <LabelDiscogsChooser
        {...input}
        candidates={[{ externalId: '17', name: 'New label' }]}
        searched
        pending={false}
      />,
    )
    expect(screen.getByRole('radio', { name: 'New label #17' })).toBeVisible()
  })
})
