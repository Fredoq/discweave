import { useState } from 'react'
import { useAppNavigation } from '../../app/useAppNavigation'
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
import { artistRecords, type ArtistRecord } from './artistsData'
import { relationRecords } from '../relations/relationsData'

vi.mock('../ratings/ratingAverages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../ratings/ratingAverages')>()),
  useTrackStatsByTarget: () => new Map(),
}))

function artist(
  id: string,
  name: string,
  type: ArtistRecord['type'],
): ArtistRecord {
  return {
    ...artistRecords[0],
    id,
    name,
    type,
    identityHint: null,
    aliases: [],
    members: [],
    relations: [],
    credits: [],
  }
}
const artists = [
  artist('person', 'Real Person', 'Person'),
  artist('group', 'Shared Group', 'Band'),
  artist('unrelated', 'Unrelated Artist', 'Person'),
]
const relations = [
  {
    ...relationRecords[0],
    id: 'member-link',
    sourceLink: { kind: 'artist' as const, id: 'person' },
    targetLink: { kind: 'artist' as const, id: 'group' },
    relationType: 'Member of',
  },
]

function HistoryWorkspace({ allowAdd = false }: { allowAdd?: boolean }) {
  const { locationSearch, navigate, navigateToUrl } = useAppNavigation({
    onLocationChange: () => {},
    onNavigate: () => {},
  })
  const [records, setRecords] = useState(artists)
  const [isManualEntryOpen, setManualEntryOpen] = useState(allowAdd)
  return (
    <>
      <button type="button" onClick={() => navigate('/artists')}>
        Artists sidebar
      </button>
      <button
        type="button"
        onClick={() => navigateToUrl('/artists?artist=group')}
      >
        Open group directly
      </button>
      <ArtistsWorkspace
        artists={records}
        relations={relations}
        locationSearch={locationSearch}
        isManualEntryOpen={isManualEntryOpen}
        onAddArtist={(record) => setRecords((current) => [...current, record])}
        onUpdateArtist={(record) =>
          setRecords((current) =>
            current.map((existing) =>
              existing.id === record.id ? record : existing,
            ),
          )
        }
        onManualEntryClose={() => setManualEntryOpen(false)}
      />
    </>
  )
}

function openRelatedGroup() {
  const inspector = screen.getByRole('complementary', { name: 'Real Person' })
  fireEvent.click(
    within(inspector).getByRole('button', { name: 'Open artist Shared Group' }),
  )
  expect(screen.getByRole('heading', { name: 'Shared Group' })).toBeVisible()
  expect(
    within(
      screen.getByRole('navigation', { name: 'Artist context' }),
    ).getByRole('button', { name: 'Real Person' }),
  ).toBeVisible()
}

function expectNoContext() {
  expect(
    screen.queryByRole('navigation', { name: 'Artist context' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: /^Return to / }),
  ).not.toBeInTheDocument()
}

