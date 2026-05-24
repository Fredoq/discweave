import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App catalog actions', () => {
  it('renders the catalog workspace navigation and search', () => {
    h.render(<h.App />)

    expect(
      h.screen.getByRole('heading', { name: 'Catalog' }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('searchbox', { name: 'Search collection' }),
    ).toBeInTheDocument()

    const navigation = h.screen.getByRole('navigation', {
      name: 'Cratebase sections',
    })

    expect(
      h
        .within(navigation)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      'Catalog',
      'Releases',
      'Tracks',
      'Artists',
      'Labels',
      'Playlists',
      'Owned Items',
      'Relations',
      'Imports',
      'Exports',
      'Settings',
    ])
  })

  it('loads catalog search results and graph context from the server', async () => {
    h.clearCatalogForTests()
    const fetchMock = h.mockFetch(
      ...h.emptyCatalogLoadResponses(),
      h.searchResponseWithLabel(),
      h.graphResponseForLabel(),
    )

    h.render(<h.App />)

    const resultRow = await h.screen.findByRole('row', {
      name: /Factory Records/i,
    })
    expect(resultRow).toBeInTheDocument()
    expect(
      h.within(resultRow).getByText('Physical without digital'),
    ).toBeInTheDocument()
    expect(
      await h.screen.findByRole('heading', { name: 'Factory Records' }),
    ).toBeInTheDocument()
    expect(h.screen.getByText('Blue Monday')).toBeInTheDocument()
    const detailPanel = await h.screen.findByRole('complementary', {
      name: 'Factory Records',
    })
    expect(
      h.within(detailPanel).getByText(/physical media without digital copy/i),
    ).toBeInTheDocument()
    expect(
      h.within(h.detailSection(detailPanel, 'Artists')).getByRole('link', {
        name: 'New Order',
      }),
    ).toHaveAttribute('href', '/artists?artist=artist-1')
    expect(
      fetchMock.mock.calls.some(
        ([url]) => typeof url === 'string' && url.startsWith('/api/search?'),
      ),
    ).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith('/api/catalog-graph/label/label-1', {
      credentials: 'include',
      method: 'GET',
    })
  })

  it('sends the server credits saved view to catalog search', async () => {
    window.history.pushState({}, '', '/catalog?savedView=credits')
    h.clearCatalogForTests()
    const fetchMock = h.mockFetch(
      ...h.emptyCatalogLoadResponses(),
      h.searchResponseWithLabel(),
      h.graphResponseForLabel(),
    )

    h.render(<h.App />)

    await h.screen.findByRole('row', { name: /Factory Records/i })

    const searchCall = fetchMock.mock.calls.find(
      ([url]) => typeof url === 'string' && url.startsWith('/api/search?'),
    )
    expect(searchCall?.[0]).toEqual(
      expect.stringContaining('savedView=credits'),
    )
  })

  it('sends audit saved views to catalog search from saved view pills', async () => {
    h.clearCatalogForTests()
    const fetchMock = h.mockFetch(
      ...h.emptyCatalogLoadResponses(),
      h.searchResponseWithLabel(),
      h.graphResponseForLabel(),
      h.searchResponseWithLabel(),
      h.graphResponseForLabel(),
      h.searchResponseWithLabel(),
      h.graphResponseForLabel(),
      h.searchResponseWithLabel(),
      h.graphResponseForLabel(),
    )
    const user = h.userEvent.setup()

    h.render(<h.App />)

    await h.screen.findByRole('row', { name: /Factory Records/i })

    for (const [label, savedView] of [
      ['Physical without digital', 'physicalWithoutDigital'],
      ['Lossy without lossless', 'lossyWithoutLossless'],
      ['Wanted not owned', 'wantedNotOwned'],
    ] as const) {
      await user.click(h.screen.getByRole('button', { name: label }))

      await h.waitFor(() => {
        expect(
          h
            .searchRequestUrls(fetchMock)
            .some((url) => url.searchParams.get('savedView') === savedView),
        ).toBe(true)
      })
    }

    const lossySearchUrl = h
      .searchRequestUrls(fetchMock)
      .find(
        (url) => url.searchParams.get('savedView') === 'lossyWithoutLossless',
      )
    expect(lossySearchUrl?.searchParams.get('tag')).toBeNull()
  })

  it('opens a label workspace from a server-backed catalog result', async () => {
    h.clearCatalogForTests()
    h.mockFetch(
      ...h.catalogLoadResponsesWithLabels(),
      h.searchResponseWithLabel(),
      h.graphResponseForLabel(),
    )
    const user = h.userEvent.setup()

    h.render(<h.App />)

    await user.click(
      await h.screen.findByRole('link', { name: 'Open Factory Records' }),
    )

    expect(
      await h.screen.findByRole('heading', { name: 'Labels' }),
    ).toBeInTheDocument()
    expect(h.screen.getByRole('link', { name: 'Labels' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(
      h.screen.getByRole('heading', { name: 'Factory Records' }),
    ).toBeInTheDocument()
  })

  it('keeps label owned coverage tied to release ids instead of shared titles', async () => {
    window.history.pushState({}, '', '/labels')
    h.seedCatalogForTests({
      artists: [],
      labels: [
        { id: 'source-label', name: 'Source Label' },
        { id: 'other-label', name: 'Other Label' },
      ],
      releases: [
        {
          id: 'source-release',
          title: 'Greatest Hits',
          artist: 'Source Artist',
          type: 'Album',
          year: '1990',
          label: 'Source Label',
          labels: [
            {
              labelId: 'source-label',
              name: 'Source Label',
              catalogNumber: 'SRC-1',
              hasNoCatalogNumber: false,
            },
          ],
          genres: [],
          tags: [],
          releaseNotes: 'Source label release with a shared title.',
          ownedCopies: [],
        },
        {
          id: 'other-release',
          title: 'Greatest Hits',
          artist: 'Other Artist',
          type: 'Album',
          year: '1991',
          label: 'Other Label',
          labels: [
            {
              labelId: 'other-label',
              name: 'Other Label',
              catalogNumber: 'OTH-1',
              hasNoCatalogNumber: false,
            },
          ],
          genres: [],
          tags: [],
          releaseNotes: 'Other label release with the same title.',
          ownedCopies: [],
        },
      ],
      tracks: [],
      ownedItems: [
        {
          id: 'other-copy',
          title: 'Other Greatest Hits CD',
          releaseId: 'other-release',
          releaseTitle: 'Greatest Hits',
          artist: 'Other Artist',
          medium: 'CD',
          status: 'Owned',
          statusTone: 'green',
          storage: 'Shelf B',
          condition: 'Very Good',
          acquisition: 'Personal collection',
          copyNotes: 'Copy belongs to the other label release.',
          linkedType: 'Release',
          fileFormat: 'None recorded',
          digitalState: 'No verified local file',
          digitizationState: 'Digital state unknown',
          tags: [],
        },
      ],
      relations: [],
      playlists: [],
    })
    const user = h.userEvent.setup()

    h.render(<h.App />)

    let detailPanel = h.screen.getByRole('complementary', {
      name: 'Source Label',
    })
    expect(
      h.within(detailPanel).getByText('1 releases · 0 owned copies'),
    ).toBeInTheDocument()
    expect(
      h
        .within(h.detailSection(detailPanel, 'Owned coverage'))
        .getByText('None recorded.'),
    ).toBeInTheDocument()

    await user.click(h.screen.getByRole('button', { name: /Other Label/ }))

    detailPanel = h.screen.getByRole('complementary', { name: 'Other Label' })
    expect(
      h.within(detailPanel).getByText('1 releases · 1 owned copies'),
    ).toBeInTheDocument()
    expect(
      h
        .within(h.detailSection(detailPanel, 'Owned coverage'))
        .getByRole('link', {
          name: 'Other Greatest Hits CD',
        }),
    ).toBeInTheDocument()
  })

  it('navigates between workspace sections from the sidebar', async () => {
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('link', { name: 'Artists' }))

    expect(
      h.screen.getByRole('heading', { name: 'Artists' }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('searchbox', { name: 'Search artists' }),
    ).toBeInTheDocument()
    expect(h.screen.getByRole('link', { name: 'Artists' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(
      h.screen.queryByRole('searchbox', { name: 'Search collection' }),
    ).not.toBeInTheDocument()
  })

  it('opens and cancels the catalog add entry chooser', async () => {
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add entry' }))

    expect(
      h.screen.getByRole('region', { name: 'Add catalog entry' }),
    ).toBeVisible()
    expect(
      h.screen.getByRole('button', { name: 'Create artist entry' }),
    ).toBeVisible()
    expect(
      h.screen.queryByText('Add entry is not available yet.'),
    ).not.toBeInTheDocument()

    await user.click(h.screen.getByRole('button', { name: 'Cancel add entry' }))

    expect(
      h.screen.queryByRole('region', { name: 'Add catalog entry' }),
    ).not.toBeInTheDocument()
    expect(
      h.screen.getByRole('heading', { name: 'Catalog' }),
    ).toBeInTheDocument()
  })

  it('creates an artist from the catalog add entry flow', async () => {
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add entry' }))
    await user.click(
      h.screen.getByRole('button', { name: 'Create artist entry' }),
    )

    const form = h.screen.getByRole('form', { name: 'Add artist' })
    await user.type(
      h.within(form).getByLabelText('Name'),
      'Catalog Route Artist',
    )
    await user.click(h.within(form).getByRole('button', { name: 'Add record' }))

    expect(
      h.screen.queryByRole('form', { name: 'Add artist' }),
    ).not.toBeInTheDocument()
    expect(h.screen.getByRole('status')).toHaveTextContent('Artist saved.')
    expect(
      h.screen.getByRole('heading', { name: 'Catalog' }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('row', { name: /catalog route artist/i }),
    ).toBeInTheDocument()
  })

  it('shows catalog add entry API errors without blocking previous catalog data', async () => {
    h.clearCatalogForTests()
    h.mockFetch(
      ...h.emptyCatalogLoadResponses(),
      h.emptySearchResponse(),
      h.jsonResponse(
        { code: 'catalog.server_error', message: 'Save failed' },
        500,
      ),
    )
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await h.screen.findByText('No matching catalog entries.')
    await user.click(h.screen.getByRole('button', { name: 'Add entry' }))
    await user.click(
      h.screen.getByRole('button', { name: 'Create artist entry' }),
    )

    const form = h.screen.getByRole('form', { name: 'Add artist' })
    await user.type(
      h.within(form).getByLabelText('Name'),
      'Catalog Error Artist',
    )
    await user.click(h.within(form).getByRole('button', { name: 'Add record' }))

    expect(await h.screen.findByRole('alert')).toHaveTextContent(
      'Catalog request failed. Try again.',
    )
    expect(
      h.screen.getByRole('heading', { name: 'Catalog' }),
    ).toBeInTheDocument()
    expect(
      h.screen.getAllByText('No matching catalog entries.').length,
    ).toBeGreaterThan(0)
  })

  it('refreshes server-backed catalog search after add entry saves', async () => {
    h.clearCatalogForTests()
    const fetchMock = h.mockFetch(
      ...h.emptyCatalogLoadResponses(),
      h.emptySearchResponse(),
      h.jsonResponse({
        id: '00000000-0000-7000-8000-000000000011',
        name: 'Search Refresh Artist',
        type: 'person',
      }),
      ...h.emptyCatalogLoadResponses(),
      h.emptySearchResponse(),
    )
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await h.screen.findByText('No matching catalog entries.')
    await user.click(h.screen.getByRole('button', { name: 'Add entry' }))
    await user.click(
      h.screen.getByRole('button', { name: 'Create artist entry' }),
    )

    const form = h.screen.getByRole('form', { name: 'Add artist' })
    await user.type(
      h.within(form).getByLabelText('Name'),
      'Search Refresh Artist',
    )
    await user.click(h.within(form).getByRole('button', { name: 'Add record' }))

    expect(await h.screen.findByText('Artist saved.')).toBeInTheDocument()
    await h.waitFor(() => {
      expect(h.searchRequestUrls(fetchMock)).toHaveLength(2)
    })
  })

  it.each([
    {
      path: '/artists',
      heading: 'Artists',
      action: 'Add artist',
      form: 'Add artist',
      requiredLabel: 'Name',
      value: 'Coil Archive Test Artist',
      searchLabel: 'Search artists',
      rowName: /coil archive test artist/i,
      detailName: 'Coil Archive Test Artist',
    },
    {
      path: '/releases',
      heading: 'Releases',
      action: 'Add release',
      form: 'Add release',
      requiredLabel: 'Title',
      value: 'Silent Dub Test Pressing',
      searchLabel: 'Search releases',
      rowName: /silent dub test pressing/i,
      detailName: 'Silent Dub Test Pressing',
    },
    {
      path: '/tracks',
      heading: 'Tracks',
      action: 'Add track',
      form: 'Add track',
      requiredLabel: 'Title',
      value: 'Unlabeled Field Recording',
      searchLabel: 'Search tracks',
      rowName: /unlabeled field recording/i,
      detailName: 'Unlabeled Field Recording',
    },
    {
      path: '/labels',
      heading: 'Labels',
      action: 'Add label',
      form: 'Add label',
      requiredLabel: 'Name',
      value: 'Basement White Label',
      searchLabel: 'Search labels',
      rowName: /basement white label/i,
      detailName: 'Basement White Label',
    },
    {
      path: '/owned-items',
      heading: 'Owned Items',
      action: 'Add owned item',
      form: 'Add owned item',
      requiredLabel: 'Item name',
      value: 'Basement Tape Reference Copy',
      searchLabel: 'Search owned items',
      rowName: /basement tape reference copy/i,
      detailName: 'Basement Tape Reference Copy',
    },
    {
      path: '/relations',
      heading: 'Relations',
      action: 'Add relation',
      form: 'Add relation',
      requiredLabel: 'Source',
      secondaryRequiredLabel: 'Target',
      value: 'Archive Source Person',
      secondaryValue: 'Archive Target Project',
      searchLabel: 'Search relations',
      rowName: /archive source person archive target project/i,
      detailName: 'Archive Source Person to Archive Target Project',
    },
    {
      path: '/playlists',
      heading: 'Playlists',
      action: 'Add playlist',
      form: 'Add playlist',
      requiredLabel: 'Name',
      value: 'Listening Desk Checks',
      searchLabel: 'Search playlists',
      rowName: /listening desk checks/i,
      detailName: 'Listening Desk Checks',
    },
  ])(
    'supports required-only manual entry from the header in $heading',
    async ({
      path,
      heading,
      action,
      form,
      requiredLabel,
      secondaryRequiredLabel,
      value,
      secondaryValue,
      searchLabel,
      rowName,
      detailName,
    }) => {
      window.history.pushState({}, '', path)
      const user = h.userEvent.setup()
      h.render(<h.App />)

      await user.click(h.screen.getByRole('button', { name: action }))

      expect(h.screen.queryByRole('status')).not.toBeInTheDocument()
      expect(h.screen.getByRole('form', { name: form })).toBeVisible()
      expect(
        h.within(h.screen.getByRole('banner')).getByRole('heading', {
          name: heading,
        }),
      ).toBeInTheDocument()
      expect(
        h.screen.getByRole('button', { name: 'Add record' }),
      ).toBeDisabled()

      await user.click(h.screen.getByRole('button', { name: 'Cancel' }))

      expect(
        h.screen.queryByRole('form', { name: form }),
      ).not.toBeInTheDocument()
      expect(
        h.screen.queryByRole('row', { name: rowName }),
      ).not.toBeInTheDocument()

      await user.click(h.screen.getByRole('button', { name: action }))
      await user.type(h.screen.getByLabelText(requiredLabel), value)

      if (form === 'Add release') {
        const releaseForm = h.screen.getByRole('form', { name: form })
        await h.addReleaseArtist(user, releaseForm, 'Required Entry Artist')
        await h.addReleaseLabel(user, releaseForm)
        await h.selectReleaseGenre(user, releaseForm)
        await h.addReleaseTrackRow(user, releaseForm)
      }

      if (secondaryRequiredLabel && secondaryValue) {
        await user.type(
          h.screen.getByLabelText(secondaryRequiredLabel),
          secondaryValue,
        )
      }

      await user.click(h.screen.getByRole('button', { name: 'Add record' }))

      expect(
        h.screen.queryByRole('form', { name: form }),
      ).not.toBeInTheDocument()
      expect(h.screen.getByRole('row', { name: rowName })).toHaveAttribute(
        'aria-selected',
        'true',
      )
      expect(
        h.screen.getByRole('complementary', { name: detailName }),
      ).toBeInTheDocument()

      await user.type(
        h.screen.getByRole('searchbox', { name: searchLabel }),
        value,
      )

      expect(h.screen.getByRole('row', { name: rowName })).toBeVisible()
      expect(
        h.screen.getByRole('complementary', { name: detailName }),
      ).toBeInTheDocument()
    },
  )
})
