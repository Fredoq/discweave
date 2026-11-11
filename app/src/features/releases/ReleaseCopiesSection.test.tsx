import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultCatalogDictionaries } from '../catalog/catalogApi'
import {
  ownedItemRecords,
  type OwnedItemRecord,
} from '../ownedItems/ownedItemsData'
import { releaseRecords, type ReleaseRecord } from './releasesData'
import { ReleaseCopiesSection } from './ReleaseCopiesSection'

const release: ReleaseRecord = { ...releaseRecords[0], ownedCopies: [] }
function copy(overrides: Partial<OwnedItemRecord> = {}): OwnedItemRecord {
  return {
    ...ownedItemRecords[0],
    id: 'copy-1',
    releaseId: release.id,
    targetId: release.id,
    title: release.title,
    releaseTitle: release.title,
    medium: 'Vinyl',
    mediumType: 'vinyl',
    status: 'Owned',
    copyNotes: 'Original note',
    ...overrides,
  }
}
function props(items: OwnedItemRecord[] = []) {
  return {
    release,
    items,
    dictionaries: defaultCatalogDictionaries,
    playlists: [],
    relations: [],
    tracks: [],
  }
}
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Release copies', () => {
  it('deduplicates summary copies and never borrows copies from another edition with the same title', () => {
    const item = copy()
    render(
      <ReleaseCopiesSection
        {...props([
          item,
          copy({ id: 'other-copy', releaseId: 'other-edition' }),
        ])}
        release={{
          ...release,
          ownedCopies: [
            {
              id: item.id,
              medium: 'Vinyl',
              status: 'Owned',
              storage: '',
              condition: '',
              note: '',
            },
          ],
        }}
      />,
    )
    expect(
      screen.getByRole('heading', { name: 'Copies (1)' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(1)
  })

  it('preserves full digital coverage details and inventory deep links', async () => {
    const user = userEvent.setup()
    const item = copy({
      medium: 'Digital',
      mediumType: 'digital',
      digitalDetails: {
        releaseTrackCount: 2,
        linkedFileCount: 0,
        missingFileCount: 2,
        files: [],
      },
    })
    render(<ReleaseCopiesSection {...props([item])} />)
    await user.click(screen.getByRole('button', { name: 'Details for copy 1' }))
    const dialog = screen.getByRole('dialog', { name: 'Copy details' })
    expect(
      within(dialog).getByRole('heading', { name: 'Track file coverage' }),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText('2 release tracks missing local files.'),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('link', { name: 'Open in inventory' }),
    ).toHaveAttribute('href', '/owned-items?ownedItem=copy-1')
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(
      screen.getByRole('button', { name: 'Details for copy 1' }),
    ).toHaveFocus()
  })

  it('adds a release-scoped copy only once and leaves the form open after failed persistence', async () => {
    const user = userEvent.setup()
    let complete: ((value: boolean) => void) | undefined
    const save = vi.fn<(item: OwnedItemRecord) => Promise<boolean>>(
      () =>
        new Promise<boolean>((resolve) => {
          complete = resolve
        }),
    )
    render(<ReleaseCopiesSection {...props()} onAddOwnedItem={save} />)
    await user.click(screen.getByRole('button', { name: 'Add copy' }))
    const form = screen.getByRole('form', { name: 'Add copy' })
    expect(
      within(form).queryByRole('combobox', { name: 'Existing release' }),
    ).not.toBeInTheDocument()
    await user.click(within(form).getByRole('button', { name: 'Add copy' }))
    expect(save).toHaveBeenCalledOnce()
    expect(save.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ releaseId: release.id, title: release.title }),
    )
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled()
    await act(async () => {
      complete?.(false)
      await Promise.resolve()
    })
    expect(screen.getByRole('form', { name: 'Add copy' })).toBeInTheDocument()
    expect(within(form).getByRole('alert')).toBeInTheDocument()
    await user.click(within(form).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('edits the persisted copy note and closes only after successful save', async () => {
    const user = userEvent.setup()
    const update = vi.fn().mockResolvedValue(true)
    const item = copy({ digitizationState: 'Not the saved note' })
    render(
      <ReleaseCopiesSection {...props([item])} onUpdateOwnedItem={update} />,
    )
    await user.click(screen.getByRole('button', { name: 'Edit copy 1' }))
    const form = screen.getByRole('form', { name: 'Edit copy' })
    const note = within(form).getByRole('textbox', { name: 'Copy note' })
    expect(note).toHaveValue('Original note')
    await user.clear(note)
    await user.type(note, 'Changed note')
    await user.click(within(form).getByRole('button', { name: 'Save copy' }))
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: item.id,
        copyNotes: 'Changed note',
        acquisition: item.acquisition,
        tags: item.tags,
      }),
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('requires deletion confirmation and retains the copy on failed deletion', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const remove = vi.fn().mockResolvedValue(false)
    render(
      <ReleaseCopiesSection {...props([copy()])} onDeleteOwnedItem={remove} />,
    )
    await user.click(screen.getByRole('button', { name: 'Delete copy 1' }))
    expect(remove).not.toHaveBeenCalled()
    confirm.mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: 'Delete copy 1' }))
    expect(remove).toHaveBeenCalledWith('copy-1')
    expect(screen.getByRole('alert')).toHaveTextContent('could not be deleted')
    expect(screen.getByRole('article')).toBeInTheDocument()
    remove.mockResolvedValue(true)
    await user.click(screen.getByRole('button', { name: 'Delete copy 1' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not let completion from a previous release close the new release editor', async () => {
    const user = userEvent.setup()
    let finish: ((value: boolean) => void) | undefined
    const save = vi.fn<(item: OwnedItemRecord) => Promise<boolean>>(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve
        }),
    )
    const { rerender } = render(
      <ReleaseCopiesSection
        key={release.id}
        {...props()}
        onAddOwnedItem={save}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Add copy' }))
    await user.click(
      within(screen.getByRole('form')).getByRole('button', {
        name: 'Add copy',
      }),
    )
    const next = { ...release, id: 'next-release', title: 'Next release' }
    rerender(
      <ReleaseCopiesSection
        key={next.id}
        {...props()}
        release={next}
        onAddOwnedItem={save}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Add copy' }))
    await act(async () => {
      finish?.(true)
      await Promise.resolve()
    })
    expect(screen.getByRole('form', { name: 'Add copy' })).toBeInTheDocument()
    expect(
      within(screen.getByRole('form')).getByText('Next release'),
    ).toBeInTheDocument()
  })
})
