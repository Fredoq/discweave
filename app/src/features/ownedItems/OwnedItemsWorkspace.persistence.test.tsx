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

it('does not let an old update close a newer copy editor or reset its search', async () => {
  const user = userEvent.setup()
  let complete!: (value: boolean) => void
  const pending = new Promise<boolean>((resolve) => {
    complete = resolve
  })
  const update = vi.fn(() => pending)
  const props = {
    items: [first, second],
    releases: releaseRecords,
    onUpdateItem: update,
  }
  const view = render(
    <OwnedItemsWorkspace {...props} locationSearch="?ownedItem=copy-a" />,
  )
  await user.click(screen.getByRole('button', { name: 'Edit record' }))
  await user.click(screen.getByRole('button', { name: 'Save record' }))
  expect(update).toHaveBeenCalledTimes(1)
  view.rerender(
    <OwnedItemsWorkspace {...props} locationSearch="?ownedItem=copy-b" />,
  )
  await user.click(screen.getByRole('button', { name: 'Edit record' }))
  fireEvent.change(screen.getByLabelText('Item name'), {
    target: { value: 'Draft B' },
  })
  fireEvent.change(
    screen.getByRole('searchbox', { name: 'Search owned items' }),
    { target: { value: 'Copy B' } },
  )
  const url = window.location.href
  await act(async () => {
    complete(true)
    await pending
  })
  expect(screen.getByLabelText('Item name')).toHaveValue('Draft B')
  expect(
    screen.getByRole('searchbox', { name: 'Search owned items' }),
  ).toHaveValue('Copy B')
  expect(window.location.href).toBe(url)
})

it.each(['reopen', 'unmount'] as const)(
  'ignores old create completion after %s',
  async (mode) => {
    const user = userEvent.setup()
    let complete!: (value: string) => void
    const pending = new Promise<string>((resolve) => {
      complete = resolve
    })
    const close = vi.fn()
    const create = vi.fn(() => pending)
    const props = {
      releases: releaseRecords,
      onAddItem: create,
      onManualEntryClose: close,
    }
    const view = render(<OwnedItemsWorkspace {...props} isManualEntryOpen />)
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
    if (mode === 'unmount') {
      view.unmount()
      render(<OwnedItemsWorkspace {...props} isManualEntryOpen />)
    } else {
      view.rerender(
        <OwnedItemsWorkspace {...props} isManualEntryOpen={false} />,
      )
      view.rerender(<OwnedItemsWorkspace {...props} isManualEntryOpen />)
    }
    fireEvent.change(screen.getByLabelText('Item name'), {
      target: { value: 'New draft' },
    })
    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search owned items' }),
      { target: { value: 'Current search' } },
    )
    const url = window.location.href
    await act(async () => {
      complete('persisted-old-id')
      await pending
    })
    expect(close).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Item name')).toHaveValue('New draft')
    expect(
      screen.getByRole('searchbox', { name: 'Search owned items' }),
    ).toHaveValue('Current search')
    expect(window.location.href).toBe(url)
  },
)

it('preserves a search entered while an update is pending', async () => {
  const user = userEvent.setup()
  let complete!: (value: boolean) => void
  const pending = new Promise<boolean>((resolve) => {
    complete = resolve
  })
  const update = vi.fn(() => pending)
  render(
    <OwnedItemsWorkspace
      items={[first]}
      releases={releaseRecords}
      onUpdateItem={update}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Edit record' }))
  await user.click(screen.getByRole('button', { name: 'Save record' }))
  expect(update).toHaveBeenCalledTimes(1)
  fireEvent.change(
    screen.getByRole('searchbox', { name: 'Search owned items' }),
    { target: { value: 'Copy A' } },
  )
  await act(async () => {
    complete(true)
    await pending
  })
  expect(
    screen.getByRole('searchbox', { name: 'Search owned items' }),
  ).toHaveValue('Copy A')
  expect(screen.getByLabelText('Item name')).toHaveValue('Copy A')
})
