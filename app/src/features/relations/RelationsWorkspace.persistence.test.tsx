import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RelationsWorkspace } from './RelationsWorkspace'
import { toArtistRelationRecord } from '../catalog/api/catalogEntityMappers'
import { defaultCatalogDictionaries } from '../catalog/catalogApi'
import type { ArtistRecord } from '../artists/artistsData'

const artists: ArtistRecord[] = ['A', 'B'].map((name) => ({
  id: name,
  name,
  type: 'Person',
  identityHint: null,
  aliases: [],
  members: [],
  relationHint: '',
  creditHint: '',
  relations: [],
  credits: [],
  tags: [],
  summary: '',
}))
const relation = toArtistRelationRecord(
  {
    id: 'rel',
    sourceArtistId: 'A',
    targetArtistId: 'B',
    sourceArtistName: 'A',
    targetArtistName: 'B',
    type: 'memberOf',
    startYear: 1990,
    endYear: null,
  },
  new Map(),
  defaultCatalogDictionaries,
)

describe('Relations workspace persistence failures', () => {
  it('keeps the editor and changed period when persistence fails', async () => {
    const user = userEvent.setup()
    const update = vi.fn().mockResolvedValue(false)
    render(
      <RelationsWorkspace
        artists={artists}
        relations={[relation]}
        locationSearch="?relation=rel"
        onUpdateRelation={update}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Edit record' }))
    await user.clear(screen.getByLabelText('Start year'))
    await user.type(screen.getByLabelText('Start year'), '1991')
    await user.click(screen.getByRole('button', { name: 'Save record' }))
    await screen.findByRole('alert')
    expect(screen.getByLabelText('Start year')).toHaveValue(1991)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ startYear: 1991 }),
    )
  })
  it('shows deletion rejection and retains the existing relation', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(
      <RelationsWorkspace
        artists={artists}
        relations={[relation]}
        locationSearch="?relation=rel"
        onDeleteRelation={vi
          .fn()
          .mockRejectedValue(new Error('Synthetic delete failure'))}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Delete record' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Synthetic delete failure',
    )
    expect(
      screen.getByRole('button', { name: 'Edit record' }),
    ).toBeInTheDocument()
    confirm.mockRestore()
  })
})

it('preserves a different relation editor and search when a deletion completes', async () => {
  const user = userEvent.setup()
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  let complete!: (value: boolean) => void
  const pending = new Promise<boolean>((resolve) => {
    complete = resolve
  })
  const other = { ...relation, id: 'other' }
  const props = {
    artists,
    relations: [relation, other],
    onDeleteRelation: () => pending,
  }
  const view = render(
    <RelationsWorkspace {...props} locationSearch="?relation=rel" />,
  )
  await user.click(screen.getByRole('button', { name: 'Delete record' }))
  view.rerender(
    <RelationsWorkspace {...props} locationSearch="?relation=other" />,
  )
  await user.click(screen.getByRole('button', { name: 'Edit record' }))
  fireEvent.change(screen.getByLabelText('Start year'), {
    target: { value: '1999' },
  })
  fireEvent.change(
    screen.getByRole('searchbox', { name: 'Search relations' }),
    { target: { value: 'A' } },
  )
  await act(async () => {
    complete(true)
    await pending
  })
  expect(screen.getByLabelText('Start year')).toHaveValue(1999)
  expect(
    screen.getByRole('searchbox', { name: 'Search relations' }),
  ).toHaveValue('A')
  confirm.mockRestore()
})
