import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadTrackStacks } from '../catalog/catalogApi'
import { relationRecords } from '../relations/relationsData'
import { TracksWorkspace } from './TracksWorkspace'
import { trackRecords } from './tracksData'

vi.mock('../catalog/catalogApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../catalog/catalogApi')>()),
  loadTrackStacks: vi.fn().mockResolvedValue({ items: [] }),
}))
vi.mock('../catalog/api/settingsClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../catalog/api/settingsClient')>()),
  loadTrackStackSettings: vi
    .fn()
    .mockResolvedValue({ relationTypeCodes: ['versionOf'] }),
}))
const tracks = trackRecords.slice(0, 2)
const relation = {
  ...relationRecords[0],
  id: 'version',
  relationType: 'Version of',
  source: tracks[0].title,
  target: tracks[1].title,
  sourceLink: { kind: 'track' as const, id: tracks[0].id },
  targetLink: { kind: 'track' as const, id: tracks[1].id },
}

beforeEach(() => vi.clearAllMocks())

describe('contextual track relationship stack refresh', () => {
  it.each(['add', 'update', 'delete'] as const)(
    'reloads stacks after successful %s, not after failure',
    async (operation) => {
      const mutate = vi
        .fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)
      const props = {
        onAddRelation: vi.fn().mockResolvedValue(true),
        onUpdateRelation: vi.fn().mockResolvedValue(true),
        onDeleteRelation: vi.fn().mockResolvedValue(true),
      }
      if (operation === 'add') props.onAddRelation = mutate
      if (operation === 'update') props.onUpdateRelation = mutate
      if (operation === 'delete') props.onDeleteRelation = mutate
      render(
        <TracksWorkspace
          {...props}
          tracks={tracks}
          relations={operation === 'add' ? [] : [relation]}
          serverBackedCatalog
          locationSearch={`?track=${tracks[0].id}`}
        />,
      )
      await waitFor(() => expect(loadTrackStacks).toHaveBeenCalledTimes(1))
      await userEvent.click(
        screen.getByRole('button', { name: 'Manage relationships' }),
      )
      if (operation === 'add') {
        await userEvent.click(
          screen.getByRole('button', { name: 'Add relationship' }),
        )
        await userEvent.selectOptions(
          screen.getByLabelText('Existing target'),
          `track:${tracks[1].id}`,
        )
        await userEvent.selectOptions(
          within(screen.getByRole('dialog')).getByLabelText('Relation type'),
          'Version of',
        )
      } else {
        await userEvent.click(
          screen.getByRole('button', {
            name: `${operation === 'update' ? 'Edit' : 'Remove'} relationship ${tracks[0].title} to ${tracks[1].title}`,
          }),
        )
      }
      const submit =
        operation === 'delete'
          ? 'Remove relationship'
          : operation === 'add'
            ? 'Add record'
            : 'Save record'
      await userEvent.click(screen.getByRole('button', { name: submit }))
      await screen.findByRole('alert')
      expect(loadTrackStacks).toHaveBeenCalledTimes(1)
      await userEvent.click(screen.getByRole('button', { name: submit }))
      await waitFor(() => expect(loadTrackStacks).toHaveBeenCalledTimes(2))
    },
  )
  it('does not expose editing without all mutation callbacks', () => {
    render(
      <TracksWorkspace
        tracks={tracks}
        onAddRelation={vi.fn()}
        locationSearch={`?track=${tracks[0].id}`}
      />,
    )
    expect(
      screen.queryByRole('button', { name: 'Manage relationships' }),
    ).not.toBeInTheDocument()
  })
})
