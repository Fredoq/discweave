import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App owned item and relation workspaces', () => {
  it('renders the owned items workspace with copy rows and selected detail', () => {
    window.history.pushState({}, '', '/owned-items')

    h.render(<h.App />)

    expect(
      h.screen.getByRole('region', { name: 'Owned Items workspace' }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('searchbox', { name: 'Search owned items' }),
    ).toBeVisible()
    expect(
      h.screen.getByRole('row', { name: /selected ambient works cd/i }),
    ).toBeVisible()
    expect(
      h.screen.getByRole('complementary', {
        name: 'Selected Ambient Works CD',
      }),
    ).toBeInTheDocument()
  })

  it('filters owned items by release, artist, medium, status, storage, condition and file format', async () => {
    window.history.pushState({}, '', '/owned-items')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.type(
      h.screen.getByRole('searchbox', { name: 'Search owned items' }),
      'new order vinyl shelf a3 needs digitization',
    )

    expect(
      h.screen.getByRole('row', { name: /blue monday vinyl/i }),
    ).toBeVisible()
    expect(
      h.screen.queryByRole('row', { name: /selected ambient works cd/i }),
    ).not.toBeInTheDocument()
  })

  it('updates owned item detail when an owned item row is selected', async () => {
    window.history.pushState({}, '', '/owned-items')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(
      h.screen.getByRole('button', { name: /blue monday vinyl/i }),
    )

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Blue Monday vinyl',
    })

    expect(
      h.within(detailPanel).getByRole('heading', { name: 'Blue Monday vinyl' }),
    ).toBeInTheDocument()
    expect(h.within(detailPanel).getByText('Shelf A3')).toBeInTheDocument()
    expect(
      h
        .within(h.detailSection(detailPanel, 'Ownership state'))
        .getByText('Needs digitization'),
    ).toBeInTheDocument()
    expect(
      h
        .within(
          h.detailSection(detailPanel, 'Digital and digitization metadata'),
        )
        .getByText('Needs digitization'),
    ).toBeInTheDocument()
  })

  it('shows release link, ownership, physical details and digitization metadata as separate owned item detail sections', () => {
    window.history.pushState({}, '', '/owned-items')

    h.render(<h.App />)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Selected Ambient Works CD',
    })

    expect(
      h
        .within(detailPanel)
        .getByRole('heading', { name: 'Linked catalog item' }),
    ).toBeInTheDocument()
    expect(
      h.within(detailPanel).getByRole('link', {
        name: 'Selected Ambient Works 85-92',
      }),
    ).toHaveAttribute('href', '/releases?release=selected-ambient-works-85-92')
    expect(
      h.within(detailPanel).getByRole('heading', { name: 'Ownership state' }),
    ).toBeInTheDocument()
    expect(
      h.within(detailPanel).getByRole('heading', { name: 'Physical details' }),
    ).toBeInTheDocument()
    expect(
      h.within(detailPanel).getByRole('heading', {
        name: 'Digital and digitization metadata',
      }),
    ).toBeInTheDocument()
    expect(h.within(detailPanel).getByText('Very Good')).toBeInTheDocument()
    expect(
      h.within(detailPanel).getByText('Verified FLAC rip'),
    ).toBeInTheDocument()
  })

  it('renders an existing linked release in owned item detail as a navigable release link', () => {
    window.history.pushState({}, '', '/owned-items')

    h.render(<h.App />)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Selected Ambient Works CD',
    })

    expect(
      h
        .within(h.detailSection(detailPanel, 'Linked catalog item'))
        .getByRole('link', {
          name: 'Selected Ambient Works 85-92',
        }),
    ).toHaveAttribute('href', '/releases?release=selected-ambient-works-85-92')
  })

  it('lets a manual owned item select an existing release and stores a real release link', async () => {
    window.history.pushState({}, '', '/owned-items')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add owned item' }))
    const form = h.screen.getByRole('form', { name: 'Add owned item' })

    await user.type(h.within(form).getByLabelText('Item name'), 'Shelf B1 Note')
    await user.selectOptions(
      h.within(form).getByLabelText('Existing release'),
      'selected-ambient-works-85-92',
    )
    await user.click(h.screen.getByRole('button', { name: 'Add record' }))

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Shelf B1 Note',
    })

    expect(
      h
        .within(h.detailSection(detailPanel, 'Linked catalog item'))
        .getByRole('link', {
          name: 'Selected Ambient Works 85-92',
        }),
    ).toHaveAttribute('href', '/releases?release=selected-ambient-works-85-92')
  })

  it('lets existing release selection be cleared and replaced by free text in manual forms', async () => {
    window.history.pushState({}, '', '/owned-items')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add owned item' }))
    const form = h.screen.getByRole('form', { name: 'Add owned item' })
    const releaseSelect = h.within(form).getByLabelText('Existing release')
    const releaseInput = h.within(form).getByLabelText('Linked release')

    await user.type(h.within(form).getByLabelText('Item name'), 'Unfiled Copy')
    await user.selectOptions(releaseSelect, 'selected-ambient-works-85-92')

    expect(releaseInput).toBeDisabled()

    await user.selectOptions(releaseSelect, '')
    await user.type(releaseInput, 'Desk Reference Tape')
    await user.click(h.screen.getByRole('button', { name: 'Add record' }))

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Unfiled Copy',
    })

    expect(
      h
        .within(h.detailSection(detailPanel, 'Linked catalog item'))
        .getByText('Desk Reference Tape'),
    ).toBeInTheDocument()
    expect(
      h
        .within(detailPanel)
        .queryByRole('link', { name: 'Desk Reference Tape' }),
    ).not.toBeInTheDocument()
  })

  it('renders the relations workspace with graph rows and selected detail', () => {
    window.history.pushState({}, '', '/relations')

    h.render(<h.App />)

    expect(
      h.screen.getByRole('region', { name: 'Relations workspace' }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('searchbox', { name: 'Search relations' }),
    ).toBeVisible()
    expect(
      h.screen.getByRole('row', { name: /richard d. james aphex twin/i }),
    ).toBeVisible()
    expect(
      h.screen.getByRole('complementary', {
        name: 'Richard D. James to Aphex Twin',
      }),
    ).toBeInTheDocument()
  })

  it('filters relations by source, target, type, role, release, track and context hints', async () => {
    window.history.pushState({}, '', '/relations')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.type(
      h.screen.getByRole('searchbox', { name: 'Search relations' }),
      'dfa remixer lcd soundsystem yeah',
    )

    expect(
      h.screen.getByRole('row', { name: /the dfa lcd soundsystem/i }),
    ).toBeVisible()
    expect(
      h.screen.queryByRole('row', { name: /richard d. james aphex twin/i }),
    ).not.toBeInTheDocument()
  })

  it('updates relation detail when a relation row is selected', async () => {
    window.history.pushState({}, '', '/relations')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(
      h.screen.getByRole('button', { name: /the dfa lcd soundsystem/i }),
    )

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'The DFA to LCD Soundsystem',
    })

    expect(
      h.within(detailPanel).getByRole('heading', {
        name: 'The DFA to LCD Soundsystem',
      }),
    ).toBeInTheDocument()
    expect(
      h.within(detailPanel).getAllByText('Remixer').length,
    ).toBeGreaterThanOrEqual(2)
    expect(
      h.within(detailPanel).getAllByText('Yeah (Pretentious Mix)').length,
    ).toBeGreaterThanOrEqual(2)
  })

  it('restores the current relation selection when a cleared search makes it visible again', async () => {
    window.history.pushState({}, '', '/relations')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    const searchbox = h.screen.getByRole('searchbox', {
      name: 'Search relations',
    })

    await user.type(searchbox, 'dfa remixer')

    expect(
      h.screen.getByRole('complementary', {
        name: 'The DFA to LCD Soundsystem',
      }),
    ).toBeInTheDocument()

    await user.clear(searchbox)

    expect(
      h.screen.getByRole('complementary', {
        name: 'Richard D. James to Aphex Twin',
      }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('row', { name: /richard d. james aphex twin/i }),
    ).toHaveAttribute('aria-selected', 'true')
  })

  it('shows endpoints, relation context, linked evidence and search hints as separate relation detail sections', () => {
    window.history.pushState({}, '', '/relations')

    h.render(<h.App />)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Richard D. James to Aphex Twin',
    })

    expect(
      h.within(detailPanel).getByRole('heading', { name: 'Endpoints' }),
    ).toBeInTheDocument()
    expect(
      h.within(detailPanel).getByRole('heading', { name: 'Relation context' }),
    ).toBeInTheDocument()
    expect(
      h.within(detailPanel).getByRole('heading', { name: 'Linked evidence' }),
    ).toBeInTheDocument()
    expect(
      h.within(detailPanel).getByRole('heading', { name: 'Search hints' }),
    ).toBeInTheDocument()
    expect(h.within(detailPanel).getAllByText('Alias')).toHaveLength(3)
    expect(
      h.within(detailPanel).getAllByRole('link', { name: 'Aphex Twin' })[0],
    ).toHaveAttribute('href', '/artists?artist=aphex-twin')
  })

  it('links existing relation endpoints and linked evidence to their real catalog routes', async () => {
    window.history.pushState({}, '', '/relations')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(
      h.screen.getByRole('button', {
        name: /blue monday 12-inch vinyl blue monday/i,
      }),
    )

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Blue Monday 12-inch vinyl to Blue Monday',
    })

    expect(
      h.within(h.detailSection(detailPanel, 'Endpoints')).getByRole('link', {
        name: 'Blue Monday 12-inch vinyl',
      }),
    ).toHaveAttribute('href', '/owned-items?ownedItem=blue-monday-vinyl')
    expect(
      h.within(h.detailSection(detailPanel, 'Endpoints')).getByRole('link', {
        name: 'Blue Monday',
      }),
    ).toHaveAttribute('href', '/releases?release=blue-monday')
    expect(
      h
        .within(h.detailSection(detailPanel, 'Linked evidence'))
        .getByRole('link', {
          name: 'Blue Monday',
        }),
    ).toHaveAttribute('href', '/releases?release=blue-monday')
  })

  it('keeps unknown relation endpoints and linked evidence as plain text', async () => {
    window.history.pushState({}, '', '/relations')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add relation' }))
    const form = h.screen.getByRole('form', { name: 'Add relation' })

    await user.type(h.within(form).getByLabelText('Source'), 'Unfiled Person')
    await user.type(h.within(form).getByLabelText('Target'), 'Unfiled Project')
    await user.type(
      h.within(form).getByLabelText('Linked entity'),
      'Loose Sleeve Note',
    )
    await user.click(h.screen.getByRole('button', { name: 'Add record' }))

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Unfiled Person to Unfiled Project',
    })

    expect(
      h
        .within(h.detailSection(detailPanel, 'Endpoints'))
        .getByText('Unfiled Person'),
    ).toBeInTheDocument()
    expect(
      h
        .within(h.detailSection(detailPanel, 'Endpoints'))
        .getByText('Unfiled Project'),
    ).toBeInTheDocument()
    expect(
      h
        .within(h.detailSection(detailPanel, 'Linked evidence'))
        .getByText('Loose Sleeve Note'),
    ).toBeInTheDocument()
    expect(
      h.within(detailPanel).queryByRole('link', { name: 'Unfiled Person' }),
    ).not.toBeInTheDocument()
    expect(
      h.within(detailPanel).queryByRole('link', { name: 'Unfiled Project' }),
    ).not.toBeInTheDocument()
    expect(
      h.within(detailPanel).queryByRole('link', { name: 'Loose Sleeve Note' }),
    ).not.toBeInTheDocument()
  })

  it('lets a manual relation select existing catalog records and stores real links', async () => {
    window.history.pushState({}, '', '/relations')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add relation' }))
    const form = h.screen.getByRole('form', { name: 'Add relation' })

    await user.selectOptions(
      h.within(form).getByLabelText('Existing source'),
      'artist:aphex-twin',
    )
    await user.selectOptions(
      h.within(form).getByLabelText('Existing target'),
      'release:selected-ambient-works-85-92',
    )
    await user.selectOptions(
      h.within(form).getByLabelText('Existing linked entity'),
      'track:polynomial-c',
    )
    await user.type(
      h.within(form).getByLabelText('Relation type'),
      'Appears on',
    )
    await user.type(h.within(form).getByLabelText('Role'), 'Main artist')
    await user.click(h.screen.getByRole('button', { name: 'Add record' }))

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Aphex Twin to Selected Ambient Works 85-92',
    })

    expect(
      h.within(h.detailSection(detailPanel, 'Endpoints')).getByRole('link', {
        name: 'Aphex Twin',
      }),
    ).toHaveAttribute('href', '/artists?artist=aphex-twin')
    expect(
      h.within(h.detailSection(detailPanel, 'Endpoints')).getByRole('link', {
        name: 'Selected Ambient Works 85-92',
      }),
    ).toHaveAttribute('href', '/releases?release=selected-ambient-works-85-92')
    expect(
      h
        .within(h.detailSection(detailPanel, 'Linked evidence'))
        .getByRole('link', {
          name: 'Polynomial-C',
        }),
    ).toHaveAttribute('href', '/tracks?track=polynomial-c')
  })
})
