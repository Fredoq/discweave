import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ArtistMasterList } from './ArtistMasterList'
import { artistRecords, type ArtistRecord } from './artistsData'
import { relationRecords } from '../relations/relationsData'

function artist(id: string, name: string): ArtistRecord {
  return {
    ...artistRecords[0],
    id,
    name,
    type: 'Person',
    aliases: [],
    relations: [],
    identityHint: null,
  }
}
const first = artist('first', 'First Person')
const second = artist('second', 'Second Person')
const firstGroup = artist('first-group', 'First Group')
const secondGroup = artist('second-group', 'Second Group')
const catalogData = {
  artists: [first, second, firstGroup, secondGroup],
  releases: [],
  tracks: [],
  ownedItems: [],
  relations: [first, second].map((person, index) => ({
    ...relationRecords[0],
    id: `membership-${person.id}`,
    sourceLink: { kind: 'artist' as const, id: person.id },
    targetLink: {
      kind: 'artist' as const,
      id: [firstGroup, secondGroup][index].id,
    },
    relationType: 'Member of',
  })),
}

describe('lazy artist stack connections', () => {
  it('mounts each connection branch only while expanded and supports reopening', async () => {
    const user = userEvent.setup()
    const select = vi.fn()
    const selectRelated = vi.fn()
    render(
      <ArtistMasterList
        artists={[first, second]}
        catalogData={catalogData}
        selectedArtistId={second.id}
        onSelectArtist={select}
        onSelectRelatedArtist={selectRelated}
      />,
    )
    const firstSummary = screen.getByText('Explore First Person · 1 name')
    const secondSummary = screen.getByText('Explore Second Person · 1 name')
    const firstDetails = firstSummary.closest('details')!
    const secondDetails = secondSummary.closest('details')!
    expect(
      screen.queryByRole('button', { name: /Open artist/, hidden: true }),
    ).not.toBeInTheDocument()

    await user.click(firstSummary)
    const connection = await within(firstDetails).findByRole('button', {
      name: 'Open artist First Group',
    })
    expect(firstDetails).toHaveAttribute('open')
    expect(
      within(secondDetails).queryByRole('button', { hidden: true }),
    ).not.toBeInTheDocument()
    await user.click(connection)
    expect(selectRelated).toHaveBeenCalledExactlyOnceWith(
      firstGroup.id,
      first.id,
    )
    expect(select).not.toHaveBeenCalled()

    await user.click(secondSummary)
    expect(
      await within(secondDetails).findByRole('button', {
        name: 'Open artist Second Group',
      }),
    ).toBeVisible()
    await user.click(firstSummary)
    await waitFor(() =>
      expect(
        within(firstDetails).queryByRole('button', { hidden: true }),
      ).not.toBeInTheDocument(),
    )
    expect(secondDetails).toHaveAttribute('open')
    await user.click(firstSummary)
    expect(
      await within(firstDetails).findByRole('button', {
        name: 'Open artist First Group',
      }),
    ).toBeVisible()
  })

  it('routes an ordinary row click separately without expanding its stack', async () => {
    const user = userEvent.setup()
    const select = vi.fn()
    const selectRelated = vi.fn()
    render(
      <ArtistMasterList
        artists={[first, second]}
        catalogData={catalogData}
        selectedArtistId={second.id}
        onSelectArtist={select}
        onSelectRelatedArtist={selectRelated}
      />,
    )
    await user.click(
      screen.getByRole('button', { name: 'First Person artist row' }),
    )
    expect(select).toHaveBeenCalledExactlyOnceWith(first.id)
    expect(selectRelated).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('button', { name: /Open artist/, hidden: true }),
    ).not.toBeInTheDocument()
  })
})
