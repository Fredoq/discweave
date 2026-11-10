import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ArtistDetail } from './ArtistDetail'
import { artistRecords, type ArtistRecord } from './artistsData'
import { relationRecords } from '../relations/relationsData'
const artist: ArtistRecord = {
  ...artistRecords[0],
  id: 'person',
  name: 'Example Person',
  type: 'Person',
  summary: 'Artist biography.',
  identityHint: null,
  relations: [],
  credits: [],
}
const group: ArtistRecord = {
  ...artist,
  id: 'group',
  name: 'Example Group',
  type: 'Band',
}
const relation = {
  ...relationRecords[0],
  id: 'member',
  relationType: 'Member of',
  role: '',
  sourceLink: { kind: 'artist' as const, id: artist.id },
  targetLink: { kind: 'artist' as const, id: group.id },
  context: 'Touring bassist 2018–2020',
}
const catalogData = {
  artists: [artist, group],
  releases: [],
  tracks: [],
  ownedItems: [],
  relations: [relation],
}
function renderInspector(overrides = {}) {
  return render(
    <ArtistDetail
      artist={artist}
      catalogData={catalogData}
      ratingCriteria={[]}
      {...overrides}
    />,
  )
}
describe('compact artist inspector', () => {
  it('supports tab clicks, arrows, Home and End with one tab stop', async () => {
    const user = userEvent.setup()
    renderInspector()
    const relationships = screen.getByRole('tab', { name: 'Relationships' })
    const collection = screen.getByRole('tab', { name: 'Collection' })
    expect(relationships).toHaveAttribute('aria-selected', 'true')
    expect(collection).toHaveAttribute('tabindex', '-1')
    relationships.focus()
    await user.keyboard('{ArrowRight}')
    expect(collection).toHaveFocus()
    expect(screen.getByRole('tabpanel', { name: 'Collection' })).toBeVisible()
    expect(
      screen.queryByRole('tabpanel', { name: 'Relationships' }),
    ).not.toBeInTheDocument()
    await user.keyboard('{ArrowRight}')
    expect(relationships).toHaveFocus()
    await user.keyboard('{End}')
    expect(collection).toHaveFocus()
    await user.keyboard('{Home}')
    expect(relationships).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(collection).toHaveFocus()
    await user.click(relationships)
    expect(relationships).toHaveAttribute('aria-selected', 'true')
  })
  it('keeps every distinct detail beside the verified relationship without duplicate references', async () => {
    const user = userEvent.setup()
    const onSelectArtist = vi.fn()
    renderInspector({
      onSelectArtist,
      artist: {
        ...artist,
        relations: [
          {
            type: 'Member of',
            target: group.name,
            detail: 'Studio work 2021–2023',
          },
          {
            type: 'Member of',
            target: group.name,
            detail: 'Studio work 2021–2023',
          },
          {
            type: 'Member of',
            target: group.name,
            detail: 'Guest performance in 2024',
          },
        ],
      },
    })
    expect(
      screen.getByText('Member of · Touring bassist 2018–2020'),
    ).toBeVisible()
    expect(screen.queryByText(/Additional references/)).not.toBeInTheDocument()
    await user.click(
      screen.getByLabelText(`More relationship details for ${group.name}`),
    )
    expect(
      screen.getAllByText('Member of · Studio work 2021–2023'),
    ).toHaveLength(1)
    expect(
      screen.getByText('Member of · Guest performance in 2024'),
    ).toBeVisible()
    await user.click(
      screen.getByRole('button', { name: `Open artist ${group.name}` }),
    )
    expect(onSelectArtist).toHaveBeenCalledExactlyOnceWith(group.id)
  })
  it('renders incoming generic relations differently from outgoing ones', () => {
    renderInspector({
      catalogData: {
        ...catalogData,
        relations: [
          {
            ...relation,
            relationType: 'Influenced by',
            context: 'Early recordings',
          },
          {
            ...relation,
            id: 'inverse',
            sourceLink: relation.targetLink,
            targetLink: relation.sourceLink,
            relationType: 'Influenced by',
            context: 'Early recordings',
          },
        ],
      },
    })
    expect(screen.getByText('Influenced by · Early recordings')).toBeVisible()
    fireEvent.click(
      screen.getByLabelText(`More relationship details for ${group.name}`),
    )
    expect(
      screen.getByText('Influenced by (incoming) · Early recordings'),
    ).toBeVisible()
  })
  it('keeps ambiguous and unlinked names plain text, retaining long details', async () => {
    const user = userEvent.setup()
    const longDetail = 'VeryLongUnbrokenText'.repeat(20)
    renderInspector({
      artist: {
        ...artist,
        relations: [
          { type: 'Member of', target: group.name, detail: longDetail },
          {
            type: 'Alias of',
            target: 'Unknown Identity',
            detail: 'Historical credit',
          },
        ],
      },
      catalogData: {
        ...catalogData,
        artists: [artist, group, { ...group, id: 'duplicate-group' }],
      },
    })
    await user.click(screen.getByText(/Additional references/))
    const references = screen
      .getByText(/Additional references/)
      .closest('details')!
    expect(within(references).getByText('Ambiguous name')).toBeVisible()
    expect(within(references).getByText('Unlinked')).toBeVisible()
    expect(
      within(references).getByText(`Member of · ${longDetail}`),
    ).toBeVisible()
    expect(within(references).queryByRole('button')).not.toBeInTheDocument()
    expect(within(references).queryByRole('link')).not.toBeInTheDocument()
  })
  it('closes the actions disclosure on Escape, focus leaving, outside click and artist change', async () => {
    const user = userEvent.setup()
    const props = {
      artist,
      catalogData,
      ratingCriteria: [],
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onUpdateViaDiscogs: vi.fn(),
      canUpdateViaDiscogs: false,
    }
    const { rerender } = render(<ArtistDetail {...props} />)
    const trigger = screen.getByLabelText('More artist actions')
    await user.click(trigger)
    expect(trigger.closest('details')).toHaveAttribute('open')
    expect(
      screen.getByRole('button', { name: 'Update via Discogs' }),
    ).toBeDisabled()
    expect(
      screen.getByText(
        'Add a Discogs token in Settings to use Discogs lookup.',
      ),
    ).toBeVisible()
    await user.keyboard('{Escape}')
    expect(trigger.closest('details')).not.toHaveAttribute('open')
    expect(trigger).toHaveFocus()
    await user.click(trigger)
    await user.tab()
    expect(screen.getByRole('button', { name: 'Delete record' })).toHaveFocus()
    expect(trigger.closest('details')).toHaveAttribute('open')
    await user.tab()
    expect(screen.getByRole('tab', { name: 'Relationships' })).toHaveFocus()
    expect(trigger.closest('details')).not.toHaveAttribute('open')
    await user.click(trigger)
    await user.click(screen.getByRole('tab', { name: 'Collection' }))
    expect(trigger.closest('details')).not.toHaveAttribute('open')
    await user.click(trigger)
    await user.click(document.body)
    expect(trigger.closest('details')).not.toHaveAttribute('open')
    await user.click(trigger)
    rerender(<ArtistDetail {...props} artist={group} />)
    expect(
      screen.getByLabelText('More artist actions').closest('details'),
    ).not.toHaveAttribute('open')
    expect(screen.getByRole('tab', { name: 'Relationships' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })
  it('focuses the new heading after a relationship navigation and preserves selected record counts', async () => {
    const user = userEvent.setup()
    const select = vi.fn()
    const { rerender } = renderInspector({ onSelectArtist: select })
    await user.click(
      screen.getByRole('button', { name: `Open artist ${group.name}` }),
    )
    rerender(
      <ArtistDetail
        artist={group}
        catalogData={catalogData}
        ratingCriteria={[]}
        onSelectArtist={select}
      />,
    )
    expect(screen.getByRole('heading', { name: group.name })).toHaveFocus()
    const inspector = screen.getByRole('complementary', { name: group.name })
    expect(
      within(inspector).getByText('Releases', { selector: 'dt' })
        .nextElementSibling,
    ).toHaveTextContent('0')
  })
})
