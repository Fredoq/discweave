import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultCatalogDictionaries } from '../catalog/catalogApi'
import { releaseRecords } from '../releases/releasesData'
import { OwnedItemEntryForm } from './OwnedItemEntryForm'
import type { OwnedItemRecord } from './ownedItemsData'

const release = releaseRecords[0]
const physical: OwnedItemRecord = {
  id: 'copy-one',
  title: 'My CD copy',
  releaseId: release.id,
  targetId: release.id,
  releaseTitle: release.title,
  artist: release.artist,
  medium: 'CD',
  mediumType: 'cd',
  status: 'Owned',
  statusTone: 'green',
  storage: 'Shelf A',
  condition: 'Near Mint',
  acquisition: 'A gift',
  copyNotes: 'Original note',
  linkedType: 'Release',
  fileFormat: 'None recorded',
  digitalState: 'No digital file recorded',
  digitizationState: 'Different derived state',
  tags: ['gift'],
  physicalDetails: {
    discCount: 3,
    storageLocation: 'Shelf A',
    condition: 'Near Mint',
    name: 'Box set',
  },
}
const digital: OwnedItemRecord = {
  ...physical,
  id: 'digital-one',
  medium: 'Digital',
  mediumType: 'digital',
  physicalDetails: undefined,
  storage: '2 local files linked',
  condition: '2 / 3 files linked',
  fileFormat: 'FLAC',
  digitalState: '2 / 3 files linked',
  digitalDetails: {
    releaseTrackCount: 3,
    linkedFileCount: 2,
    missingFileCount: 1,
    files: [],
  },
}
const baseProps = {
  dictionaries: defaultCatalogDictionaries,
  items: [physical, digital],
  releases: [release],
  onCancel: vi.fn(),
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('OwnedItemEntryForm', () => {
  it('scopes a new copy to its release and pre-fills the name', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn<(item: OwnedItemRecord) => void>()
    render(
      <OwnedItemEntryForm
        {...baseProps}
        scopedRelease={release}
        onSubmit={onSubmit}
      />,
    )
    expect(screen.queryByLabelText('Item name')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Add copy' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Existing release')).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Medium'), 'CD')
    await user.selectOptions(
      screen.getByLabelText('Ownership status'),
      'Wanted',
    )
    await user.click(screen.getByRole('button', { name: 'Add copy' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        releaseId: release.id,
        status: 'Wanted',
        medium: 'CD',
      }),
    )
  })

  it('requires an explicit ownership status before submitting a new copy', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <OwnedItemEntryForm
        {...baseProps}
        scopedRelease={release}
        onSubmit={onSubmit}
      />,
    )
    expect(screen.getByRole('button', { name: 'Add copy' })).toBeDisabled()
    fireEvent.submit(screen.getByRole('form', { name: 'Add copy' }))
    expect(onSubmit).not.toHaveBeenCalled()
    await user.selectOptions(screen.getByLabelText('Ownership status'), 'Owned')
    await user.click(screen.getByRole('button', { name: 'Add copy' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Owned' }),
    )
  })

  it('uses a custom dictionary medium profile instead of its label', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const dictionaries = {
      ...defaultCatalogDictionaries,
      mediaType: [
        ...defaultCatalogDictionaries.mediaType,
        {
          ...defaultCatalogDictionaries.mediaType[0],
          id: 'download-medium',
          code: 'download',
          name: 'Download',
          mediaProfile: 'digital',
        },
      ],
    }
    render(
      <OwnedItemEntryForm
        {...baseProps}
        dictionaries={dictionaries}
        initialItem={physical}
        onSubmit={onSubmit}
      />,
    )
    await user.selectOptions(screen.getByLabelText('Medium'), 'Download')
    expect(screen.queryByLabelText('Storage location')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Condition')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save record' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        medium: 'Download',
        mediumType: 'digital',
        physicalDetails: undefined,
      }),
    )
  })

  it('preserves physical details when changing a label within the same medium type', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn<(item: OwnedItemRecord) => void>()
    render(
      <OwnedItemEntryForm
        {...baseProps}
        initialItem={{ ...physical, medium: 'Archived 3xCD' }}
        onSubmit={onSubmit}
      />,
    )
    await user.selectOptions(screen.getByLabelText('Medium'), 'CD')
    await user.click(screen.getByRole('button', { name: 'Save record' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        medium: 'CD',
        mediumType: 'cd',
      }),
    )
    expect(onSubmit.mock.calls[0][0].physicalDetails).toMatchObject({
      discCount: 3,
      name: 'Box set',
    })
  })

  it('edits the actual note and preserves metadata not edited by the form', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn<(item: OwnedItemRecord) => void>()
    render(
      <OwnedItemEntryForm
        {...baseProps}
        initialItem={physical}
        scopedRelease={release}
        onSubmit={onSubmit}
      />,
    )
    expect(screen.getByLabelText('Copy note')).toHaveValue('Original note')
    await user.clear(screen.getByLabelText('Copy note'))
    await user.type(screen.getByLabelText('Storage location'), '2')
    await user.click(screen.getByRole('button', { name: 'Save copy' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        copyNotes: '',
        acquisition: 'A gift',
        tags: ['gift'],
        storage: 'Shelf A2',
      }),
    )
    expect(onSubmit.mock.calls[0][0].physicalDetails).toMatchObject({
      discCount: 3,
      name: 'Box set',
      storageLocation: 'Shelf A2',
    })
  })

  it('preserves digital coverage and display state on a note-only edit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn<(item: OwnedItemRecord) => void>()
    render(
      <OwnedItemEntryForm
        {...baseProps}
        initialItem={digital}
        onSubmit={onSubmit}
      />,
    )
    expect(screen.queryByLabelText('Storage location')).not.toBeInTheDocument()
    await user.clear(screen.getByLabelText('Digital copy note'))
    await user.type(screen.getByLabelText('Digital copy note'), 'Checked files')
    await user.click(screen.getByRole('button', { name: 'Save record' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        copyNotes: 'Checked files',
        digitalDetails: digital.digitalDetails,
        fileFormat: 'FLAC',
        digitalState: digital.digitalState,
        acquisition: 'A gift',
        tags: ['gift'],
      }),
    )
  })

  it('blocks duplicate submit and cancel while awaiting save, then retains values after failure', async () => {
    let finish: ((value: boolean) => void) | undefined
    const user = userEvent.setup()
    const onSubmit = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve
        }),
    )
    const onCancel = vi.fn()
    const onPendingChange = vi.fn()
    render(
      <OwnedItemEntryForm
        {...baseProps}
        onCancel={onCancel}
        scopedRelease={release}
        onSubmit={onSubmit}
        onPendingChange={onPendingChange}
      />,
    )
    await user.selectOptions(screen.getByLabelText('Ownership status'), 'Owned')
    await user.type(screen.getByLabelText('Copy note'), 'Keep this draft')
    await user.click(screen.getByRole('button', { name: 'Add copy' }))
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    fireEvent.submit(screen.getByRole('form', { name: 'Add copy' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    await act(async () => {
      finish?.(false)
      await Promise.resolve()
    })
    expect(screen.getByRole('alert')).toHaveTextContent('could not be saved')
    expect(screen.getByLabelText('Copy note')).toHaveValue('Keep this draft')
    expect(onCancel).not.toHaveBeenCalled()
    expect(onPendingChange.mock.calls).toEqual([[true], [false]])
  })

  it('shows rejected save errors and permits retry', async () => {
    const user = userEvent.setup()
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error('Storage unavailable'))
      .mockResolvedValueOnce(true)
    render(
      <OwnedItemEntryForm
        {...baseProps}
        initialItem={physical}
        onSubmit={onSubmit}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Save record' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Storage unavailable',
    )
    await user.click(screen.getByRole('button', { name: 'Save record' }))
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    )
    expect(onSubmit).toHaveBeenCalledTimes(2)
  })

  it('requires confirmation before removing digital file links by changing medium', async () => {
    const user = userEvent.setup()
    const confirm = vi
      .spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
    const onSubmit = vi.fn<(item: OwnedItemRecord) => void>()
    render(
      <OwnedItemEntryForm
        {...baseProps}
        initialItem={digital}
        onSubmit={onSubmit}
      />,
    )
    await user.selectOptions(screen.getByLabelText('Medium'), 'CD')
    await user.click(screen.getByRole('button', { name: 'Save record' }))
    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining('audio files themselves will not be deleted'),
    )
    expect(onSubmit).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Save record' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        medium: 'CD',
        digitalDetails: undefined,
        physicalDetails: undefined,
        fileFormat: 'None recorded',
      }),
    )
  })

  it('preserves an inactive original medium and supports cancellation without saving', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const onSubmit = vi.fn<(item: OwnedItemRecord) => void>()
    render(
      <OwnedItemEntryForm
        {...baseProps}
        initialItem={{ ...physical, medium: 'Archived 3xCD' }}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />,
    )
    expect(screen.getByLabelText('Medium')).toHaveValue('Archived 3xCD')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('refuses a mismatched scoped copy rather than moving it to another edition', () => {
    render(
      <OwnedItemEntryForm
        {...baseProps}
        initialItem={physical}
        scopedRelease={{ ...release, id: 'another-edition' }}
        onSubmit={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Save copy' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('different release')
  })
})