describe('artist context navigation', () => {
  it.each(['Shared Group', 'Unrelated Artist'])(
    'clears relationship context when selecting the ordinary %s row',
    (name) => {
      window.history.replaceState({}, '', '/artists?artist=person')
      render(<HistoryWorkspace />)
      openRelatedGroup()
      const list = screen.getByRole('list', { name: 'Artist master list' })
      fireEvent.click(
        within(list).getByRole('button', { name: `${name} artist row` }),
      )
      expect(screen.getByRole('heading', { name })).toBeVisible()
      expectNoContext()
    },
  )

  it('does not create context when browsing unrelated artist rows', () => {
    window.history.replaceState({}, '', '/artists?artist=person')
    render(<HistoryWorkspace />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Unrelated Artist artist row' }),
    )
    expectNoContext()
  })

  it('uses the expanded stack artist as the source, not the selected inspector', async () => {
    window.history.replaceState({}, '', '/artists?artist=unrelated')
    render(<HistoryWorkspace />)
    const list = screen.getByRole('list', { name: 'Artist master list' })
    fireEvent.click(within(list).getByText(/Explore Real Person/))
    fireEvent.click(
      await within(list).findByRole('button', {
        name: 'Open artist Shared Group',
      }),
    )
    expect(screen.getByRole('heading', { name: 'Shared Group' })).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Return to Real Person' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Return to Unrelated Artist' }),
    ).not.toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Return to Real Person' }),
    )
    expect(screen.getByRole('heading', { name: 'Real Person' })).toBeVisible()
  })

  it.each(['group', 'unrelated'])(
    'clears context on outside workspace navigation to %s',
    (id) => {
      window.history.replaceState({}, '', '/artists?artist=person')
      render(<HistoryWorkspace />)
      openRelatedGroup()
      act(() => {
        window.history.pushState({}, '', `/artists?artist=${id}`)
        window.dispatchEvent(new Event('discweave:navigation'))
      })
      expectNoContext()
      act(() => {
        window.history.pushState({}, '', '/artists?artist=group')
        window.dispatchEvent(new Event('discweave:navigation'))
      })
      expect(
        screen.getByRole('heading', { name: 'Shared Group' }),
      ).toBeVisible()
      expectNoContext()
    },
  )

  it('clears context on event-free sidebar navigation with the same filtered selection', () => {
    window.history.replaceState({}, '', '/artists?artist=person')
    render(<HistoryWorkspace />)
    openRelatedGroup()
    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search artists' }),
      {
        target: { value: 'Shared Group' },
      },
    )
    expect(
      screen.getByRole('button', { name: 'Return to Real Person' }),
    ).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Artists sidebar' }))
    expect(window.location.search).toBe('')
    expect(screen.getByRole('heading', { name: 'Shared Group' })).toBeVisible()
    expect(
      screen.getByRole('searchbox', { name: 'Search artists' }),
    ).toHaveValue('Shared Group')
    expectNoContext()
    fireEvent.click(screen.getByRole('button', { name: 'Open group directly' }))
    expect(window.location.search).toBe('?artist=group')
    expect(screen.getByRole('heading', { name: 'Shared Group' })).toBeVisible()
    expectNoContext()
  })

  it('does not revive context after selected artist props change away and back', () => {
    window.history.replaceState({}, '', '/artists?artist=person')
    const { rerender } = render(
      <ArtistsWorkspace artists={artists} relations={relations} />,
    )
    openRelatedGroup()
    rerender(
      <ArtistsWorkspace
        artists={artists}
        relations={relations}
        locationSearch="?artist=unrelated"
      />,
    )
    expectNoContext()
    rerender(
      <ArtistsWorkspace
        artists={artists}
        relations={relations}
        locationSearch="?artist=group"
      />,
    )
    expectNoContext()
  })

  it('does not revive context after the selected record disappears and returns', () => {
    window.history.replaceState({}, '', '/artists?artist=person')
    const { rerender } = render(
      <ArtistsWorkspace artists={artists} relations={relations} />,
    )
    openRelatedGroup()
    rerender(
      <ArtistsWorkspace
        artists={artists.filter((record) => record.id !== 'group')}
        relations={relations}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Real Person' })).toBeVisible()
    expectNoContext()
    rerender(
      <ArtistsWorkspace
        artists={artists}
        relations={relations}
        locationSearch="?artist=group"
      />,
    )
    expect(screen.getByRole('heading', { name: 'Shared Group' })).toBeVisible()
    expectNoContext()
  })

  it('preserves relationship context when editing is cancelled', () => {
    window.history.replaceState({}, '', '/artists?artist=person')
    render(<HistoryWorkspace />)
    openRelatedGroup()
    fireEvent.click(screen.getByRole('button', { name: 'Edit record' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('heading', { name: 'Shared Group' })).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Return to Real Person' }),
    ).toBeVisible()
  })

  it('clears context through browser Back and Forward without losing selection', async () => {
    window.history.replaceState({}, '', '/artists?artist=person')
    render(<HistoryWorkspace />)
    openRelatedGroup()
    act(() => window.history.back())
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Real Person' }),
      ).toBeVisible(),
    )
    expectNoContext()
    act(() => window.history.forward())
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Shared Group' }),
      ).toBeVisible(),
    )
    expectNoContext()
  })

  it('clears context after saving edits to the selected artist without a URL change', () => {
    window.history.replaceState({}, '', '/artists?artist=person')
    render(<HistoryWorkspace />)
    openRelatedGroup()
    fireEvent.click(screen.getByRole('button', { name: 'Edit record' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Updated Group' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save record' }))
    expect(screen.getByRole('heading', { name: 'Updated Group' })).toBeVisible()
    expect(window.location.search).toBe('?artist=group')
    expectNoContext()
  })

  it('clears context after adding a new artist from a related artist view', () => {
    window.history.replaceState({}, '', '/artists?artist=person')
    render(<HistoryWorkspace allowAdd />)
    openRelatedGroup()
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: 'New Artist' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add record' }))
    expect(screen.getByRole('heading', { name: 'New Artist' })).toBeVisible()
    expectNoContext()
  })
})
