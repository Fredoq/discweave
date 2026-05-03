import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
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
