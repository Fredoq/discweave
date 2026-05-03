import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/catalog')
  })

  it('renders the catalog workspace navigation and search', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Catalog' })).toBeInTheDocument()
    expect(
      screen.getByRole('searchbox', { name: 'Search collection' }),
    ).toBeInTheDocument()

    for (const item of [
      'Catalog',
      'Artists',
      'Releases',
      'Tracks',
      'Playlists',
      'Owned Items',
      'Relations',
      'Imports',
      'Exports',
      'Settings',
    ]) {
      expect(screen.getByRole('link', { name: item })).toBeInTheDocument()
    }
  })

  it('navigates between workspace sections from the sidebar', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: 'Artists' }))

    expect(screen.getByRole('heading', { name: 'Artists' })).toBeInTheDocument()
    expect(
      screen.getByRole('searchbox', { name: 'Search artists' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Artists' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(
      screen.queryByRole('searchbox', { name: 'Search collection' }),
    ).not.toBeInTheDocument()
  })

  it('reports placeholder route actions without leaving the workspace', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: 'Artists' }))
    await user.click(screen.getByRole('button', { name: 'Add artist' }))

    expect(screen.getByRole('status')).toHaveTextContent(
      'Add artist is queued for the Artists workspace.',
    )
    expect(screen.getByRole('heading', { name: 'Artists' })).toBeInTheDocument()
  })

  it('renders the catalog workspace at /catalog', () => {
    window.history.pushState({}, '', '/catalog')

    render(<App />)

    expect(screen.getByRole('heading', { name: 'Catalog' })).toBeInTheDocument()
    expect(
      screen.getByRole('searchbox', { name: 'Search collection' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Catalog workspace' }),
    ).toBeInTheDocument()
  })

  it.each([
    ['/releases', 'Releases', 'Search releases'],
    ['/playlists', 'Playlists', 'Search playlists'],
    ['/imports', 'Imports', 'Local folder scans and metadata intake.'],
    ['/exports', 'Exports', 'Portable snapshots for collection data.'],
  ])('renders the %s workspace route', (path, heading, description) => {
    window.history.pushState({}, '', path)

    render(<App />)

    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    if (path === '/releases' || path === '/playlists') {
      expect(screen.getByRole('searchbox', { name: description })).toBeVisible()
    } else {
      expect(screen.getByText(description)).toBeInTheDocument()
    }
    expect(screen.getByRole('link', { name: heading })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('renders the artists workspace with relation-first artist rows', () => {
    window.history.pushState({}, '', '/artists')

    render(<App />)

    expect(
      screen.getByRole('region', { name: 'Artists workspace' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('searchbox', { name: 'Search artists' }),
    ).toBeVisible()
    expect(screen.getByRole('row', { name: /aphex twin/i })).toBeVisible()
    expect(screen.getByRole('row', { name: /the dfa/i })).toBeVisible()
    expect(
      screen.getByRole('complementary', { name: 'Aphex Twin' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Relations and credits')).toBeInTheDocument()
  })

  it('filters artists by name, type, alias and credit hints', async () => {
    window.history.pushState({}, '', '/artists')
    const user = userEvent.setup()
    render(<App />)

    await user.type(
      screen.getByRole('searchbox', { name: 'Search artists' }),
      'remixer',
    )

    expect(screen.getByRole('row', { name: /the dfa/i })).toBeVisible()
    expect(
      screen.queryByRole('row', { name: /new order/i }),
    ).not.toBeInTheDocument()
  })

  it('updates artist detail when an artist row is selected', async () => {
    window.history.pushState({}, '', '/artists')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /the dfa/i }))

    const detailPanel = screen.getByRole('complementary', { name: 'The DFA' })

    expect(
      within(detailPanel).getByRole('heading', { name: 'The DFA' }),
    ).toBeInTheDocument()
    expect(within(detailPanel).getByText('Remixer')).toBeInTheDocument()
    expect(within(detailPanel).getByText('LCD Soundsystem')).toBeInTheDocument()
  })

  it('renders the releases workspace with release rows and selected detail', () => {
    window.history.pushState({}, '', '/releases')

    render(<App />)

    expect(
      screen.getByRole('region', { name: 'Releases workspace' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('searchbox', { name: 'Search releases' }),
    ).toBeVisible()
    expect(
      screen.getByRole('row', { name: /selected ambient works 85-92/i }),
    ).toBeVisible()
    expect(
      screen.getByRole('complementary', {
        name: 'Selected Ambient Works 85-92',
      }),
    ).toBeInTheDocument()
  })

  it('filters releases by title, artist, label, year, media and ownership status', async () => {
    window.history.pushState({}, '', '/releases')
    const user = userEvent.setup()
    render(<App />)

    await user.type(
      screen.getByRole('searchbox', { name: 'Search releases' }),
      'factory needs digitization',
    )

    expect(screen.getByRole('row', { name: /blue monday/i })).toBeVisible()
    expect(
      screen.queryByRole('row', { name: /selected ambient works/i }),
    ).not.toBeInTheDocument()
  })

  it('separates release metadata from owned copies in release detail', () => {
    window.history.pushState({}, '', '/releases')

    render(<App />)

    const detailPanel = screen.getByRole('complementary', {
      name: 'Selected Ambient Works 85-92',
    })

    expect(
      within(detailPanel).getByRole('heading', { name: 'Release metadata' }),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).getByRole('heading', { name: 'Owned copies' }),
    ).toBeInTheDocument()
    expect(within(detailPanel).getByText('Warp')).toBeInTheDocument()
    expect(within(detailPanel).getByText('Digital library')).toBeInTheDocument()
  })

  it('selects a release from the release query parameter', () => {
    window.history.pushState({}, '', '/releases?release=blue-monday')

    render(<App />)

    expect(
      screen.getByRole('complementary', { name: 'Blue Monday' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /blue monday/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('renders the tracks workspace with track rows and selected detail', () => {
    window.history.pushState({}, '', '/tracks')

    render(<App />)

    expect(
      screen.getByRole('region', { name: 'Tracks workspace' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('searchbox', { name: 'Search tracks' }),
    ).toBeVisible()
    expect(screen.getByRole('row', { name: /polynomial-c/i })).toBeVisible()
    expect(
      screen.getByRole('complementary', { name: 'Polynomial-C' }),
    ).toBeInTheDocument()
  })

  it('filters tracks by title, artist, release, duration, credits, versions, relations and file format', async () => {
    window.history.pushState({}, '', '/tracks')
    const user = userEvent.setup()
    render(<App />)

    await user.type(
      screen.getByRole('searchbox', { name: 'Search tracks' }),
      'new order 07:29 factory version wav',
    )

    expect(screen.getByRole('row', { name: /blue monday/i })).toBeVisible()
    expect(
      screen.queryByRole('row', { name: /polynomial-c/i }),
    ).not.toBeInTheDocument()
  })

  it('updates track detail when a track row is selected', async () => {
    window.history.pushState({}, '', '/tracks')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /blue monday/i }))

    const detailPanel = screen.getByRole('complementary', {
      name: 'Blue Monday',
    })

    expect(
      within(detailPanel).getByRole('heading', { name: 'Blue Monday' }),
    ).toBeInTheDocument()
    expect(within(detailPanel).getAllByText('New Order')).toHaveLength(4)
    expect(within(detailPanel).getByText(/factory/i)).toBeInTheDocument()
  })

  it('shows release link, credits, relations and file metadata as separate track detail sections', () => {
    window.history.pushState({}, '', '/tracks')

    render(<App />)

    const detailPanel = screen.getByRole('complementary', {
      name: 'Polynomial-C',
    })

    expect(
      within(detailPanel).getByRole('heading', { name: 'Linked release' }),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).getByRole('link', {
        name: 'Selected Ambient Works 85-92',
      }),
    ).toHaveAttribute('href', '/releases?release=selected-ambient-works-85-92')
    expect(
      within(detailPanel).getByRole('heading', { name: 'Track credits' }),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).getByRole('heading', {
        name: 'Versions and relations',
      }),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).getByRole('heading', { name: 'Local file metadata' }),
    ).toBeInTheDocument()
    expect(within(detailPanel).getByText('FLAC')).toBeInTheDocument()
    expect(
      within(detailPanel).getByText('44.1 kHz / 16-bit'),
    ).toBeInTheDocument()
  })

  it('renders the playlists workspace with manual and smart playlist rows', () => {
    window.history.pushState({}, '', '/playlists')

    render(<App />)

    expect(
      screen.getByRole('region', { name: 'Playlists workspace' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('searchbox', { name: 'Search playlists' }),
    ).toBeVisible()
    expect(
      screen.getByRole('row', { name: /late night lossless shelf/i }),
    ).toBeVisible()
    expect(
      screen.getByRole('row', { name: /lossless idm digital/i }),
    ).toBeVisible()
    expect(
      screen.getByRole('row', { name: /needs digitization physical/i }),
    ).toBeVisible()
    expect(
      screen.getByRole('complementary', {
        name: 'Late night lossless shelf',
      }),
    ).toBeInTheDocument()
  })

  it('filters playlists by name, type, track, artist, release, tags, year range, format, ownership and rule hints', async () => {
    window.history.pushState({}, '', '/playlists')
    const user = userEvent.setup()
    render(<App />)

    await user.type(
      screen.getByRole('searchbox', { name: 'Search playlists' }),
      'smart 1980-1989 new order vinyl needs digitization missing',
    )

    expect(
      screen.getByRole('row', { name: /needs digitization physical/i }),
    ).toBeVisible()
    expect(
      screen.queryByRole('row', { name: /late night lossless shelf/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('row', { name: /lossless idm digital/i }),
    ).not.toBeInTheDocument()
  })

  it('updates playlist detail when a playlist row is selected', async () => {
    window.history.pushState({}, '', '/playlists')
    const user = userEvent.setup()
    render(<App />)

    await user.click(
      screen.getByRole('button', { name: /needs digitization physical/i }),
    )

    const detailPanel = screen.getByRole('complementary', {
      name: 'Needs digitization physical',
    })

    expect(
      within(detailPanel).getByRole('heading', {
        name: 'Needs digitization physical',
      }),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).getAllByRole('link', { name: 'Blue Monday' }).length,
    ).toBeGreaterThan(0)
    expect(
      within(detailPanel).getByText('Ownership status is Needs digitization.'),
    ).toBeInTheDocument()
  })

  it('shows manual track selection in manual playlist detail', () => {
    window.history.pushState({}, '', '/playlists')

    render(<App />)

    const detailPanel = screen.getByRole('complementary', {
      name: 'Late night lossless shelf',
    })

    expect(
      within(
        detailSection(detailPanel, 'Smart rules / manual selection'),
      ).getByText('Manual track selection'),
    ).toBeInTheDocument()
    expect(
      within(
        detailSection(detailPanel, 'Smart rules / manual selection'),
      ).getByText(/no automatic catalog rule/i),
    ).toBeInTheDocument()
  })

  it('shows readable rule criteria in smart playlist detail', async () => {
    window.history.pushState({}, '', '/playlists')
    const user = userEvent.setup()
    render(<App />)

    await user.click(
      screen.getByRole('button', { name: /lossless idm digital/i }),
    )

    const detailPanel = screen.getByRole('complementary', {
      name: 'Lossless IDM digital',
    })
    const rulesSection = detailSection(
      detailPanel,
      'Smart rules / manual selection',
    )

    expect(
      within(rulesSection).getByText(
        'Tags and file criteria select lossless digital IDM tracks.',
      ),
    ).toBeInTheDocument()
    expect(
      within(rulesSection).getByText('File format is FLAC.'),
    ).toBeInTheDocument()
  })

  it('shows playlist tracks, linked releases and owned availability as separate detail sections', () => {
    window.history.pushState({}, '', '/playlists')

    render(<App />)

    const detailPanel = screen.getByRole('complementary', {
      name: 'Late night lossless shelf',
    })

    expect(
      within(detailPanel).getByRole('heading', {
        name: 'Playlist metadata',
      }),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).getByRole('heading', { name: 'Tracks' }),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).getByRole('heading', {
        name: 'Smart rules / manual selection',
      }),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).getByRole('heading', {
        name: 'Linked releases and owned availability',
      }),
    ).toBeInTheDocument()
    expect(
      within(detailSection(detailPanel, 'Tracks')).getByRole('link', {
        name: 'Polynomial-C',
      }),
    ).toHaveAttribute('href', '/tracks')
    expect(
      within(detailPanel).getAllByRole('link', {
        name: 'Selected Ambient Works 85-92',
      })[0],
    ).toHaveAttribute('href', '/releases?release=selected-ambient-works-85-92')
    expect(within(detailPanel).getAllByText('Owned').length).toBeGreaterThan(0)
    expect(
      within(detailPanel).getByText(
        'Digital library and CD shelf B1 are available.',
      ),
    ).toBeInTheDocument()
  })

  it('shows an empty detail state when no playlists match the search query', async () => {
    window.history.pushState({}, '', '/playlists')
    const user = userEvent.setup()
    render(<App />)

    await user.type(
      screen.getByRole('searchbox', { name: 'Search playlists' }),
      'zzz no match at all',
    )

    expect(screen.getByText('0 shown')).toBeInTheDocument()
    expect(screen.getByText('No matching playlists.')).toBeInTheDocument()
  })

  it('renders the owned items workspace with copy rows and selected detail', () => {
    window.history.pushState({}, '', '/owned-items')

    render(<App />)

    expect(
      screen.getByRole('region', { name: 'Owned Items workspace' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('searchbox', { name: 'Search owned items' }),
    ).toBeVisible()
    expect(
      screen.getByRole('row', { name: /selected ambient works cd/i }),
    ).toBeVisible()
    expect(
      screen.getByRole('complementary', {
        name: 'Selected Ambient Works CD',
      }),
    ).toBeInTheDocument()
  })

  it('filters owned items by release, artist, medium, status, storage, condition and file format', async () => {
    window.history.pushState({}, '', '/owned-items')
    const user = userEvent.setup()
    render(<App />)

    await user.type(
      screen.getByRole('searchbox', { name: 'Search owned items' }),
      'new order vinyl shelf a3 needs digitization',
    )

    expect(
      screen.getByRole('row', { name: /blue monday vinyl/i }),
    ).toBeVisible()
    expect(
      screen.queryByRole('row', { name: /selected ambient works cd/i }),
    ).not.toBeInTheDocument()
  })

  it('updates owned item detail when an owned item row is selected', async () => {
    window.history.pushState({}, '', '/owned-items')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /blue monday vinyl/i }))

    const detailPanel = screen.getByRole('complementary', {
      name: 'Blue Monday vinyl',
    })

    expect(
      within(detailPanel).getByRole('heading', { name: 'Blue Monday vinyl' }),
    ).toBeInTheDocument()
    expect(within(detailPanel).getByText('Shelf A3')).toBeInTheDocument()
    expect(
      within(detailSection(detailPanel, 'Ownership state')).getByText(
        'Needs digitization',
      ),
    ).toBeInTheDocument()
    expect(
      within(
        detailSection(detailPanel, 'Digital and digitization metadata'),
      ).getByText('Needs digitization'),
    ).toBeInTheDocument()
  })

  it('shows release link, ownership, physical details and digitization metadata as separate owned item detail sections', () => {
    window.history.pushState({}, '', '/owned-items')

    render(<App />)

    const detailPanel = screen.getByRole('complementary', {
      name: 'Selected Ambient Works CD',
    })

    expect(
      within(detailPanel).getByRole('heading', { name: 'Linked catalog item' }),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).getByRole('link', {
        name: 'Selected Ambient Works 85-92',
      }),
    ).toHaveAttribute('href', '/releases?release=selected-ambient-works-85-92')
    expect(
      within(detailPanel).getByRole('heading', { name: 'Ownership state' }),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).getByRole('heading', { name: 'Physical details' }),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).getByRole('heading', {
        name: 'Digital and digitization metadata',
      }),
    ).toBeInTheDocument()
    expect(within(detailPanel).getByText('Very Good')).toBeInTheDocument()
    expect(
      within(detailPanel).getByText('Verified FLAC rip'),
    ).toBeInTheDocument()
  })

  it('renders the relations workspace with graph rows and selected detail', () => {
    window.history.pushState({}, '', '/relations')

    render(<App />)

    expect(
      screen.getByRole('region', { name: 'Relations workspace' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('searchbox', { name: 'Search relations' }),
    ).toBeVisible()
    expect(
      screen.getByRole('row', { name: /richard d. james aphex twin/i }),
    ).toBeVisible()
    expect(
      screen.getByRole('complementary', {
        name: 'Richard D. James to Aphex Twin',
      }),
    ).toBeInTheDocument()
  })

  it('filters relations by source, target, type, role, release, track and context hints', async () => {
    window.history.pushState({}, '', '/relations')
    const user = userEvent.setup()
    render(<App />)

    await user.type(
      screen.getByRole('searchbox', { name: 'Search relations' }),
      'dfa remixer lcd soundsystem yeah',
    )

    expect(
      screen.getByRole('row', { name: /the dfa lcd soundsystem/i }),
    ).toBeVisible()
    expect(
      screen.queryByRole('row', { name: /richard d. james aphex twin/i }),
    ).not.toBeInTheDocument()
  })

  it('updates relation detail when a relation row is selected', async () => {
    window.history.pushState({}, '', '/relations')
    const user = userEvent.setup()
    render(<App />)

    await user.click(
      screen.getByRole('button', { name: /the dfa lcd soundsystem/i }),
    )

    const detailPanel = screen.getByRole('complementary', {
      name: 'The DFA to LCD Soundsystem',
    })

    expect(
      within(detailPanel).getByRole('heading', {
        name: 'The DFA to LCD Soundsystem',
      }),
    ).toBeInTheDocument()
    expect(within(detailPanel).getAllByText('Remixer')).toHaveLength(2)
    expect(
      within(detailPanel).getAllByText('Yeah (Pretentious Mix)'),
    ).toHaveLength(2)
  })

  it('keeps relation detail aligned with the filtered selection when search is cleared', async () => {
    window.history.pushState({}, '', '/relations')
    const user = userEvent.setup()
    render(<App />)

    const searchbox = screen.getByRole('searchbox', {
      name: 'Search relations',
    })

    await user.type(searchbox, 'dfa remixer')

    expect(
      screen.getByRole('complementary', {
        name: 'The DFA to LCD Soundsystem',
      }),
    ).toBeInTheDocument()

    await user.clear(searchbox)

    expect(
      screen.getByRole('row', { name: /the dfa lcd soundsystem/i }),
    ).toHaveAttribute('aria-selected', 'true')
    expect(
      screen.getByRole('complementary', {
        name: 'The DFA to LCD Soundsystem',
      }),
    ).toBeInTheDocument()
  })

  it('shows endpoints, relation context, linked evidence and search hints as separate relation detail sections', () => {
    window.history.pushState({}, '', '/relations')

    render(<App />)

    const detailPanel = screen.getByRole('complementary', {
      name: 'Richard D. James to Aphex Twin',
    })

    expect(
      within(detailPanel).getByRole('heading', { name: 'Endpoints' }),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).getByRole('heading', { name: 'Relation context' }),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).getByRole('heading', { name: 'Linked evidence' }),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).getByRole('heading', { name: 'Search hints' }),
    ).toBeInTheDocument()
    expect(within(detailPanel).getAllByText('Alias')).toHaveLength(3)
    expect(
      within(detailPanel).getByRole('link', { name: 'Aphex Twin' }),
    ).toHaveAttribute('href', '/artists')
  })

  it('filters catalog rows by media, status and relation text', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByRole('searchbox'), 'lossless')

    expect(screen.getByRole('row', { name: /polynomial-c/i })).toBeVisible()
    expect(
      screen.queryByRole('row', { name: /blue monday/i }),
    ).not.toBeInTheDocument()
  })

  it('keeps the detail panel in sync with filtered results', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByRole('searchbox'), 'lossless')

    const detailPanel = screen.getByRole('complementary', {
      name: 'Polynomial-C',
    })

    expect(
      within(detailPanel).getByRole('heading', { name: 'Polynomial-C' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('complementary', {
        name: 'Selected Ambient Works 85-92',
      }),
    ).not.toBeInTheDocument()
  })

  it('shows an empty detail state when no catalog rows match', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByRole('searchbox'), 'no matching catalog item')

    expect(screen.getByText('0 shown')).toBeInTheDocument()
    expect(screen.getByText('No matching catalog entries.')).toBeInTheDocument()
  })

  it('applies saved-view filters to catalog rows', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Needs digitization' }))

    expect(
      screen.getByRole('button', { name: 'Needs digitization' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('row', { name: /blue monday/i })).toBeVisible()
    expect(
      screen.queryByRole('row', { name: /polynomial-c/i }),
    ).not.toBeInTheDocument()
  })

  it('updates the detail panel when a catalog row is selected', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /blue monday/i }))

    const detailPanel = screen.getByRole('complementary', {
      name: 'Blue Monday',
    })

    expect(
      within(detailPanel).getByRole('heading', { name: 'Blue Monday' }),
    ).toBeInTheDocument()
    expect(within(detailPanel).getByText('12-inch vinyl')).toBeInTheDocument()
    expect(within(detailPanel).getByText('Shelf A3')).toBeInTheDocument()
  })
})

function detailSection(panel: HTMLElement, headingName: string) {
  const heading = within(panel).getByRole('heading', { name: headingName })
  const section = heading.closest('section')

  if (!section) {
    throw new Error(`Missing detail section for heading: ${headingName}`)
  }

  return section
}
