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
    expect(h.screen.getByRole('row', { name: /aphex twin/i })).toBeVisible()
    expect(h.screen.getByRole('row', { name: /the dfa/i })).toBeVisible()
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

    expect(h.screen.getByRole('row', { name: /the dfa/i })).toBeVisible()
    expect(
      h.screen.queryByRole('row', { name: /new order/i }),
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
        .getByText('AFX'),
    ).toBeInTheDocument()
    expect(
      h.within(detailPanel).queryByRole('link', { name: 'AFX' }),
    ).not.toBeInTheDocument()
  })

  it('groups artist release and track appearances by contribution role', () => {
    window.history.pushState({}, '', '/artists?artist=aphex-twin')

    h.render(<h.App />)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Aphex Twin',
    })
    const creditSection = h.detailSection(detailPanel, 'Credit appearances')

    expect(
      h.within(creditSection).getByRole('heading', { name: 'Main artist' }),
    ).toBeInTheDocument()
    expect(
      h.within(creditSection).getByRole('heading', { name: 'Producer' }),
    ).toBeInTheDocument()
    expect(
      h.within(creditSection).getByRole('heading', { name: 'Composer' }),
    ).toBeInTheDocument()
    expect(
      h.within(creditSection).getByRole('link', { name: 'Polynomial-C' }),
    ).toHaveAttribute('href', '/tracks?track=polynomial-c')
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
