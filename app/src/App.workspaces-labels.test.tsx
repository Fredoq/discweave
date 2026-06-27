import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App label workspace', () => {
  it('collapses duplicate label records with multiple catalog numbers into one label index row', () => {
    window.history.pushState({}, '', '/labels')
    seedMultiCatalogLabelFixture()

    h.render(<h.App />)

    expect(h.screen.getByText('1 shown from 1 labels.')).toBeInTheDocument()
    expect(h.screen.getAllByRole('row', { name: /big life/i })).toHaveLength(1)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Big Life',
    })
    expect(
      h.within(detailPanel).getByText('1 releases · 0 owned copies'),
    ).toBeInTheDocument()
    expect(
      h
        .within(h.detailSection(detailPanel, 'Releases on label'))
        .getByRole('link', { name: 'Multiple Catalog Numbers' }),
    ).toBeInTheDocument()
  })

  it('keeps a release label name unique while showing every catalog number', () => {
    window.history.pushState({}, '', '/releases')
    seedMultiCatalogLabelFixture()

    h.render(<h.App />)

    const releaseRow = h.screen.getByRole('row', {
      name: /multiple catalog numbers/i,
    })
    expect(h.within(releaseRow).getAllByText('Big Life')).toHaveLength(1)
    expect(h.within(releaseRow).getByText('BLRDCD 5')).toBeInTheDocument()
    expect(h.within(releaseRow).getByText('847963. 2')).toBeInTheDocument()
  })

  it('edits every backing label record in a grouped label row', async () => {
    window.history.pushState({}, '', '/labels')
    seedMultiCatalogLabelFixture()
    const user = h.userEvent.setup()

    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Edit record' }))
    const form = h.screen.getByRole('form', { name: 'Edit label' })
    await user.clear(h.within(form).getByLabelText('Name'))
    await user.type(h.within(form).getByLabelText('Name'), 'Big Life Edited')
    await user.click(
      h.within(form).getByRole('button', { name: 'Save record' }),
    )

    expect(
      await h.screen.findByRole('complementary', {
        name: 'Big Life Edited',
      }),
    ).toBeInTheDocument()

    await user.click(h.screen.getByRole('link', { name: 'Releases' }))
    const releaseRow = h.screen.getByRole('row', {
      name: /multiple catalog numbers/i,
    })
    expect(h.within(releaseRow).getAllByText('Big Life Edited')).toHaveLength(1)
    expect(h.within(releaseRow).queryByText('Big Life')).not.toBeInTheDocument()
    expect(h.within(releaseRow).getByText('BLRDCD 5')).toBeInTheDocument()
    expect(h.within(releaseRow).getByText('847963. 2')).toBeInTheDocument()
  })
})

function seedMultiCatalogLabelFixture() {
  h.seedCatalogForTests({
    artists: [],
    labels: [
      { id: 'big-life-primary', name: 'Big Life' },
      { id: 'big-life-duplicate', name: 'Big Life' },
    ],
    releases: [
      {
        id: 'multi-catalog-release',
        title: 'Multiple Catalog Numbers',
        artist: 'Archive Artist',
        type: 'Album',
        year: '1991',
        label: 'Big Life',
        labels: [
          {
            labelId: 'big-life-primary',
            name: 'Big Life',
            catalogNumber: 'BLRDCD 5',
            hasNoCatalogNumber: false,
          },
          {
            labelId: 'big-life-duplicate',
            name: 'Big Life',
            catalogNumber: '847963. 2',
            hasNoCatalogNumber: false,
          },
        ],
        genres: [],
        tags: [],
        releaseNotes: '',
        ownedCopies: [],
      },
    ],
    tracks: [],
    ownedItems: [],
    relations: [],
    playlists: [],
  })
}
