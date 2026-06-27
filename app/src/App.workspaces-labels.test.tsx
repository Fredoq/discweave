import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App label workspace', () => {
  it('shows one canonical label record with multiple catalog numbers', () => {
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

})

function seedMultiCatalogLabelFixture() {
  h.seedCatalogForTests({
    artists: [],
    labels: [{ id: 'big-life', name: 'Big Life' }],
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
            labelId: 'big-life',
            name: 'Big Life',
            catalogNumber: 'BLRDCD 5',
            hasNoCatalogNumber: false,
          },
          {
            labelId: 'big-life',
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
