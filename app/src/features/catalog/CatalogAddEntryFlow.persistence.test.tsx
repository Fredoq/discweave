import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { CatalogAddEntryFlow } from './CatalogAddEntryFlow'
import { defaultCatalogDictionaries } from './catalogApi'

vi.mock('../ownedItems/OwnedItemsWorkspace', () => ({
  OwnedItemEntryForm: ({
    onSubmit,
  }: {
    onSubmit: (value: object) => unknown
  }) => <button onClick={() => void onSubmit({})}>Save copy</button>,
}))
vi.mock('../relations/RelationEntryForm', () => ({
  RelationEntryForm: ({
    onSubmit,
  }: {
    onSubmit: (value: object) => unknown
  }) => <button onClick={() => void onSubmit({})}>Save relation</button>,
}))
afterEach(cleanup)
it.each(['owned item', 'relation'])(
  'ignores the old %s completion after a new flow opens',
  async (kind) => {
    let complete!: (value: boolean) => void
    const pending = new Promise<boolean>((resolve) => {
      complete = resolve
    })
    const cancel = vi.fn()
    const props = {
      artists: [],
      dictionaries: defaultCatalogDictionaries,
      labels: [],
      ownedItems: [],
      playlists: [],
      relations: [],
      releases: [],
      tracks: [],
      onAddArtist: vi.fn(),
      onAddLabel: vi.fn(),
      onAddRelease: vi.fn(),
      onAddTrack: vi.fn(),
      onAddOwnedItem: () => pending,
      onAddRelation: () => pending,
      onCancel: cancel,
    }
    const first = render(<CatalogAddEntryFlow {...props} />)
    fireEvent.click(
      screen.getByRole('button', { name: `Create ${kind} entry` }),
    )
    fireEvent.click(
      screen.getByRole('button', {
        name: kind === 'relation' ? 'Save relation' : 'Save copy',
      }),
    )
    first.unmount()
    render(<CatalogAddEntryFlow {...props} />)
    await act(async () => {
      complete(true)
      await pending
    })
    expect(cancel).not.toHaveBeenCalled()
    expect(
      screen.getByRole('region', { name: 'Add catalog entry' }),
    ).toBeInTheDocument()
  },
)
