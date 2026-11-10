import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'
import { labelCollectionFixture } from './test/labelCollectionFixtures'

h.setupAppTestHooks()

function renderLabels() {
  window.history.pushState({}, '', '/labels?label=archive-editions')
  h.seedCatalogForTests(labelCollectionFixture)
  h.render(<h.App />)
  return h.userEvent.setup()
}
function panel() {
  return h.screen.getByRole('complementary', { name: 'Archive Editions' })
}
function releaseSection() {
  return h.detailSection(panel(), 'Releases on label')
}

describe('App label collection overview', () => {
  it('shows label-specific catalog numbers, artist, year and honest collection status', () => {
    renderLabels()
    const releases = h.within(releaseSection())
    expect(releases.getByText('ARC 002 · ARC 003')).toBeInTheDocument()
    expect(releases.queryByText('OTHER 100')).not.toBeInTheDocument()
    expect(releases.getByText('Archive One Artist')).toBeInTheDocument()
    expect(releases.getAllByText('1991')).toHaveLength(6)
    expect(releases.getByText('Unknown artist')).toBeInTheDocument()
    expect(releases.getByText('Unknown year')).toBeInTheDocument()
    expect(releases.getByText('No catalog number')).toBeInTheDocument()
    expect(releases.getByText('No collection items')).toBeInTheDocument()
    expect(
      releases.getByRole('button', { name: 'All (7)', pressed: true }),
    ).toBeInTheDocument()
    expect(
      h.within(panel()).getByText('7 releases · 8 collection items'),
    ).toBeInTheDocument()
  })

  it('filters in-collection and wanted releases without counting copies or hiding overlap', async () => {
    const user = renderLabels()
    const releases = h.within(releaseSection())
    await user.click(
      releases.getByRole('button', { name: 'In collection (3)' }),
    )
    expect(releases.getAllByRole('link')).toHaveLength(3)
    expect(
      releases.getByRole('link', { name: 'Tape Transfer' }),
    ).toBeInTheDocument()
    expect(
      releases.queryByRole('link', { name: 'Past Copy' }),
    ).not.toBeInTheDocument()
    expect(
      releases.getByRole('link', { name: 'Another Edition' }),
    ).toBeInTheDocument()
    await user.click(releases.getByRole('button', { name: 'Wanted (2)' }))
    await user.click(releases.getByRole('button', { name: 'Wanted (2)' }))
    expect(releases.getAllByRole('link')).toHaveLength(2)
    expect(
      releases.getByRole('link', { name: 'Another Edition' }),
    ).toBeInTheDocument()
    expect(releases.getByRole('status')).toHaveTextContent(
      '2 of 7 releases shown.',
    )
    await user.click(releases.getByRole('button', { name: 'All (7)' }))
    expect(releases.getAllByRole('link')).toHaveLength(7)
  })

  it('combines search and status, then recovers from empty results', async () => {
    const user = renderLabels()
    const releases = h.within(releaseSection())
    const search = releases.getByRole('searchbox', {
      name: 'Search releases on label',
    })
    await user.type(search, '  arc 004  ')
    expect(releases.getAllByRole('link')).toHaveLength(1)
    expect(
      releases.getByRole('link', { name: 'Future Find' }),
    ).toBeInTheDocument()
    await user.click(
      releases.getByRole('button', { name: 'In collection (3)' }),
    )
    expect(
      releases.getByText('No releases match these filters.'),
    ).toBeInTheDocument()
    await user.click(
      releases.getByRole('button', { name: 'Clear release filters' }),
    )
    expect(search).toHaveValue('')
    expect(
      releases.getByRole('button', { name: 'All (7)', pressed: true }),
    ).toBeInTheDocument()
    expect(releases.getAllByRole('link')).toHaveLength(7)
  })

  it('searches the label index by artist and label-specific catalog number', async () => {
    const user = renderLabels()
    const search = h.screen.getByRole('searchbox', { name: 'Search labels' })
    await user.type(search, 'Future Find Artist')
    expect(h.screen.getByText('1 shown from 3 labels.')).toBeInTheDocument()
    await user.clear(search)
    await user.type(search, 'OTHER 100')
    expect(h.screen.getByText('1 shown from 3 labels.')).toBeInTheDocument()
    expect(
      h.screen.getByRole('complementary', { name: 'Second Label' }),
    ).toBeInTheDocument()
    await user.clear(search)
    await user.type(search, 'nonexistent catalog')
    expect(h.screen.getByText('No matching labels.')).toBeInTheDocument()
    await user.clear(search)
    expect(panel()).toBeInTheDocument()
  })

  it('resets release filters on label changes and handles labels with no releases', async () => {
    const user = renderLabels()
    await user.click(
      h.within(releaseSection()).getByRole('button', { name: 'Wanted (2)' }),
    )
    await user.type(
      h.screen.getByRole('searchbox', { name: 'Search releases on label' }),
      'missing',
    )
    await user.click(h.screen.getByRole('button', { name: /Second Label/ }))
    const second = h.within(
      h.screen.getByRole('complementary', { name: 'Second Label' }),
    )
    expect(
      second.getByRole('searchbox', { name: 'Search releases on label' }),
    ).toHaveValue('')
    expect(
      second.getByRole('button', { name: 'All (1)', pressed: true }),
    ).toBeInTheDocument()
    expect(second.getByText('OTHER 100')).toBeInTheDocument()
    await user.click(h.screen.getByRole('button', { name: /Empty Label/ }))
    expect(
      h.screen.getByText('No releases recorded for this label yet.'),
    ).toBeInTheDocument()
    expect(
      h.screen.queryByRole('button', { name: 'Clear release filters' }),
    ).not.toBeInTheDocument()
  })

  it('preserves release and copy destinations, editing cancellation and history navigation', async () => {
    const user = renderLabels()
    expect(
      h.within(releaseSection()).getByRole('link', { name: 'Future Find' }),
    ).toHaveAttribute('href', '/releases?release=wanted')
    const items = h.within(h.detailSection(panel(), 'Collection items'))
    expect(
      items.getByRole('link', { name: 'Future Find Wanted copy' }),
    ).toHaveAttribute('href', '/owned-items?ownedItem=wanted-Wanted-')
    await user.click(
      h.within(panel()).getByRole('button', { name: 'Edit record' }),
    )
    await user.click(h.screen.getByRole('button', { name: 'Cancel' }))
    expect(
      h.screen.queryByRole('heading', { name: 'Edit label' }),
    ).not.toBeInTheDocument()
    await user.click(h.screen.getByRole('button', { name: /Second Label/ }))
    h.act(() => {
      window.history.back()
    })
    await h.waitFor(() => expect(panel()).toBeInTheDocument())
    h.act(() => {
      window.history.forward()
    })
    await h.waitFor(() =>
      expect(
        h.screen.getByRole('complementary', { name: 'Second Label' }),
      ).toBeInTheDocument(),
    )
  })
})
