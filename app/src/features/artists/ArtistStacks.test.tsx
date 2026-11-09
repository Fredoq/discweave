import { useEffect, useState } from 'react'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ArtistsWorkspace } from './ArtistsWorkspace'
import { artistRecords } from './artistsData'
import { relationRecords } from '../relations/relationsData'

vi.mock('../ratings/ratingAverages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../ratings/ratingAverages')>()),
  useTrackStatsByTarget: () => new Map(),
}))
const artists = [
  {
    ...artistRecords[0],
    id: 'person',
    name: 'Real Person',
    type: 'Person' as const,
    aliases: [],
    relations: [],
  },
  {
    ...artistRecords[0],
    id: 'alias',
    name: 'Stage Name',
    type: 'Alias' as const,
    aliases: [],
    relations: [],
  },
  {
    ...artistRecords[0],
    id: 'group',
    name: 'Shared Group',
    type: 'Band' as const,
    aliases: [],
    relations: [],
  },
]
const relations = [
  {
    ...relationRecords[0],
    id: 'alias-link',
    sourceLink: { kind: 'artist' as const, id: 'alias' },
    targetLink: { kind: 'artist' as const, id: 'person' },
    relationType: 'Alias of',
  },
  {
    ...relationRecords[0],
    id: 'member-link',
    sourceLink: { kind: 'artist' as const, id: 'person' },
    targetLink: { kind: 'artist' as const, id: 'group' },
    relationType: 'Member of',
  },
]

describe('artist stack browsing', () => {
  it('finds the family by alias and selects a related artist outside the filter', () => {
    window.history.replaceState({}, '', '/artists')
    render(<ArtistsWorkspace artists={artists} relations={relations} />)
    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search artists' }),
      { target: { value: 'Stage Name' } },
    )
    const list = screen.getByRole('list', { name: 'Artist master list' })
    expect(
      within(list).getByRole('button', { name: /Real Person.*artist row/ }),
    ).toBeInTheDocument()
    fireEvent.click(within(list).getByText(/Explore Real Person/))
    fireEvent.click(within(list).getByRole('button', { name: 'Shared Group' }))
    expect(window.location.search).toBe('?artist=group')
    expect(
      screen.getByRole('searchbox', { name: 'Search artists' }),
    ).toHaveValue('Stage Name')
    expect(
      screen.getByRole('heading', { name: 'Shared Group' }),
    ).toBeInTheDocument()
  })
  it('restores out-of-filter related artists through Back and Forward', async () => {
    window.history.replaceState({}, '', '/artists')
    const secondGroup = {
      ...artists[2],
      id: 'second-group',
      name: 'Second Group',
    }
    const historyArtists = [...artists, secondGroup]
    const historyRelations = [
      ...relations,
      {
        ...relations[1],
        id: 'second-member',
        targetLink: { kind: 'artist' as const, id: secondGroup.id },
      },
    ]
    function HistoryWorkspace() {
      const [search, setSearch] = useState(window.location.search)
      useEffect(() => {
        const update = () => setSearch(window.location.search)
        window.addEventListener('popstate', update)
        window.addEventListener('discweave:navigation', update)
        return () => {
          window.removeEventListener('popstate', update)
          window.removeEventListener('discweave:navigation', update)
        }
      }, [])
      return (
        <ArtistsWorkspace
          artists={historyArtists}
          relations={historyRelations}
          locationSearch={search}
        />
      )
    }
    render(<HistoryWorkspace />)
    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search artists' }),
      { target: { value: 'Stage Name' } },
    )
    const list = screen.getByRole('list', { name: 'Artist master list' })
    fireEvent.click(within(list).getByText(/Explore Real Person/))
    fireEvent.click(within(list).getByRole('button', { name: 'Shared Group' }))
    fireEvent.click(within(list).getByRole('button', { name: 'Second Group' }))
    expect(
      screen.getByRole('heading', { name: 'Second Group' }),
    ).toBeInTheDocument()
    act(() => {
      window.history.back()
    })
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Shared Group' }),
      ).toBeInTheDocument(),
    )
    expect(window.location.search).toBe('?artist=group')
    act(() => {
      window.history.back()
    })
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Real Person' }),
      ).toBeInTheDocument(),
    )
    expect(window.location.search).toBe('')
    act(() => {
      window.history.forward()
    })
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Shared Group' }),
      ).toBeInTheDocument(),
    )
    expect(window.location.search).toBe('?artist=group')
    act(() => {
      window.history.forward()
    })
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Second Group' }),
      ).toBeInTheDocument(),
    )
    expect(window.location.search).toBe('?artist=second-group')
    expect(
      screen.getByRole('searchbox', { name: 'Search artists' }),
    ).toHaveValue('Stage Name')
  })
  it('expands connections lazily and stops cycles without changing records', async () => {
    render(<ArtistsWorkspace artists={artists} relations={relations} />)
    const list = screen.getByRole('list', { name: 'Artist master list' })
    fireEvent.click(within(list).getByText(/Explore Real Person/))
    expect(
      within(list).queryByText('Already shown in this branch'),
    ).not.toBeInTheDocument()
    const branch = within(list)
      .getByText('Connections of Stage Name')
      .closest('details')!
    branch.open = true
    fireEvent(branch, new Event('toggle'))
    expect(
      await within(branch).findByText('Already shown in this branch'),
    ).toBeInTheDocument()
  })
})
