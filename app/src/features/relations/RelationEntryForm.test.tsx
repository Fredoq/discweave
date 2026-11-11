import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RelationEntryForm } from './RelationEntryForm'
import { defaultCatalogDictionaries } from '../catalog/catalogApi'
import type { CatalogLinkOption } from '../catalog/catalogLinks'
import { toArtistRelationRecord } from '../catalog/api/catalogEntityMappers'

const options: CatalogLinkOption[] = [
  {
    value: 'artist:a',
    kind: 'artist',
    id: 'a',
    name: 'Person A',
    label: 'Artist: Person A',
    typeLabel: 'Artist',
  },
  {
    value: 'artist:b',
    kind: 'artist',
    id: 'b',
    name: 'Group B',
    label: 'Artist: Group B',
    typeLabel: 'Artist',
  },
  {
    value: 'track:t',
    kind: 'track',
    id: 't',
    name: 'Track T',
    label: 'Track: T',
    typeLabel: 'Track',
  },
  {
    value: 'release:r',
    kind: 'release',
    id: 'r',
    name: 'Release R',
    label: 'Release: R',
    typeLabel: 'Release',
  },
]
function base() {
  return {
    dictionaries: defaultCatalogDictionaries,
    linkOptions: options,
    relations: [],
    onCancel: vi.fn(),
    onSubmit: vi.fn(),
  }
}

describe('Relation editor production contract', () => {
  it('does not offer unsaved metadata or unsupported endpoints', async () => {
    const user = userEvent.setup()
    render(<RelationEntryForm {...base()} />)
    expect(screen.queryByLabelText('Role')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Context/evidence')).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText('Existing linked entity'),
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Source')).not.toBeInTheDocument()
    expect(
      within(screen.getByLabelText('Existing source')).queryByRole('option', {
        name: 'Release: R',
      }),
    ).not.toBeInTheDocument()
    await user.selectOptions(
      screen.getByLabelText('Existing source'),
      'artist:a',
    )
    const target = screen.getByLabelText('Existing target')
    expect(
      within(target).queryByRole('option', { name: 'Track: T' }),
    ).not.toBeInTheDocument()
    expect(
      within(target).queryByRole('option', { name: 'Artist: Person A' }),
    ).not.toBeInTheDocument()
    expect(
      within(screen.getByLabelText('Relation type')).queryByRole('option', {
        name: 'Remix of',
      }),
    ).not.toBeInTheDocument()
  })
  it('explains why an unavailable existing type cannot be saved', () => {
    const initial = toArtistRelationRecord(
      {
        id: 'rel',
        sourceArtistId: 'a',
        targetArtistId: 'b',
        sourceArtistName: 'Person A',
        targetArtistName: 'Group B',
        type: 'memberOf',
        startYear: null,
        endYear: null,
      },
      new Map(),
      defaultCatalogDictionaries,
    )
    render(
      <RelationEntryForm
        {...base()}
        initialRelation={{ ...initial, relationType: 'Retired relationship' }}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The existing relationship type is inactive or unavailable. Choose an active type or enable it in Settings.',
    )
    expect(screen.getByRole('button', { name: 'Save record' })).toBeDisabled()
  })
  it('retains artist periods on an unrelated edit and validates ranges', async () => {
    const user = userEvent.setup()
    const props = base()
    const initial = toArtistRelationRecord(
      {
        id: 'rel',
        sourceArtistId: 'a',
        targetArtistId: 'b',
        sourceArtistName: 'Person A',
        targetArtistName: 'Group B',
        type: 'memberOf',
        startYear: 1990,
        endYear: 1995,
      },
      new Map(),
      defaultCatalogDictionaries,
    )
    render(<RelationEntryForm {...props} initialRelation={initial} />)
    expect(screen.getByLabelText('Start year')).toHaveValue(1990)
    await user.click(screen.getByRole('button', { name: 'Save record' }))
    expect(props.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ startYear: 1990, endYear: 1995 }),
    )
    await user.clear(screen.getByLabelText('Start year'))
    await user.type(screen.getByLabelText('Start year'), '2000')
    expect(screen.getByRole('button', { name: 'Save record' })).toBeDisabled()
  })
  it('preselects and locks contextual source without turning add into edit', () => {
    render(
      <RelationEntryForm
        {...base()}
        initialSourceLink={{ kind: 'artist', id: 'a' }}
        lockSource
      />,
    )
    expect(screen.getByLabelText('Existing source')).toHaveValue('artist:a')
    expect(screen.getByLabelText('Existing source')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add record' })).toBeDisabled()
  })
  it('keeps values and reports failure while preventing duplicate pending saves', async () => {
    const user = userEvent.setup()
    let rejectSave: ((error: Error) => void) | undefined
    const onSubmit = vi.fn(
      () =>
        new Promise<boolean>((_resolve, reject) => {
          rejectSave = reject
        }),
    )
    render(
      <RelationEntryForm
        {...base()}
        onSubmit={onSubmit}
        initialSourceLink={{ kind: 'artist', id: 'a' }}
      />,
    )
    await user.selectOptions(
      screen.getByLabelText('Existing target'),
      'artist:b',
    )
    await user.selectOptions(
      screen.getByLabelText('Relation type'),
      'Member of',
    )
    await user.type(screen.getByLabelText('Start year'), '1990')
    await user.click(screen.getByRole('button', { name: 'Add record' }))
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    rejectSave?.(new Error('Synthetic persistence failure'))
    expect(
      await screen.findByText('Synthetic persistence failure'),
    ).toHaveAttribute('role', 'alert')
    expect(screen.getByLabelText('Start year')).toHaveValue(1990)
    expect(screen.getByRole('button', { name: 'Add record' })).toBeEnabled()
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })
  it('treats a false persistence result as failure without clearing edits', async () => {
    const user = userEvent.setup()
    render(
      <RelationEntryForm
        {...base()}
        onSubmit={() => Promise.resolve(false)}
        initialSourceLink={{ kind: 'artist', id: 'a' }}
      />,
    )
    await user.selectOptions(
      screen.getByLabelText('Existing target'),
      'artist:b',
    )
    await user.selectOptions(
      screen.getByLabelText('Relation type'),
      'Member of',
    )
    await user.click(screen.getByRole('button', { name: 'Add record' }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'The relation was not saved',
      ),
    )
    expect(screen.getByLabelText('Existing target')).toHaveValue('artist:b')
  })
})
