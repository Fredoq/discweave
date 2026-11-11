import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { defaultCatalogDictionaries } from '../catalog/catalogApi'
import { ContextualRelations } from './RelationManagerDialog'
import { relationRecords } from './relationsData'
const links = ['a', 'b', 'c'].map((id) => ({
  kind: 'artist' as const,
  id,
  value: `artist:${id}`,
  name: id.toUpperCase(),
  label: id.toUpperCase(),
  typeLabel: 'Artist',
}))
const relation = {
  ...relationRecords[0],
  id: 'ab',
  source: 'A',
  target: 'B',
  sourceLink: { kind: 'artist' as const, id: 'a' },
  targetLink: { kind: 'artist' as const, id: 'b' },
  relationType: 'Alias of',
}
function setup(overrides = {}) {
  const callbacks = {
    onAddRelation: vi.fn().mockResolvedValue(true),
    onUpdateRelation: vi.fn().mockResolvedValue(true),
    onDeleteRelation: vi.fn().mockResolvedValue(true),
  }
  render(
    <ContextualRelations
      context={{ kind: 'artist', id: 'a' }}
      name="A"
      relations={[
        relation,
        {
          ...relation,
          id: 'bc',
          source: 'B',
          target: 'C',
          sourceLink: links[1],
          targetLink: links[2],
        },
      ]}
      linkOptions={links}
      dictionaries={defaultCatalogDictionaries}
      {...callbacks}
      {...overrides}
    />,
  )
  return callbacks
}
async function open() {
  await userEvent.click(
    screen.getByRole('button', { name: 'Manage relationships' }),
  )
  return screen.getByRole('dialog', { name: 'Relationships: A' })
}
describe('Contextual relationships', () => {
  it('shows only exact persisted links and preserves manager deep links', async () => {
    setup()
    const dialog = await open()
    expect(
      within(dialog).getByRole('link', { name: 'Relation record' }),
    ).toHaveAttribute('href', '/relations?relation=ab')
    expect(
      within(dialog).queryByRole('button', {
        name: 'Edit relationship B to C',
      }),
    ).not.toBeInTheDocument()
    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Manage relationships' }),
    ).toHaveFocus()
  })
  it('preselects source and creates a relationship only on explicit submit', async () => {
    const callbacks = setup()
    await open()
    await userEvent.click(
      screen.getByRole('button', { name: 'Add relationship' }),
    )
    expect(screen.getByLabelText('Existing source')).toHaveValue('artist:a')
    expect(screen.getByLabelText('Existing source')).toBeDisabled()
    await userEvent.selectOptions(
      screen.getByLabelText('Existing target'),
      'artist:c',
    )
    const select = screen.getByLabelText<HTMLSelectElement>('Relation type')
    await userEvent.selectOptions(
      select,
      Array.from(select.options).find((o) => o.value && !o.disabled)!.value,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Add record' }))
    await waitFor(() => expect(callbacks.onAddRelation).toHaveBeenCalledOnce())
    expect(callbacks.onAddRelation.mock.calls[0][0]).toMatchObject({
      sourceLink: { kind: 'artist', id: 'a' },
      targetLink: { kind: 'artist', id: 'c' },
    })
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
  })
  it('retains edits after failed save, succeeds on retry, and cancels without mutation', async () => {
    const update = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true)
    setup({ onUpdateRelation: update })
    await open()
    await userEvent.click(
      screen.getByRole('button', { name: 'Edit relationship A to B' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save record' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'could not be saved',
    )
    expect(screen.getByRole('form')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save record' }))
    await waitFor(() =>
      expect(screen.queryByRole('form')).not.toBeInTheDocument(),
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Edit relationship A to B' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(update).toHaveBeenCalledTimes(2)
  })
  it('requires removal confirmation, retains errors and blocks dismissal during save', async () => {
    let finish!: (result: boolean) => void
    const remove = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve
        }),
    )
    setup({ onDeleteRelation: remove })
    const dialog = await open()
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove relationship A to B' }),
    )
    expect(remove).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove relationship A to B' }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove relationship' }),
    )
    expect(remove).toHaveBeenCalledWith('ab')
    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }))
    expect(dialog).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Close relationships' }),
    ).toBeDisabled()
    finish(false)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'could not be removed',
    )
    expect(
      screen.getByRole('region', { name: 'Remove relationship' }),
    ).toBeInTheDocument()
  })
  it('closes on context navigation and ignores an older pending completion', async () => {
    let finish!: (result: boolean) => void
    const add = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve
        }),
    )
    const base = {
      name: 'A',
      relations: [relation],
      linkOptions: links,
      dictionaries: defaultCatalogDictionaries,
      onAddRelation: add,
      onUpdateRelation: vi.fn().mockResolvedValue(true),
      onDeleteRelation: vi.fn().mockResolvedValue(true),
    }
    const view = render(
      <ContextualRelations {...base} context={{ kind: 'artist', id: 'a' }} />,
    )
    await open()
    await userEvent.click(
      screen.getByRole('button', { name: 'Add relationship' }),
    )
    await userEvent.selectOptions(
      screen.getByLabelText('Existing target'),
      'artist:c',
    )
    const select = screen.getByLabelText<HTMLSelectElement>('Relation type')
    await userEvent.selectOptions(
      select,
      Array.from(select.options).find((o) => o.value && !o.disabled)!.value,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Add record' }))
    view.rerender(
      <ContextualRelations
        {...base}
        name="B"
        context={{ kind: 'artist', id: 'b' }}
      />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: 'Manage relationships' }),
    )
    finish(true)
    await waitFor(() =>
      expect(
        screen.getByRole('dialog', { name: 'Relationships: B' }),
      ).toBeInTheDocument(),
    )
    expect(screen.queryByText('Relationship saved.')).not.toBeInTheDocument()
  })
  it('uses track-only endpoints and offers no artist periods for track relationships', async () => {
    const trackLinks = links.map((link) => ({
      ...link,
      kind: 'track' as const,
      value: `track:${link.id}`,
    }))
    setup({
      context: { kind: 'track', id: 'a' },
      linkOptions: [...links, ...trackLinks],
    })
    await open()
    expect(
      screen.queryByRole('link', { name: 'Relation record' }),
    ).not.toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: 'Add relationship' }),
    )
    expect(screen.getByLabelText('Existing source')).toHaveValue('track:a')
    const target = screen.getByLabelText<HTMLSelectElement>('Existing target')
    expect(
      Array.from(target.options).every(
        (option) => !option.value || option.value.startsWith('track:'),
      ),
    ).toBe(true)
    expect(screen.queryByLabelText('Start year')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('End year')).not.toBeInTheDocument()
  })
  it('shows context once and keeps incoming direction without reversing the recorded type', async () => {
    setup({
      relations: [
        relation,
        {
          ...relation,
          id: 'ca',
          source: 'C',
          target: 'A',
          sourceLink: links[2],
          targetLink: links[0],
          relationType: 'Member of',
        },
      ],
    })
    const dialog = await open()
    expect(within(dialog).getAllByText('A', { exact: true })).toHaveLength(1)
    expect(
      within(dialog).queryByRole('link', { name: 'A' }),
    ).not.toBeInTheDocument()
    expect(
      within(dialog).getByRole('columnheader', { name: 'Direction' }),
    ).toBeInTheDocument()
    const outgoing = within(dialog)
      .getByRole('link', { name: 'B' })
      .closest('tr')!
    expect(within(outgoing).getByText('Outgoing')).toBeInTheDocument()
    const incoming = within(dialog)
      .getByRole('link', { name: 'C' })
      .closest('tr')!
    expect(within(incoming).getByText('Incoming')).toBeInTheDocument()
    expect(within(incoming).getByText('Member of')).toBeInTheDocument()
    expect(within(incoming).getByRole('link', { name: 'C' })).toHaveAttribute(
      'href',
      '/artists?artist=c',
    )
    expect(
      within(incoming).getByRole('link', { name: 'Relation record' }),
    ).toHaveAttribute('href', '/relations?relation=ca')
  })
})
