import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App catalog and artist workspaces', () => {
  it('renders the catalog workspace at /catalog', () => {
    window.history.pushState({}, '', '/catalog')

    h.render(<h.App />)

    expect(
      h.screen.getByRole('heading', { name: 'Catalog' }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('searchbox', { name: 'Search collection' }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('region', { name: 'Catalog workspace' }),
    ).toBeInTheDocument()
  })

  it.each([
    ['/releases', 'Releases', 'Search releases'],
    ['/playlists', 'Playlists', 'Search playlists'],
    ['/imports', 'Imports', 'Local folder scans and metadata intake.'],
    ['/exports', 'Exports', 'Portable snapshots for collection data.'],
    ['/settings', 'Settings', 'Search settings'],
  ])('renders the %s workspace route', (path, heading, description) => {
    window.history.pushState({}, '', path)

    h.render(<h.App />)

    expect(h.screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    if (path === '/releases' || path === '/playlists' || path === '/settings') {
      expect(
        h.screen.getByRole('searchbox', { name: description }),
      ).toBeVisible()
    } else {
      expect(h.screen.getByText(description)).toBeInTheDocument()
    }
    expect(h.screen.getByRole('link', { name: heading })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('renders the artists workspace with relation-first artist rows', () => {
    window.history.pushState({}, '', '/artists')

    h.render(<h.App />)

    expect(
      h.screen.getByRole('region', { name: 'Artists workspace' }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('searchbox', { name: 'Search artists' }),
    ).toBeVisible()
    expect(
      h.screen.getByRole('list', { name: 'Artist master list' }),
    ).toBeVisible()
    expect(
      h.screen.queryByText('Aliases and members'),
    ).not.toBeInTheDocument()
    expect(h.screen.queryByText('Relation hint')).not.toBeInTheDocument()
    expect(h.screen.queryByText('Copies')).not.toBeInTheDocument()
    expect(h.screen.getByRole('button', { name: /aphex twin/i })).toBeVisible()
    expect(h.screen.getByRole('button', { name: /the dfa/i })).toBeVisible()
    const aphexRow = h.screen.getByRole('button', { name: /aphex twin/i })
    expect(
      h.within(aphexRow).getByText('No direct relations recorded'),
    ).toBeInTheDocument()
    expect(h.within(aphexRow).queryByText('Aliases')).not.toBeInTheDocument()
    expect(
      h.within(aphexRow).queryByText('Richard D. James'),
    ).not.toBeInTheDocument()
    expect(h.within(aphexRow).queryByText('Members')).not.toBeInTheDocument()
    expect(
      h.screen.getByRole('complementary', { name: 'Aphex Twin' }),
    ).toBeInTheDocument()
    expect(h.screen.getByText('Relations and credits')).toBeInTheDocument()
  })

  it('filters artists by name, type, alias and credit hints', async () => {
    window.history.pushState({}, '', '/artists')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.type(
      h.screen.getByRole('searchbox', { name: 'Search artists' }),
      'remixer',
    )

    expect(h.screen.getByRole('button', { name: /the dfa/i })).toBeVisible()
    expect(
      h.screen.queryByRole('button', { name: /new order/i }),
    ).not.toBeInTheDocument()
  })

  it('updates artist detail when an artist row is selected', async () => {
    window.history.pushState({}, '', '/artists')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: /the dfa/i }))

    const detailPanel = h.screen.getByRole('complementary', { name: 'The DFA' })

    expect(
      h.within(detailPanel).getByRole('heading', { name: 'The DFA' }),
    ).toBeInTheDocument()
    expect(
      h.within(detailPanel).getAllByText('Remixer').length,
    ).toBeGreaterThan(0)
    expect(
      h.within(detailPanel).getByText('LCD Soundsystem'),
    ).toBeInTheDocument()
  })

  it('deduplicates repeated memberOf relations in artist rows and details', () => {
    h.seedCatalogForTests({
      artists: [
        {
          ...h.artistRecords[0],
          id: 'alan-wilder',
          name: 'Alan Wilder',
          type: 'Person',
          aliases: [],
          members: [],
          relationHint: 'Member of, Member of',
          relations: [
            {
              type: 'Member of',
              target: 'Depeche Mode',
              detail: 'Keyboardist.',
            },
            {
              type: 'Member of',
              target: 'Depeche Mode',
              detail: 'Keyboardist.',
            },
          ],
        },
        {
          ...h.artistRecords[2],
          id: 'depeche-mode',
          name: 'Depeche Mode',
          type: 'Band',
          members: ['Alan Wilder'],
          relations: [
            {
              type: 'Member of',
              target: 'Alan Wilder',
              detail: 'Reverse imported member relation.',
            },
            {
              type: 'Member of',
              target: 'Alan Wilder',
              detail: 'Reverse imported member relation.',
            },
          ],
        },
      ],
      releases: [],
      tracks: [],
      ownedItems: [],
      relations: [],
      playlists: [],
    })
    window.history.pushState({}, '', '/artists')

    h.render(<h.App />)

    const row = h.screen.getByRole('button', { name: /alan wilder/i })
    expect(h.within(row).getAllByText('Member of Depeche Mode')).toHaveLength(
      1,
    )
    expect(h.within(row).queryByText('Aliases')).not.toBeInTheDocument()
    expect(h.within(row).queryByText('Members')).not.toBeInTheDocument()

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Alan Wilder',
    })
    const relationsSection = h.detailSection(detailPanel, 'Relations and credits')
    expect(h.within(relationsSection).getAllByText('Member of')).toHaveLength(1)
    expect(h.within(relationsSection).getAllByText('Depeche Mode')).toHaveLength(
      1,
    )
    expect(
      h
        .within(relationsSection)
        .queryByText('Member of Alan Wilder to Depeche Mode'),
    ).not.toBeInTheDocument()

    const bandRow = h.screen.getByRole('button', {
      name: /depeche mode artist row/i,
    })
    expect(h.within(bandRow).getByText('Members: Alan Wilder')).toBeInTheDocument()
    expect(h.within(bandRow).queryByText('Memberships')).not.toBeInTheDocument()
    expect(
      h.within(bandRow).queryByText('Member of Alan Wilder'),
    ).not.toBeInTheDocument()
  })

  it('presents aliasOf relations as artist identity real names and aliases', async () => {
    h.seedCatalogForTests({
      artists: [
        {
          ...h.artistRecords[0],
          id: 'flood',
          name: 'Flood',
          type: 'Person',
          aliases: [],
          members: [],
          relations: [
            {
              type: 'aliasOf',
              target: 'Mark Ellis',
              detail: '',
            },
          ],
        },
        {
          ...h.artistRecords[1],
          id: 'mark-ellis',
          name: 'Mark Ellis',
          type: 'Person',
          aliases: [],
          members: [],
          relations: [
            {
              direction: 'incoming',
              type: 'Alias of',
              target: 'Flood',
              detail: '',
            },
          ],
        },
      ],
      releases: [],
      tracks: [],
      ownedItems: [],
      relations: [],
      playlists: [],
    })
    window.history.pushState({}, '', '/artists?artist=flood')
    const user = h.userEvent.setup()

    h.render(<h.App />)

    const floodRow = h.screen.getByRole('button', { name: /flood/i })
    const markEllisRow = h.screen.getByRole('button', { name: /mark ellis/i })
    expect(h.within(floodRow).getByText('Real name: Mark Ellis')).toBeInTheDocument()
    expect(h.within(markEllisRow).getByText('Aliases: Flood')).toBeInTheDocument()

    const floodPanel = h.screen.getByRole('complementary', { name: 'Flood' })
    const floodIdentitySection = h.detailSection(floodPanel, 'Identity')
    expect(h.within(floodIdentitySection).getByText('Real name')).toBeInTheDocument()
    expect(h.within(floodIdentitySection).getByText('Mark Ellis')).toBeInTheDocument()
    expect(
      h.within(floodIdentitySection).queryByText('Aliases'),
    ).not.toBeInTheDocument()
    expect(
      h
        .within(h.detailSection(floodPanel, 'Relations and credits'))
        .queryByText('Other relations'),
    ).not.toBeInTheDocument()
    expect(
      h.within(floodPanel).queryByText('aliasOf'),
    ).not.toBeInTheDocument()

    await user.click(markEllisRow)

    const markEllisPanel = h.screen.getByRole('complementary', {
      name: 'Mark Ellis',
    })
    const markEllisIdentitySection = h.detailSection(markEllisPanel, 'Identity')
    expect(
      h.within(markEllisIdentitySection).getByText('Real name'),
    ).toBeInTheDocument()
    expect(h.within(markEllisIdentitySection).getByText('Mark Ellis')).toBeInTheDocument()
    expect(
      h.within(markEllisPanel).queryByText('Real name: Flood'),
    ).not.toBeInTheDocument()
    expect(h.within(markEllisIdentitySection).getByText('Aliases')).toBeInTheDocument()
    expect(h.within(markEllisIdentitySection).getByText('Flood')).toBeInTheDocument()
    expect(
      h
        .within(h.detailSection(markEllisPanel, 'Relations and credits'))
        .queryByText('Other relations'),
    ).not.toBeInTheDocument()
  })

  it('allows editing the type of an existing artist', async () => {
    window.history.pushState({}, '', '/artists?artist=new-order')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Edit record' }))
    const form = h.screen.getByRole('form', { name: 'Edit artist' })
    const typeSelect = h.within(form).getByLabelText('Type')
    const typeOptions = h.within(typeSelect).getAllByRole('option')

    expect(typeSelect).toBeEnabled()
    expect(typeOptions.map((option) => option.textContent)).toEqual([
      'Person',
      'Band',
    ])
    await user.selectOptions(typeSelect, 'Person')
    await user.click(h.within(form).getByRole('button', { name: 'Save record' }))

    const updatedArtist = h
      .getInitialCatalogStateForTests()
      ?.artists.find((artist) => artist.id === 'new-order')
    expect(updatedArtist?.type).toBe('Person')
  })

  it('normalizes unsupported legacy artist type when editing', async () => {
    window.history.pushState({}, '', '/artists?artist=aphex-twin')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Edit record' }))
    const form = h.screen.getByRole('form', { name: 'Edit artist' })
    const typeSelect = h.within(form).getByLabelText('Type')
    const typeOptions = h.within(typeSelect).getAllByRole('option')

    expect(typeSelect).toHaveValue('Person')
    expect(typeOptions.map((option) => option.textContent)).toEqual([
      'Person',
      'Band',
    ])
    await user.click(h.within(form).getByRole('button', { name: 'Save record' }))

    const updatedArtist = h
      .getInitialCatalogStateForTests()
      ?.artists.find((artist) => artist.id === 'aphex-twin')
    expect(updatedArtist?.type).toBe('Person')
  })

  it('does not render legacy artist aliases members tags or copy sections', () => {
    h.seedCatalogForTests({
      artists: [
        {
          ...h.artistRecords[0],
          id: 'legacy-artist',
          name: 'Legacy Artist',
          type: 'Person',
          aliases: ['Legacy Alias'],
          members: ['Legacy Member'],
          tags: ['Legacy Tag'],
          relations: [],
        },
      ],
      releases: [],
      tracks: [],
      ownedItems: [
        {
          ...h.ownedItemRecords[0],
          id: 'legacy-copy',
          artist: 'Legacy Artist',
          title: 'Legacy Copy',
        },
      ],
      relations: [],
      playlists: [],
    })
    window.history.pushState({}, '', '/artists?artist=legacy-artist')

    h.render(<h.App />)

    const row = h.screen.getByRole('button', { name: /legacy artist/i })
    expect(h.within(row).queryByText('Legacy Alias')).not.toBeInTheDocument()
    expect(h.within(row).queryByText('Legacy Member')).not.toBeInTheDocument()
    expect(h.within(row).queryByText('Legacy Tag')).not.toBeInTheDocument()

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Legacy Artist',
    })
    expect(
      h.within(detailPanel).queryByText('Collection copies'),
    ).not.toBeInTheDocument()
    expect(
      h.within(detailPanel).queryByText('Aliases, members and tags'),
    ).not.toBeInTheDocument()
    expect(h.within(detailPanel).queryByText('Legacy Copy')).not.toBeInTheDocument()
  })

  it('links known artist credit and relation targets while leaving unknown targets as plain text', () => {
    window.history.pushState({}, '', '/artists?artist=aphex-twin')

    h.render(<h.App />)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Aphex Twin',
    })

    expect(
      h
        .within(h.detailSection(detailPanel, 'Credit appearances'))
        .getAllByRole('link', { name: 'Selected Ambient Works 85-92' })[0],
    ).toHaveAttribute('href', '/releases?release=selected-ambient-works-85-92')
    expect(
      h
        .within(h.detailSection(detailPanel, 'Credit appearances'))
        .getByRole('link', { name: 'Polynomial-C' }),
    ).toHaveAttribute('href', '/tracks?track=polynomial-c')
    expect(
      h
        .within(h.detailSection(detailPanel, 'Relations and credits'))
        .queryByText('AFX'),
    ).not.toBeInTheDocument()
    expect(
      h.within(detailPanel).queryByRole('link', { name: 'AFX' }),
    ).not.toBeInTheDocument()
  })

  it('lists artist release and track appearances with contribution roles', () => {
    window.history.pushState({}, '', '/artists?artist=aphex-twin')

    h.render(<h.App />)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Aphex Twin',
    })
    const creditSection = h.detailSection(detailPanel, 'Credit appearances')

    expect(
      h.within(creditSection).getByRole('heading', { name: 'Releases' }),
    ).toBeInTheDocument()
    expect(
      h.within(creditSection).getByRole('heading', { name: 'Tracks' }),
    ).toBeInTheDocument()
    expect(
      h.within(creditSection).queryByRole('heading', { name: 'Main artist' }),
    ).not.toBeInTheDocument()
    expect(
      h.within(creditSection).getByRole('link', { name: 'Polynomial-C' }),
    ).toHaveAttribute('href', '/tracks?track=polynomial-c')
    expect(h.within(creditSection).getByText('Composer')).toBeInTheDocument()
  })

  it('shows release cover thumbnails in artist release credit appearances', () => {
    h.seedCatalogWithSelectedAmbientCover()
    window.history.pushState({}, '', '/artists?artist=aphex-twin')

    h.render(<h.App />)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Aphex Twin',
    })

    expect(
      h
        .within(h.detailSection(detailPanel, 'Credit appearances'))
        .getByRole('img', {
          name: 'Selected Ambient Works 85-92 cover thumbnail',
        }),
    ).toHaveAttribute(
      'src',
      '/api/releases/selected-ambient-works-85-92/cover-image',
    )
  })
})
