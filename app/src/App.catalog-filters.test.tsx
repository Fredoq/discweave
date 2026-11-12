import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App catalog filters and backlinks', () => {
  it('filters catalog rows by media, status and relation text', async () => {
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(
      h
        .within(h.screen.getByRole('group', { name: 'Catalog entity type' }))
        .getByRole('button', { name: 'Tracks' }),
    )
    await user.click(
      h
        .within(h.screen.getByRole('group', { name: 'Catalog entity type' }))
        .getByRole('button', { name: 'Tracks' }),
    )
    await user.type(h.screen.getByRole('searchbox'), 'lossless')

    expect(h.screen.getByRole('row', { name: /polynomial-c/i })).toBeVisible()
    expect(
      h.screen.queryByRole('row', { name: /blue monday/i }),
    ).not.toBeInTheDocument()
  })

  it('previews a matching result after filtering', async () => {
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(
      h
        .within(h.screen.getByRole('group', { name: 'Catalog entity type' }))
        .getByRole('button', { name: 'Tracks' }),
    )
    await user.type(h.screen.getByRole('searchbox'), 'lossless')

    await user.click(
      h.screen.getByRole('button', { name: 'Preview Polynomial-C' }),
    )

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Polynomial-C',
    })

    expect(
      h.within(detailPanel).getByRole('heading', { name: 'Polynomial-C' }),
    ).toBeInTheDocument()
    expect(
      h.screen.queryByRole('complementary', {
        name: 'Selected Ambient Works 85-92',
      }),
    ).not.toBeInTheDocument()
  })

  it('shows an empty results state without a preview when no rows match', async () => {
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.type(h.screen.getByRole('searchbox'), 'no matching catalog item')

    expect(h.screen.getByText('0 shown')).toBeInTheDocument()
    expect(h.screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      h.screen.getByText('No matching catalog entries.'),
    ).toBeInTheDocument()
  })

  it('applies saved-view filters to catalog rows', async () => {
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.selectOptions(
      h.screen.getByRole('combobox', { name: 'Saved view' }),
      'Needs digitization',
    )

    expect(h.screen.getByRole('combobox', { name: 'Saved view' })).toHaveValue(
      'Needs digitization',
    )
    expect(h.screen.getAllByRole('row', { name: /blue monday/i })).toHaveLength(
      2,
    )
    expect(
      h.screen.queryByRole('row', { name: /polynomial-c/i }),
    ).not.toBeInTheDocument()

    await user.selectOptions(
      h.screen.getByRole('combobox', { name: 'Saved view' }),
      'Physical without digital',
    )

    expect(h.screen.getByRole('combobox', { name: 'Saved view' })).toHaveValue(
      'Physical without digital',
    )
    expect(h.screen.getAllByRole('row', { name: /blue monday/i })).toHaveLength(
      2,
    )
    expect(
      h.screen.queryByRole('row', { name: /selected ambient works/i }),
    ).not.toBeInTheDocument()
  })

  it('opens copy details when its search result is previewed', async () => {
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(
      h
        .within(h.screen.getByRole('row', { name: /Blue Monday.*Owned item/i }))
        .getByRole('button', { name: 'Preview Blue Monday' }),
    )

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Blue Monday',
    })

    expect(
      h.within(detailPanel).getByRole('heading', { name: 'Blue Monday' }),
    ).toBeInTheDocument()
    expect(h.within(detailPanel).getByText('12-inch vinyl')).toBeInTheDocument()
    expect(h.within(detailPanel).getByText('Shelf A3')).toBeInTheDocument()
  })

  it('derives catalog rows from manual session records and deep-links with SPA navigation', async () => {
    window.history.pushState({}, '', '/artists')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add artist' }))
    await user.type(h.screen.getByLabelText('Name'), 'Catalog Session Artist')
    await user.click(h.screen.getByRole('button', { name: 'Add record' }))

    await user.click(h.screen.getByRole('link', { name: 'Search' }))
    await user.type(
      h.screen.getByRole('searchbox', { name: 'Search collection' }),
      'Catalog Session Artist',
    )

    expect(
      h.screen.getByRole('row', { name: /catalog session artist/i }),
    ).toBeVisible()

    await user.click(
      h.screen.getByRole('link', { name: 'Open Catalog Session Artist' }),
    )

    expect(window.location.pathname).toBe('/artists')
    expect(
      h.screen.getByRole('complementary', { name: 'Catalog Session Artist' }),
    ).toBeInTheDocument()
  })

  it('searches catalog linked metadata and keeps unknown free text as plain text', async () => {
    window.history.pushState({}, '', '/relations')
    const user = h.userEvent.setup()
    const state = h.getInitialCatalogStateForTests()!
    h.seedCatalogForTests({
      ...state,
      relations: [
        ...state.relations,
        {
          ...h.relationRecords[0],
          id: 'legacy-free-text',
          source: 'Loose Note Person',
          target: 'Loose Note Alias',
          linkedEntity: 'Sleeve-only white label clue',
          sourceLink: undefined,
          targetLink: undefined,
          linkedEntityLink: undefined,
        },
      ],
    })
    h.render(<h.App />)

    await user.click(h.screen.getByRole('link', { name: 'Search' }))
    await user.type(
      h.screen.getByRole('searchbox', { name: 'Search collection' }),
      'Sleeve-only white label clue',
    )

    await user.click(
      h.screen.getByRole('button', {
        name: 'Preview Loose Note Person to Loose Note Alias',
      }),
    )

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Loose Note Person to Loose Note Alias',
    })

    expect(
      h.within(detailPanel).getAllByText('Sleeve-only white label clue')[0],
    ).toBeInTheDocument()
    expect(
      h.within(detailPanel).queryByRole('link', {
        name: 'Sleeve-only white label clue',
      }),
    ).not.toBeInTheDocument()
  })

  it('narrows catalog rows with relation-aware filters', async () => {
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(
      h
        .within(h.screen.getByRole('group', { name: 'Catalog entity type' }))
        .getByRole('button', { name: 'Tracks' }),
    )
    await user.click(h.screen.getByRole('button', { name: /^Filters/ }))
    await user.selectOptions(h.screen.getByLabelText('File format'), 'FLAC')

    expect(h.screen.getByRole('row', { name: /polynomial-c/i })).toBeVisible()
    expect(
      h.screen.queryByRole('row', { name: /selected ambient works 85-92/i }),
    ).not.toBeInTheDocument()
    expect(
      h.screen.queryByRole('row', { name: /blue monday vinyl/i }),
    ).not.toBeInTheDocument()
  })

  it('derives release catalog statuses from every owned copy', () => {
    const entries = h.buildCatalogEntries({
      artists: [],
      releases: [
        {
          id: 'mixed-copy-release',
          title: 'Mixed Copy Release',
          artist: 'Catalog Tester',
          type: 'Album',
          year: '2026',
          label: 'Test Label',
          genres: [],
          tags: [],
          releaseNotes: 'Release with multiple concrete copy states.',
          ownedCopies: [
            {
              id: 'mixed-copy-owned',
              medium: 'CD',
              status: 'Owned',
              storage: 'Shelf A',
              condition: 'Very Good',
              note: 'Cataloged copy.',
            },
            {
              id: 'mixed-copy-transfer',
              medium: 'Cassette',
              status: 'Needs digitization',
              storage: 'Shelf B',
              condition: 'Good',
              note: 'Transfer pending.',
            },
          ],
        },
      ],
      tracks: [],
      ownedItems: [],
      relations: [],
      playlists: [],
    })
    const releaseEntry = entries.find(
      (entry) => entry.id === 'release:mixed-copy-release',
    )

    expect(releaseEntry?.statuses).toEqual(['Owned', 'Needs digitization'])
    expect(releaseEntry?.status).toBe('Owned, Needs digitization')
    expect(releaseEntry?.statusTone).toBe('amber')
  })

  it('shows duplicate warnings for manual records without blocking submit', async () => {
    window.history.pushState({}, '', '/artists')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add artist' }))
    await user.type(h.screen.getByLabelText('Name'), 'Aphex Twin')

    expect(h.screen.getByText(/likely duplicate artist/i)).toBeInTheDocument()

    await user.click(h.screen.getByRole('button', { name: 'Add record' }))

    expect(
      h.screen.getAllByRole('button', { name: /aphex twin/i }).length,
    ).toBeGreaterThan(1)
  })

  it('filters track relations and warns on duplicate tracks when artist comes from track credits', async () => {
    window.history.pushState({}, '', '/tracks')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.selectOptions(
      h.screen.getByLabelText('Relation type'),
      'Version of',
    )

    expect(
      h.screen.getByRole('listitem', { name: /polynomial-c/i }),
    ).toBeVisible()
    expect(
      h.screen.queryByRole('listitem', { name: /yeah pretentious mix/i }),
    ).not.toBeInTheDocument()

    await user.click(h.screen.getByRole('button', { name: 'Add track' }))
    const form = h.screen.getByRole('form', { name: 'Add track' })

    await user.type(h.within(form).getByLabelText('Title'), 'Polynomial-C')
    await user.type(h.within(form).getByLabelText('Artist'), 'Aphex Twin')
    await user.click(h.within(form).getByRole('button', { name: 'Add artist' }))

    expect(h.screen.getByText(/likely duplicate track/i)).toBeInTheDocument()

    await user.selectOptions(h.screen.getByLabelText('Relation type'), '')
    await user.click(h.screen.getByRole('button', { name: 'Add record' }))

    expect(
      h.screen.getAllByRole('listitem', { name: /polynomial-c/i }).length,
    ).toBeGreaterThan(1)
  })

  it('filters manual releases and keeps draft track backlinks linked after duplicate warnings remain non-blocking', async () => {
    window.history.pushState({}, '', '/releases')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.selectOptions(h.screen.getByLabelText('Label'), 'Warp')

    expect(
      h.screen.getByRole('row', { name: /selected ambient works 85-92/i }),
    ).toBeVisible()
    expect(
      h.screen.queryByRole('row', { name: /blue monday/i }),
    ).not.toBeInTheDocument()

    await user.click(h.screen.getByRole('button', { name: 'Add release' }))
    let form = h.screen.getByRole('form', { name: 'Add release' })

    await user.type(h.within(form).getByLabelText('Title'), 'Blue Monday')
    await h.addReleaseArtist(user, form, 'New Order')

    expect(h.screen.getByText(/likely duplicate release/i)).toBeInTheDocument()

    await user.click(h.screen.getByRole('button', { name: 'Cancel' }))
    await user.selectOptions(h.screen.getByLabelText('Label'), '')
    await user.click(h.screen.getByRole('button', { name: 'Add release' }))
    form = h.screen.getByRole('form', { name: 'Add release' })

    await user.type(h.within(form).getByLabelText('Title'), 'Review Shelf Dub')
    await h.addReleaseArtist(user, form, 'Review Artist')
    await user.type(h.within(form).getByLabelText('Label'), 'Review Label')
    await user.click(h.within(form).getByRole('button', { name: 'Add label' }))
    await h.selectReleaseGenre(user, form)
    await user.click(h.within(form).getByRole('button', { name: '+ Track' }))
    await user.type(
      h.within(form).getByLabelText('Track title'),
      'Review Shelf Dub Version',
    )

    await user.click(h.screen.getByRole('button', { name: 'Add record' }))
    await user.selectOptions(h.screen.getByLabelText('Label'), 'Review Label')

    expect(
      h.screen.getByRole('row', { name: /review shelf dub/i }),
    ).toBeVisible()

    const releasePanel = h.screen.getByRole('complementary', {
      name: 'Review Shelf Dub',
    })
    const tracksSection = h.detailSection(releasePanel, 'Tracks')

    expect(
      h.within(tracksSection).getByRole('link', {
        name: 'Review Shelf Dub Version',
      }),
    ).toHaveAttribute('href', expect.stringContaining('/tracks?track='))
  })

  it('updates release backlinks immediately after a manual owned item is created', async () => {
    window.history.pushState({}, '', '/owned-items')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add owned item' }))
    const form = h.screen.getByRole('form', { name: 'Add owned item' })
    await user.selectOptions(
      h.within(form).getByLabelText('Ownership status'),
      'Owned',
    )

    await user.type(
      h.within(form).getByLabelText('Item name'),
      'Session CD Copy',
    )
    await user.selectOptions(
      h.within(form).getByLabelText('Existing release'),
      'selected-ambient-works-85-92',
    )
    await user.type(
      h.within(form).getByLabelText('Storage location'),
      'Desk A1',
    )
    await user.click(h.screen.getByRole('button', { name: 'Add record' }))

    await user.click(
      h
        .within(
          h.detailSection(
            h.screen.getByRole('complementary', { name: 'Session CD Copy' }),
            'Linked catalog item',
          ),
        )
        .getByRole('link', { name: 'Selected Ambient Works 85-92' }),
    )

    const releasePanel = h.screen.getByRole('complementary', {
      name: 'Selected Ambient Works 85-92',
    })

    const copies = h
      .within(releasePanel)
      .getByRole('region', { name: /^Copies/ })
    const copyCard = h.within(copies).getByText('Desk A1').closest('article')!
    await user.click(
      h.within(copyCard).getByRole('button', { name: /^Details for copy/ }),
    )
    const dialog = h.screen.getByRole('dialog')
    expect(
      h.within(dialog).getByRole('heading', { name: 'Session CD Copy' }),
    ).toBeVisible()
    expect(
      h.within(dialog).getByRole('link', { name: 'Open in inventory' }),
    ).toHaveAttribute(
      'href',
      expect.stringContaining('/owned-items?ownedItem='),
    )
  })
})
