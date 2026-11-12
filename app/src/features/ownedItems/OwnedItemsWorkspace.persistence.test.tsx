import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { OwnedItemsWorkspace } from './OwnedItemsWorkspace'
import { ownedItemRecords } from './ownedItemsData'
import { releaseRecords } from '../releases/releasesData'

const first = { ...ownedItemRecords[0], id: 'copy-a', title: 'Copy A' }
const second = { ...ownedItemRecords[0], id: 'copy-b', title: 'Copy B' }
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  window.history.replaceState({}, '', '/')
})
it('guards a pending deletion and preserves another copy editor and query', async () => {
  const user = userEvent.setup()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  let complete!: (value: boolean) => void
  const pending = new Promise<boolean>((resolve) => {
    complete = resolve
  })
  const remove = vi.fn(() => pending)
  const view = render(
    <OwnedItemsWorkspace
      items={[first, second]}
      releases={releaseRecords}
      locationSearch="?ownedItem=copy-a"
      onDeleteItem={remove}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Delete record' }))
  await user.click(screen.getByRole('button', { name: 'Delete record' }))
  expect(remove).toHaveBeenCalledTimes(1)
  view.rerender(
    <OwnedItemsWorkspace
      items={[first, second]}
      releases={releaseRecords}
      locationSearch="?ownedItem=copy-b"
      onDeleteItem={remove}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Edit record' }))
  fireEvent.change(screen.getByLabelText('Item name'), {
    target: { value: 'Draft B' },
  })
  fireEvent.change(
    screen.getByRole('searchbox', { name: 'Search owned items' }),
    { target: { value: 'Copy B' } },
  )
  await act(async () => {
    complete(true)
    await pending
  })
  expect(screen.getByLabelText('Item name')).toHaveValue('Draft B')
  expect(
    screen.getByRole('searchbox', { name: 'Search owned items' }),
  ).toHaveValue('Copy B')
})
it.each([false, true])(
  'releases the deletion guard after result %s',
  async (result) => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const remove = vi.fn().mockResolvedValue(result)
    render(
      <OwnedItemsWorkspace
        items={[first]}
        locationSearch="?ownedItem=copy-a"
        onDeleteItem={remove}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Delete record' }))
    await user.click(screen.getByRole('button', { name: 'Delete record' }))
    expect(remove).toHaveBeenCalledTimes(2)
  },
)
it('selects the server-assigned copy id after create', async () => {
  const user = userEvent.setup()
  const create = vi.fn().mockResolvedValue('persisted-id')
  render(
    <OwnedItemsWorkspace
      isManualEntryOpen
      releases={releaseRecords}
      onAddItem={create}
    />,
  )
  await user.type(screen.getByLabelText('Item name'), 'New copy')
  await user.selectOptions(
    screen.getByLabelText('Existing release'),
    releaseRecords[0].id,
  )
  await user.selectOptions(screen.getAllByLabelText('Medium').at(-1)!, 'CD')
  await user.selectOptions(
    screen.getAllByLabelText('Ownership status').at(-1)!,
    'Owned',
  )
  await user.click(screen.getByRole('button', { name: 'Add record' }))
  expect(create).toHaveBeenCalledTimes(1)
  expect(new URLSearchParams(window.location.search).get('ownedItem')).toBe(
    'persisted-id',
  )
})
