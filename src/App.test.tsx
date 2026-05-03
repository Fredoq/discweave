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
      screen.getByText(
        'People, bands, aliases and collectives in the archive.',
      ),
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
    [
      '/releases',
      'Releases',
      'Release records by format, year, label and status.',
    ],
    ['/tracks', 'Tracks', 'Track-level credits, versions and local files.'],
    [
      '/owned-items',
      'Owned Items',
      'Physical and digital copies with condition, storage and ownership state.',
    ],
    ['/imports', 'Imports', 'Local folder scans and metadata intake.'],
    ['/exports', 'Exports', 'Portable snapshots for collection data.'],
  ])('renders the %s workspace route', (path, heading, description) => {
    window.history.pushState({}, '', path)

    render(<App />)

    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    expect(screen.getByText(description)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: heading })).toHaveAttribute(
      'aria-current',
      'page',
    )
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
