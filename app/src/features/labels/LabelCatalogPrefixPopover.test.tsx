import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  LabelCatalogPrefixPopover,
  type LabelCatalogPrefixPopoverProps,
} from './LabelCatalogPrefixPopover'
const options: [string, number][] = [
  ['50WEAPONS', 42],
  ['50WLP', 11],
  ['GROOVE', 5],
]
function props(
  overrides: Partial<LabelCatalogPrefixPopoverProps> = {},
): LabelCatalogPrefixPopoverProps {
  return {
    initialPrefixes: ['50WEAPONS'],
    options,
    pending: false,
    onApply: vi.fn().mockResolvedValue(true),
    onCancel: vi.fn(),
    ...overrides,
  }
}
afterEach(cleanup)
describe('Catalog prefix popover', () => {
  it('keeps edits local until Apply filters', async () => {
    const user = userEvent.setup()
    const input = props()
    render(<LabelCatalogPrefixPopover {...input} />)
    await user.click(screen.getByRole('checkbox', { name: '50WLP (11)' }))
    expect(input.onApply).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Apply filters' }))
    expect(input.onApply).toHaveBeenCalledWith(['50WEAPONS', '50WLP'])
  })
  it('discards Cancelled edits when reopened and restores the trigger focus', async () => {
    const user = userEvent.setup()
    const apply = vi.fn().mockResolvedValue(true)
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(!open)}>Catalog prefixes</button>
          {open ? (
            <LabelCatalogPrefixPopover
              {...props({ onApply: apply, onCancel: () => setOpen(false) })}
            />
          ) : null}
        </>
      )
    }
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Catalog prefixes' }))
    await user.click(screen.getByRole('checkbox', { name: '50WLP (11)' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(apply).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Catalog prefixes' }),
    ).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Catalog prefixes' }))
    expect(
      screen.getByRole('checkbox', { name: '50WLP (11)' }),
    ).not.toBeChecked()
  })
  it('normalizes a custom prefix without saving before Apply', async () => {
    const user = userEvent.setup()
    const input = props()
    render(<LabelCatalogPrefixPopover {...input} />)
    await user.type(
      screen.getByRole('textbox', { name: 'Add custom prefix' }),
      '50 cd',
    )
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByRole('checkbox', { name: '50CD (0)' })).toBeChecked()
    expect(input.onApply).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Apply filters' }))
    expect(input.onApply).toHaveBeenCalledWith(['50WEAPONS', '50CD'])
  })
  it('cancels on Escape and outside pointer interaction', async () => {
    const user = userEvent.setup()
    const input = props()
    render(<LabelCatalogPrefixPopover {...input} />)
    await user.keyboard('{Escape}')
    expect(input.onCancel).toHaveBeenCalledTimes(1)
    fireEvent.pointerDown(document.body)
    expect(input.onCancel).toHaveBeenCalledTimes(2)
  })
  it('keeps custom selected prefixes absent from loaded results available', () => {
    render(
      <LabelCatalogPrefixPopover {...props({ initialPrefixes: ['OTHER'] })} />,
    )
    expect(screen.getByRole('checkbox', { name: 'OTHER (0)' })).toBeChecked()
  })
  it('limits choices to fifty and disables duplicate custom prefixes', async () => {
    const user = userEvent.setup()
    render(
      <LabelCatalogPrefixPopover
        {...props({
          initialPrefixes: Array.from(
            { length: 50 },
            (_, index) => `PREFIX${index}`,
          ),
        })}
      />,
    )
    expect(screen.getByRole('checkbox', { name: '50WLP (11)' })).toBeDisabled()
    await user.type(
      screen.getByRole('textbox', { name: 'Add custom prefix' }),
      'PREFIX1',
    )
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
  })
  it('locks repeated apply and safely settles after unmount', async () => {
    const user = userEvent.setup()
    let resolve!: (value: boolean) => void
    const request = new Promise<boolean>((done) => {
      resolve = done
    })
    const input = props({ onApply: vi.fn().mockReturnValue(request) })
    const view = render(<LabelCatalogPrefixPopover {...input} />)
    await user.dblClick(screen.getByRole('button', { name: 'Apply filters' }))
    expect(input.onApply).toHaveBeenCalledTimes(1)
    view.unmount()
    await act(async () => {
      resolve(true)
      await request
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('dismisses when Tab leaves the popover without stealing focus from the next control', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>Catalog prefixes</button>
          {open ? (
            <LabelCatalogPrefixPopover
              {...props({ onCancel: () => setOpen(false) })}
            />
          ) : null}
          <button>Next control</button>
        </>
      )
    }
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Catalog prefixes' }))
    screen.getByRole('button', { name: 'Apply filters' }).focus()
    await user.tab()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next control' })).toHaveFocus()
  })
  it('closes instead of reopening when the active trigger is clicked again', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen((previous) => !previous)}>
            Catalog prefixes
          </button>
          {open ? (
            <LabelCatalogPrefixPopover
              {...props({ onCancel: () => setOpen(false) })}
            />
          ) : null}
        </>
      )
    }
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Catalog prefixes' })
    await user.click(trigger)
    expect(screen.getByRole('dialog')).toBeVisible()
    await user.click(trigger)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})
