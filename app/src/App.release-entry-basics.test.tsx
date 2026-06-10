import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App release entry basics', () => {
  it('requires a label genre and tracklist row before a release can be added', async () => {
    window.history.pushState({}, '', '/releases')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add release' }))
    const form = h.screen.getByRole('form', { name: 'Add release' })

    await user.type(
      h.within(form).getByLabelText('Title'),
      'Incomplete Release Shell',
    )
    await h.addReleaseArtist(user, form, 'Incomplete Release Artist')

    expect(h.within(form).getByRole('alert')).toHaveTextContent(
      'Add a label or mark this as Not On Label.',
    )
    expect(
      h.within(form).getByRole('button', { name: 'Add record' }),
    ).toBeDisabled()

    await user.click(h.within(form).getByLabelText('Not On Label'))

    expect(h.within(form).getByRole('alert')).toHaveTextContent(
      'Select at least one genre.',
    )

    await h.selectReleaseGenre(user, form)

    expect(h.within(form).getByRole('alert')).toHaveTextContent(
      'Add at least one tracklist row.',
    )
  })

  it('requires release artist roles after artists are added as chips', async () => {
    window.history.pushState({}, '', '/releases')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add release' }))
    const form = h.screen.getByRole('form', { name: 'Add release' })

    await user.type(h.within(form).getByLabelText('Title'), 'Role Required EP')
    await user.type(
      h.within(form).getByLabelText('Release artist'),
      'Unset Role Artist',
    )
    await user.click(h.within(form).getByRole('button', { name: 'Add artist' }))

    expect(h.within(form).getByRole('alert')).toHaveTextContent(
      'Set a role for each release artist.',
    )
    expect(
      h.within(form).getByRole('button', { name: 'Add record' }),
    ).toBeDisabled()

    await user.click(
      h.within(form).getByLabelText('Role for Unset Role Artist'),
    )
    await user.click(
      h.within(form).getByRole('menuitem', { name: 'Main artist' }),
    )

    expect(
      h.within(form).getByRole('button', { name: 'Add record' }),
    ).toBeDisabled()
  })

  it('creates a release with draft tracks that appear in Tracks and link back to the release', async () => {
    window.history.pushState({}, '', '/releases')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add release' }))
    const form = h.screen.getByRole('form', { name: 'Add release' })

    await user.type(
      h.within(form).getByLabelText('Title'),
      'Basement Dub Plate',
    )
    await h.addReleaseArtist(user, form, 'New Order')
    await h.addReleaseLabel(user, form)
    await h.selectReleaseGenre(user, form)
    await user.click(h.within(form).getByRole('button', { name: '+ Track' }))
    await user.type(
      h.within(form).getByLabelText('Track title'),
      'Basement Dub A',
    )
    await user.clear(h.within(form).getByLabelText('Track duration minutes'))
    await user.type(
      h.within(form).getByLabelText('Track duration minutes'),
      '5',
    )
    await user.clear(h.within(form).getByLabelText('Track duration seconds'))
    await user.type(
      h.within(form).getByLabelText('Track duration seconds'),
      '12',
    )
    await user.click(h.within(form).getByRole('button', { name: '+ Track' }))
    await user.type(
      h.within(form).getByLabelText('Track title'),
      'Basement Dub B',
    )
    await user.click(h.screen.getByRole('button', { name: 'Add record' }))

    const releasePanel = h.screen.getByRole('complementary', {
      name: 'Basement Dub Plate',
    })
    const tracksSection = h.detailSection(releasePanel, 'Tracks')

    expect(h.within(tracksSection).getByText('2 tracks')).toBeInTheDocument()
    expect(
      h.within(tracksSection).getByText('Basement Dub A'),
    ).toBeInTheDocument()
    expect(
      h.within(tracksSection).getByText('Basement Dub B'),
    ).toBeInTheDocument()

    await user.click(
      h.within(tracksSection).getByRole('link', { name: 'Basement Dub A' }),
    )

    expect(
      h.within(h.screen.getByRole('banner')).getByRole('heading', {
        name: 'Tracks',
      }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('complementary', { name: 'Basement Dub A' }),
    ).toBeInTheDocument()

    await user.type(
      h.screen.getByRole('searchbox', { name: 'Search tracks' }),
      'Basement Dub',
    )

    expect(h.screen.getByRole('row', { name: /basement dub a/i })).toBeVisible()
    expect(h.screen.getByRole('row', { name: /basement dub b/i })).toBeVisible()

    await user.click(h.screen.getByRole('button', { name: /basement dub a/i }))

    const trackPanel = h.screen.getByRole('complementary', {
      name: 'Basement Dub A',
    })

    expect(
      h
        .within(h.detailSection(trackPanel, 'Release appearances'))
        .getByRole('link', {
          name: 'Basement Dub Plate',
        }),
    ).toHaveAttribute('href', expect.stringContaining('/releases?release='))
  })

  it('creates a release entry with artists labels genres and real tracklist rows', async () => {
    window.history.pushState({}, '', '/releases')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add release' }))
    const form = h.screen.getByRole('form', { name: 'Add release' })

    expect(h.within(form).queryByLabelText('Media')).not.toBeInTheDocument()
    expect(
      h.within(form).queryByLabelText('Track file format'),
    ).not.toBeInTheDocument()

    await user.click(h.screen.getByRole('button', { name: 'Add record' }))
    expect(h.within(form).getByRole('alert')).toHaveTextContent(
      'Title is required.',
    )

    await user.type(h.within(form).getByLabelText('Title'), 'Catalog Logic')
    await h.addReleaseArtist(user, form, 'Autechre')
    await user.selectOptions(h.within(form).getByLabelText('Year'), '2024')
    await user.type(h.within(form).getByLabelText('Label'), 'Warp')
    await user.type(h.within(form).getByLabelText('Catalog number'), 'WARP123')
    await user.click(h.within(form).getByRole('button', { name: 'Add label' }))
    await user.click(h.within(form).getByLabelText('Genre IDM'))
    await user.type(h.within(form).getByLabelText('Tags'), 'private shelf')
    await user.click(h.within(form).getByRole('button', { name: '+ Track' }))
    await user.type(h.within(form).getByLabelText('Track title'), 'First Pass')
    await user.clear(h.within(form).getByLabelText('Track duration minutes'))
    await user.type(
      h.within(form).getByLabelText('Track duration minutes'),
      '4',
    )
    await user.clear(h.within(form).getByLabelText('Track duration seconds'))
    await user.type(
      h.within(form).getByLabelText('Track duration seconds'),
      '57',
    )
    await user.type(
      h.within(form).getByLabelText('Version note'),
      'Album version',
    )
    await user.click(h.screen.getByRole('button', { name: 'Add record' }))

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Catalog Logic',
    })
    const releaseRow = h.screen.getByRole('row', { name: /catalog logic/i })
    const metadata = h.detailSection(detailPanel, 'Release metadata')

    expect(
      h.within(detailPanel).getAllByText('Autechre').length,
    ).toBeGreaterThan(0)
    expect(h.within(detailPanel).getByText('2024')).toBeInTheDocument()
    expect(
      h.screen.getByRole('columnheader', { name: 'Catalog #' }),
    ).toBeInTheDocument()
    expect(h.within(releaseRow).getByText('Warp')).toBeInTheDocument()
    expect(h.within(releaseRow).getByText('WARP123')).toBeInTheDocument()
    expect(h.within(metadata).getByText('Warp')).toBeInTheDocument()
    expect(h.within(metadata).getByText('Catalog number')).toBeInTheDocument()
    expect(h.within(metadata).getByText('WARP123')).toBeInTheDocument()
    expect(
      h.within(metadata).queryByText('Warp WARP123'),
    ).not.toBeInTheDocument()
    expect(h.within(detailPanel).getByText('IDM')).toBeInTheDocument()
    expect(h.within(detailPanel).getByText('private shelf')).toBeInTheDocument()
    expect(
      h.within(h.detailSection(detailPanel, 'Tracks')).getByRole('link', {
        name: 'First Pass',
      }),
    ).toBeInTheDocument()
  })

  it('edits release draft tracks through a selected master list row and detail panel', async () => {
    window.history.pushState({}, '', '/releases')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add release' }))
    const form = h.screen.getByRole('form', { name: 'Add release' })

    await user.type(h.within(form).getByLabelText('Title'), 'Master Detail EP')
    await h.addReleaseArtist(user, form, 'Locked Club')
    await h.addReleaseLabel(user, form)
    await h.selectReleaseGenre(user, form)

    expect(
      h.within(form).queryByRole('button', { name: 'Add track row' }),
    ).not.toBeInTheDocument()
    expect(
      h.within(form).getByRole('list', { name: 'Draft tracklist' }),
    ).toBeInTheDocument()
    expect(
      h.within(form).getByText('No tracklist rows added.'),
    ).toBeInTheDocument()
    expect(
      h.within(form).getAllByRole('button', { name: /\+.*track/i }),
    ).toHaveLength(1)

    await user.click(h.within(form).getByRole('button', { name: '+ Track' }))

    expect(
      h.within(form).getByRole('heading', { name: 'Track 1 details' }),
    ).toBeInTheDocument()
    expect(h.within(form).getByLabelText('Track title')).toHaveFocus()

    await user.type(
      h.within(form).getByLabelText('Track title'),
      "It's My Rave",
    )
    await user.clear(h.within(form).getByLabelText('Track duration minutes'))
    await user.type(
      h.within(form).getByLabelText('Track duration minutes'),
      '4',
    )
    await user.clear(h.within(form).getByLabelText('Track duration seconds'))
    await user.type(
      h.within(form).getByLabelText('Track duration seconds'),
      '12',
    )

    await user.click(h.within(form).getByRole('button', { name: '+ Track' }))

    expect(
      h.within(form).getByRole('heading', { name: 'Track 2 details' }),
    ).toBeInTheDocument()
    expect(h.within(form).getByLabelText('Track title')).toHaveFocus()

    await user.type(h.within(form).getByLabelText('Track title'), 'Second Pass')

    expect(
      h.within(form).getByRole('button', { name: /Track 1 It's My Rave/ }),
    ).toHaveTextContent('4:12')
    expect(
      h.within(form).getByRole('button', { name: /Track 2 Second Pass/ }),
    ).toHaveAttribute('aria-pressed', 'true')

    await user.click(
      h.within(form).getByRole('button', { name: /Track 1 It's My Rave/ }),
    )

    expect(
      h.within(form).getByRole('heading', { name: 'Track 1 details' }),
    ).toBeInTheDocument()
    expect(h.within(form).getByLabelText('Track title')).toHaveValue(
      "It's My Rave",
    )
  })
})
