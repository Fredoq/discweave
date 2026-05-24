import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App release entry tracklists', () => {
  it('links an existing track into a new release tracklist row', async () => {
    window.history.pushState({}, '', '/releases')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add release' }))
    const form = h.screen.getByRole('form', { name: 'Add release' })

    await user.type(
      h.within(form).getByLabelText('Title'),
      'Blue Monday Archive',
    )
    await h.addReleaseArtist(user, form, 'New Order')
    await h.addReleaseLabel(user, form, 'Factory')
    await h.selectReleaseGenre(user, form, 'Synth-pop')
    await user.click(h.within(form).getByRole('button', { name: '+ Track' }))
    await user.type(h.within(form).getByLabelText('Existing track'), 'Blue')
    await user.click(
      h.within(form).getByRole('button', {
        name: /Use existing track Blue Monday/i,
      }),
    )

    expect(
      h.within(form).getByText('Linked to existing track'),
    ).toBeInTheDocument()
    expect(h.within(form).getByLabelText('Track title')).toBeDisabled()
    await user.type(
      h.within(form).getByLabelText('Version note'),
      'Archive appearance',
    )

    await user.click(h.screen.getByRole('button', { name: 'Add record' }))
    await user.click(h.screen.getByRole('link', { name: 'Tracks' }))
    await user.type(
      h.screen.getByRole('searchbox', { name: 'Search tracks' }),
      'Blue Monday',
    )

    const blueMondayRows = h.screen.getAllByRole('row', {
      name: /blue monday/i,
    })
    expect(blueMondayRows).toHaveLength(1)
    await user.click(blueMondayRows[0])

    const trackPanel = h.screen.getByRole('complementary', {
      name: 'Blue Monday',
    })
    const releaseAppearances = h.detailSection(
      trackPanel,
      'Release appearances',
    )

    expect(
      h.within(releaseAppearances).getByRole('link', { name: 'Blue Monday' }),
    ).toBeInTheDocument()
    expect(
      h.within(releaseAppearances).getByRole('link', {
        name: 'Blue Monday Archive',
      }),
    ).toBeInTheDocument()
    expect(
      h.within(releaseAppearances).getByText('Archive appearance'),
    ).toBeInTheDocument()
  })

  it('keeps existing track suggestions unique across draft rows', async () => {
    window.history.pushState({}, '', '/releases')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add release' }))
    const form = h.screen.getByRole('form', { name: 'Add release' })

    await user.type(h.within(form).getByLabelText('Title'), 'Blue Monday Pair')
    await h.addReleaseArtist(user, form, 'New Order')
    await h.addReleaseLabel(user, form, 'Factory')
    await h.selectReleaseGenre(user, form, 'Synth-pop')
    await user.click(h.within(form).getByRole('button', { name: '+ Track' }))
    await user.type(h.within(form).getByLabelText('Existing track'), 'Blue')
    await user.click(
      h.within(form).getByRole('button', {
        name: /Use existing track Blue Monday/i,
      }),
    )
    await user.click(
      h.within(form).getByRole('button', { name: '+ Add track' }),
    )
    await user.type(h.within(form).getByLabelText('Existing track'), 'Blue')

    expect(
      h.within(form).queryByRole('button', {
        name: /Use existing track Blue Monday/i,
      }),
    ).not.toBeInTheDocument()
    expect(
      h.within(form).getByText('No matching existing tracks.'),
    ).toBeVisible()
  })

  it('uses visible row order after deleting draft tracks in a new release', async () => {
    window.history.pushState({}, '', '/releases')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add release' }))
    const form = h.screen.getByRole('form', { name: 'Add release' })

    await user.type(h.within(form).getByLabelText('Title'), 'Trimmed Tracklist')
    await h.addReleaseArtist(user, form, 'New Order')
    await h.addReleaseLabel(user, form, 'Factory')
    await h.selectReleaseGenre(user, form, 'Synth-pop')
    await h.addReleaseTrackRow(user, form, 'First Cut')
    await user.click(
      h.within(form).getByRole('button', { name: '+ Add track' }),
    )
    await user.type(h.within(form).getByLabelText('Track title'), 'Second Cut')
    await user.click(
      h.within(form).getByRole('button', { name: /Track 1 First Cut/ }),
    )
    await user.click(
      h.within(form).getByRole('button', {
        name: 'Remove track 1 from tracklist',
      }),
    )
    await user.click(h.screen.getByRole('button', { name: 'Add record' }))

    await user.click(h.screen.getByRole('link', { name: 'Tracks' }))
    await user.type(
      h.screen.getByRole('searchbox', { name: 'Search tracks' }),
      'Second Cut',
    )
    const trackRow = h.screen.getByRole('row', { name: /second cut/i })

    await user.click(trackRow)
    const releaseAppearances = h.detailSection(
      h.screen.getByRole('complementary', { name: 'Second Cut' }),
      'Release appearances',
    )
    expect(h.within(releaseAppearances).getByText('Track 1')).toBeVisible()
    expect(
      h.within(releaseAppearances).getByRole('link', {
        name: 'Trimmed Tracklist',
      }),
    ).toBeVisible()
  })

  it('removes an edited release tracklist row without deleting the track', async () => {
    window.history.pushState({}, '', '/releases?release=blue-monday')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    const releasePanel = h.screen.getByRole('complementary', {
      name: 'Blue Monday',
    })
    await user.click(
      h.within(releasePanel).getByRole('button', { name: 'Edit record' }),
    )

    const form = h.screen.getByRole('form', { name: 'Edit release' })
    expect(
      h.within(form).getByRole('list', { name: 'Draft tracklist' }),
    ).toBeInTheDocument()

    await user.click(
      h.within(form).getByRole('button', {
        name: 'Remove track 1 from tracklist',
      }),
    )

    expect(
      h.within(form).getByText('No tracklist rows added.'),
    ).toBeInTheDocument()

    await user.click(h.screen.getByRole('button', { name: 'Save record' }))

    const updatedReleasePanel = h.screen.getByRole('complementary', {
      name: 'Blue Monday',
    })
    const tracksSection = h.detailSection(updatedReleasePanel, 'Tracks')
    expect(
      h.within(tracksSection).queryByRole('link', { name: 'Blue Monday' }),
    ).not.toBeInTheDocument()

    await user.click(h.screen.getByRole('link', { name: 'Tracks' }))
    await user.type(
      h.screen.getByRole('searchbox', { name: 'Search tracks' }),
      'Blue Monday',
    )

    expect(h.screen.getByRole('row', { name: /blue monday/i })).toBeVisible()
  })

  it('creates a release with multiple label rows and catalog number states', async () => {
    window.history.pushState({}, '', '/releases')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add release' }))
    const form = h.screen.getByRole('form', { name: 'Add release' })

    await user.type(h.within(form).getByLabelText('Title'), 'Two Label Archive')
    await h.addReleaseArtist(user, form, 'Two Label Artist')
    await user.type(h.within(form).getByLabelText('Label'), 'First Label')
    await user.type(h.within(form).getByLabelText('Catalog number'), 'FIRST-1')
    await user.click(h.within(form).getByRole('button', { name: 'Add label' }))
    await user.type(h.within(form).getByLabelText('Label'), 'Second Label')
    await user.click(h.within(form).getByLabelText('No number'))
    await user.click(h.within(form).getByRole('button', { name: 'Add label' }))
    await h.selectReleaseGenre(user, form)
    await h.addReleaseTrackRow(user, form)

    await user.click(h.screen.getByRole('button', { name: 'Add record' }))
    await user.click(
      await h.screen.findByRole('button', { name: /two label archive/i }),
    )

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Two Label Archive',
    })
    const metadata = h.detailSection(detailPanel, 'Release metadata')

    expect(h.within(metadata).getByText('First Label')).toBeInTheDocument()
    expect(h.within(metadata).getByText('FIRST-1')).toBeInTheDocument()
    expect(h.within(metadata).getByText('Second Label')).toBeInTheDocument()
    expect(
      h.within(metadata).getByText('No catalog number'),
    ).toBeInTheDocument()
    expect(
      h
        .within(metadata)
        .queryByText('First Label FIRST-1, Second Label (No catalog number)'),
    ).not.toBeInTheDocument()
  })

  it('lets Not On Label disable release label rows', async () => {
    window.history.pushState({}, '', '/releases')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add release' }))
    const form = h.screen.getByRole('form', { name: 'Add release' })

    await user.type(h.within(form).getByLabelText('Title'), 'No Label Archive')
    await h.addReleaseArtist(user, form, 'No Label Artist')
    await user.click(h.within(form).getByLabelText('Not On Label'))
    await h.selectReleaseGenre(user, form)
    await h.addReleaseTrackRow(user, form)

    expect(h.within(form).queryByLabelText('Label')).not.toBeInTheDocument()

    await user.click(h.screen.getByRole('button', { name: 'Add record' }))
    await user.click(
      await h.screen.findByRole('button', { name: /no label archive/i }),
    )

    expect(
      h
        .within(
          h.screen.getByRole('complementary', { name: 'No Label Archive' }),
        )
        .getByText('Not On Label'),
    ).toBeInTheDocument()
  })

  it('inherits release main artists for tracklist rows by default', async () => {
    window.history.pushState({}, '', '/releases')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add release' }))
    const form = h.screen.getByRole('form', { name: 'Add release' })

    await user.type(
      h.within(form).getByLabelText('Title'),
      'Inherited Track EP',
    )
    await h.addReleaseArtist(user, form, 'Autechre')
    await h.addReleaseLabel(user, form)
    await h.selectReleaseGenre(user, form)
    await user.click(h.within(form).getByRole('button', { name: '+ Track' }))

    expect(
      h.within(form).queryByLabelText('Track credit role'),
    ).not.toBeInTheDocument()
    expect(h.within(form).getAllByText('Autechre').length).toBeGreaterThan(0)

    await user.type(
      h.within(form).getByLabelText('Track title'),
      'Inherited Mix',
    )
    await user.click(h.screen.getByRole('button', { name: 'Add record' }))
    await user.click(h.screen.getByRole('link', { name: 'Tracks' }))
    await user.type(
      h.screen.getByRole('searchbox', { name: 'Search tracks' }),
      'Inherited Mix',
    )

    expect(
      h.screen.getByRole('row', { name: /inherited mix/i }),
    ).toHaveTextContent('Autechre')
  })

  it('supports multiple explicit track artists selected from release artists', async () => {
    window.history.pushState({}, '', '/releases')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add release' }))
    const form = h.screen.getByRole('form', { name: 'Add release' })

    await user.type(h.within(form).getByLabelText('Title'), 'Split Credit EP')
    await h.addReleaseArtist(user, form, 'Autechre')
    await h.addReleaseArtist(user, form, 'Boards of Canada')
    await h.addReleaseLabel(user, form)
    await h.selectReleaseGenre(user, form)
    await user.click(h.within(form).getByRole('button', { name: '+ Track' }))
    await user.type(h.within(form).getByLabelText('Track title'), 'Shared Cut')
    await user.click(
      h.within(form).getByRole('button', { name: 'Use custom artists' }),
    )

    const autechreTrackArtistOption = h
      .within(form)
      .getByLabelText('Use Autechre on track')
      .closest('label')
      ?.querySelector('span')

    if (!(autechreTrackArtistOption instanceof HTMLElement)) {
      throw new Error('Expected a rendered Autechre track artist chip label')
    }

    expect(
      getComputedStyle(autechreTrackArtistOption).textTransform || 'none',
    ).toBe('none')
    expect(h.within(form).getByLabelText('Use Autechre on track')).toBeChecked()
    expect(
      h.within(form).getByLabelText('Use Boards of Canada on track'),
    ).toBeChecked()

    await user.click(h.screen.getByRole('button', { name: 'Add record' }))
    await user.click(h.screen.getByRole('link', { name: 'Tracks' }))
    await user.type(
      h.screen.getByRole('searchbox', { name: 'Search tracks' }),
      'Shared Cut',
    )

    const trackRow = h.screen.getByRole('row', { name: /shared cut/i })

    expect(trackRow).toHaveTextContent('Autechre')
    expect(trackRow).toHaveTextContent('Boards of Canada')
  })

  it('requires explicit track artists for Various Artists tracklist rows', async () => {
    window.history.pushState({}, '', '/releases')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add release' }))
    const form = h.screen.getByRole('form', { name: 'Add release' })

    await user.type(h.within(form).getByLabelText('Title'), 'Compilation Test')
    await user.click(h.within(form).getByLabelText('Various Artists'))
    await user.click(h.within(form).getByLabelText('Not On Label'))
    await h.selectReleaseGenre(user, form)
    await user.click(h.within(form).getByRole('button', { name: '+ Track' }))
    await user.type(h.within(form).getByLabelText('Track title'), 'VA Track')

    expect(h.screen.getByRole('button', { name: 'Add record' })).toBeDisabled()
    expect(h.within(form).getByRole('alert')).toHaveTextContent(
      'Track artists are required for Various Artists releases.',
    )

    await user.type(
      h.within(form).getByLabelText('Track artist'),
      'Track Artist',
    )

    await user.click(
      h.within(form).getByRole('button', { name: 'Add track artist' }),
    )
    expect(h.within(form).getByRole('alert')).toHaveTextContent(
      'Set a role for each track artist.',
    )

    await user.selectOptions(
      h.within(form).getByLabelText('Track role for Track Artist'),
      'Main artist',
    )

    expect(h.screen.getByRole('button', { name: 'Add record' })).toBeEnabled()
  })
})
